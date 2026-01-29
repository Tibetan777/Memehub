import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs'; // ใช้ตัวนี้แทน bcrypt เดิม

const app = express();
const PORT = 3000; // ใช้พอร์ต 3000
const SECRET = 'meme-hub-secret-2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database Connection
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'Narongrit',
  waitForConnections: true,
  connectionLimit: 10
});

// Helper: Verify Token
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

// --- API Routes ---

// 1. Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await pool.query('SELECT * FROM members WHERE email_mem = ?', [email]);
    const user = users[0];

    if (!user) return res.status(401).json({ error: 'User not found' });

    // เช็คทั้งรหัสแบบ Hash และแบบ Text ธรรมดา (เผื่อข้อมูลเก่า)
    const isMatch = await bcrypt.compare(password, user.password_encrypted || '') || user.password_mem === password;

    if (!isMatch) return res.status(401).json({ error: 'Wrong password' });

    const token = jwt.sign({ id: user.id_mem, role: user.role }, SECRET, { expiresIn: '24h' });
    res.json({ token, user: { name: user.name_mem, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Register
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO members (name_mem, email_mem, password_mem, password_encrypted, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, password, hashed, 'user']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

// 3. Get All Memes
app.get('/api/memes', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.id, m.title, m.category, m.likes, m.created_at, mem.name_mem as uploader 
      FROM memes m 
      LEFT JOIN members mem ON m.created_by = mem.id_mem 
      ORDER BY m.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Meme Image
app.get('/api/memes/:id/image', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT image FROM memes WHERE id = ?', [req.params.id]);
    if (!rows[0] || !rows[0].image) return res.status(404).send('');
    
    res.setHeader('Content-Type', 'image/png');
    res.end(rows[0].image);
  } catch (err) {
    res.status(500).send('');
  }
});

// 5. Upload Meme
app.post('/api/memes', auth, async (req, res) => {
  const { title, image, category } = req.body;
  try {
    if (!image) throw new Error('No image data');
    // แปลง Base64 กลับเป็น Buffer เพื่อเก็บลง Blob
    const buffer = Buffer.from(image.split(',')[1], 'base64');
    
    await pool.query(
      'INSERT INTO memes (title, image, category, created_by) VALUES (?, ?, ?, ?)',
      [title, buffer, category || 'General', req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});