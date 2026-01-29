import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';
import { createClient } from 'redis';

const app = express();
const PORT = 3000;
const SECRET = 'meme-hub-secret-2024';

// --- 1. เชื่อมต่อ Redis (Memurai) ---
const redisClient = createClient();
redisClient.on('error', (err) => console.error('Redis Error:', err));
redisClient.connect().then(() => console.log('✅ Connected to Redis (Memurai)')).catch(console.error);

// สร้างโฟลเดอร์ uploads
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// --- Middleware ---
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('uploads')); // เปิดให้เข้าถึงไฟล์รูป

// Rate Limit (กันยิงรัว)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests'
});
app.use('/api/', apiLimiter);

// Database Connection
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'Narongrit',
  waitForConnections: true,
  connectionLimit: 50, // เพิ่ม connection รองรับ load เยอะ
  queueLimit: 0
});

const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid Token' });
  }
};

// Validation Schemas
const registerSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const uploadSchema = Joi.object({
  title: Joi.string().min(1).max(100).required(),
  category: Joi.string().valid('Funny', 'Relatable', 'Dark Humor', 'Anime', 'Other', 'Work Life', 'General').default('General'),
  description: Joi.string().allow('').optional(),
  image: Joi.string().required().pattern(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/)
});

// --- API Routes ---

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await pool.query('SELECT * FROM members WHERE email_mem = ?', [email]);
    const user = users[0];
    if (!user || !(await bcrypt.compare(password, user.password_encrypted || '') || user.password_mem === password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id_mem, role: user.role }, SECRET, { expiresIn: '24h' });
    res.json({ token, user: { name: user.name_mem, role: user.role } });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/register', async (req, res) => {
  const { error } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO members (name_mem, email_mem, password_mem, password_encrypted, role) VALUES (?, ?, ?, ?, ?)', [name, email, password, hashed, 'user']);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: 'Email exists' }); }
});

// 🔥 GET MEMES (Redis Cache + Disk Image + Search)
app.get('/api/memes', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || ''; // รับคำค้นหา
    const offset = (page - 1) * limit;

    // สร้าง Key สำหรับ Cache (ต้องรวมคำค้นหาด้วย ไม่งั้นผลลัพธ์จะมั่ว)
    const cacheKey = `memes_p${page}_l${limit}_s${search.trim()}`;

    // 1. ลองถาม Redis ก่อน
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log('⚡ Hit Redis Cache'); // เช็ค Log ว่ามันทำงานไหม
        return res.json(JSON.parse(cachedData));
      }
    } catch (e) { console.log('Redis skipped'); }

    // 2. ถ้าไม่มีใน Redis ให้ถาม DB (MySQL)
    let query = `
      SELECT m.id, m.title, m.category, m.likes, m.created_at, m.image, mem.name_mem as uploader 
      FROM memes m 
      LEFT JOIN members mem ON m.created_by = mem.id_mem 
    `;
    const params = [];

    // Logic ค้นหา (Search)
    if (search) {
      query += ` WHERE m.title LIKE ? OR m.category LIKE ? `;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ? `;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    // แปลงชื่อไฟล์เป็น URL
    const memesWithUrl = rows.map(meme => ({
      ...meme,
      imageUrl: meme.image ? `${req.protocol}://${req.get('host')}/uploads/${meme.image}` : null
    }));

    const responseData = { data: memesWithUrl };

    // 3. เก็บใส่ Redis (หมดอายุใน 60 วินาที)
    // ถ้ามีการค้นหา ไม่ต้องเก็บนานก็ได้ (เผื่อคนค้นคำแปลกๆ เยอะจน Cache เต็ม)
    const cacheTime = search ? 30 : 60;
    try {
      await redisClient.setEx(cacheKey, cacheTime, JSON.stringify(responseData));
    } catch (e) { }

    console.log('🐢 Hit Database'); // เช็ค Log
    res.json(responseData);

  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upload Meme (บันทึกลง Disk)
app.post('/api/memes', auth, async (req, res) => {
  const { error } = uploadSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { title, image, category } = req.body;
  try {
    const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid image' });

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const filename = `${uuidv4()}.${extension}`;

    // เขียนไฟล์ลง Disk (เร็วมาก)
    fs.writeFileSync(path.join('uploads', filename), Buffer.from(matches[2], 'base64'));

    // บันทึกแค่ชื่อไฟล์ลง DB
    await pool.query('INSERT INTO memes (title, image, category, created_by, likes) VALUES (?, ?, ?, ?, 0)',
      [title, filename, category || 'General', req.user.id]);

    // 🔥 สำคัญ: เคลียร์ Cache หน้าแรกทิ้ง เพื่อให้เห็นรูปใหม่ทันที
    try {
      // ลบ Cache หน้าแรกๆ ทิ้งแบบง่ายๆ (หรือจะใช้ pattern delete ก็ได้แต่นี่ง่ายกว่า)
      await redisClient.del('memes_p1_l20_s');
    } catch (e) { }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Upload failed' }); }
});

// Like/Unlike (เคลียร์ Cache ด้วยนะ)
app.post('/api/memes/:id/like', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [exists] = await conn.query('SELECT id FROM meme_likes WHERE meme_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (exists.length > 0) {
      await conn.query('DELETE FROM meme_likes WHERE id = ?', [exists[0].id]);
      await conn.query('UPDATE memes SET likes = likes - 1 WHERE id = ?', [req.params.id]);
      await conn.commit();
      res.json({ status: 'unliked' });
    } else {
      await conn.query('INSERT INTO meme_likes (meme_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
      await conn.query('UPDATE memes SET likes = likes + 1 WHERE id = ?', [req.params.id]);
      await conn.commit();
      res.json({ status: 'liked' });
    }

    // หมายเหตุ: การกดไลค์อาจจะไม่เห็นผลทันทีถ้า Cache ยังไม่หมดอายุ (60วิ)
    // ถ้าซีเรียสเรื่อง Realtime ต้องใช้ Socket.io แต่สำหรับสเกลนี้ 60วิ รับได้ครับ
  } catch (err) { await conn.rollback(); res.status(500).json({ error: 'Failed' }); }
  finally { conn.release(); }
});

app.get('/api/memes/:id/image', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT image FROM memes WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).send('Not found');
    res.redirect(`/uploads/${rows[0].image}`);
  } catch (err) { res.status(500).send('Error'); }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT} (Redis Active)`));