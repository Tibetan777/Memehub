import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5173;
const SECRET_KEY = 'meme-hub-secret-key-2024';

app.use(express.static(path.join(__dirname, 'dist')));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'Narongrit',
  connectionLimit: 10
});

// Initialize database
async function initDatabase() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS memes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        image LONGBLOB NOT NULL,
        category VARCHAR(50),
        likes INT DEFAULT 0,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES members(id_mem) ON DELETE CASCADE
      )
    `);
    
    // Track likes per user
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS meme_likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        meme_id INT NOT NULL,
        user_id INT NOT NULL,
        UNIQUE KEY unique_like (meme_id, user_id),
        FOREIGN KEY (meme_id) REFERENCES memes(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES members(id_mem) ON DELETE CASCADE
      )
    `);
    
    console.log('✓ Database ready');
  } finally {
    conn.release();
  }
}

initDatabase();

// Middleware: Verify JWT token
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET_KEY);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Middleware: Check admin role
async function checkAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    const conn = await pool.getConnection();
    const [user] = await conn.execute('SELECT role FROM members WHERE id_mem = ?', [req.user.id]);
    conn.release();
    
    if (!user[0] || user[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Permission check failed' });
  }
}

// Get all memes (images fetched separately)
app.get('/api/memes', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [memes] = await conn.execute(`
      SELECT m.id, m.title, m.description, m.category, m.likes, 
             m.created_by, m.created_at, mem.name_mem
      FROM memes m
      LEFT JOIN members mem ON m.created_by = mem.id_mem
      ORDER BY m.created_at DESC
      LIMIT 100
    `);
    conn.release();
    
    res.json(memes.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description || '',
      category: m.category || 'อื่นๆ',
      likes: m.likes || 0,
      uploadedBy: m.name_mem || 'Unknown',
      uploadedAt: m.created_at
    })));
  } catch (err) {
    console.error('GET /api/memes error:', err.message);
    res.status(500).json({ error: 'Failed to load memes' });
  }
});

// Get meme image binary
app.get('/api/memes/:id/image', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT image FROM memes WHERE id = ?', [req.params.id]);
    conn.release();
    
    if (!rows.length || !rows[0].image) {
      return res.status(404).send('Not found');
    }
    
    const buf = rows[0].image;
    let type = 'image/png';
    if (buf[0] === 0xFF && buf[1] === 0xD8) type = 'image/jpeg';
    else if (buf[0] === 0x47 && buf[1] === 0x49) type = 'image/gif';
    
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'max-age=31536000, immutable');
    res.send(buf);
  } catch (err) {
    console.error('Image error:', err.message);
    res.status(500).send('Error');
  }
});

// Download meme
app.get('/api/memes/:id/download', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT image, title FROM memes WHERE id = ?', [req.params.id]);
    conn.release();
    
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${rows[0].title}.png"`);
    res.send(rows[0].image);
  } catch (err) {
    res.status(500).json({ error: 'Download failed' });
  }
});

// Upload meme
app.post('/api/memes/upload', verifyToken, async (req, res) => {
  const { title, description, image, category } = req.body;
  if (!title || !image) return res.status(400).json({ error: 'Title and image required' });

  try {
    let b64 = image;
    if (b64.includes(',')) b64 = b64.split(',')[1];
    
    const buf = Buffer.from(b64, 'base64');
    if (buf.length === 0) return res.status(400).json({ error: 'Invalid image' });

    const conn = await pool.getConnection();
    await conn.execute(
      'INSERT INTO memes (title, description, image, category, created_by) VALUES (?, ?, ?, ?, ?)',
      [title, description || '', buf, category || 'อื่นๆ', req.user.id]
    );
    conn.release();
    
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Like meme (one per user)
app.post('/api/memes/:id/like', verifyToken, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    
    // Try to insert like
    try {
      await conn.execute(
        'INSERT INTO meme_likes (meme_id, user_id) VALUES (?, ?)',
        [req.params.id, req.user.id]
      );
      // Increment counter
      await conn.execute('UPDATE memes SET likes = likes + 1 WHERE id = ?', [req.params.id]);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        conn.release();
        return res.status(400).json({ error: 'Already liked' });
      }
      throw err;
    }
    
    conn.release();
    res.json({ success: true });
  } catch (err) {
    console.error('Like error:', err.message);
    res.status(500).json({ error: 'Like failed' });
  }
});

// Delete meme (admin only)
app.delete('/api/memes/:id', verifyToken, checkAdmin, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.execute('DELETE FROM memes WHERE id = ?', [req.params.id]);
    conn.release();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Ban user (admin only)
app.post('/api/admin/ban/:userId', verifyToken, checkAdmin, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.execute('UPDATE members SET is_banned = 1 WHERE id_mem = ?', [req.params.userId]);
    conn.release();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ban failed' });
  }
});

// Unban user (admin only)
app.post('/api/admin/unban/:userId', verifyToken, checkAdmin, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.execute('UPDATE members SET is_banned = 0 WHERE id_mem = ?', [req.params.userId]);
    conn.release();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Unban failed' });
  }
});

// Get all users
app.get('/api/admin/users', verifyToken, checkAdmin, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [users] = await conn.execute('SELECT id_mem, name_mem, email_mem, role, is_banned FROM members');
    conn.release();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// Register
app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, name required' });
  }

  try {
    const conn = await pool.getConnection();
    const hashedPw = await bcrypt.hash(password, 10);
    
    await conn.execute(
      'INSERT INTO members (name_mem, email_mem, password_mem, password_encrypted, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, password, hashedPw, 'user']
    );
    conn.release();
    
    res.status(201).json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      'SELECT id_mem, name_mem, email_mem, password_mem, password_encrypted, role FROM members WHERE email_mem = ?',
      [email]
    );
    conn.release();

    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    let match = user.password_mem === password || await bcrypt.compare(password, user.password_encrypted || '');
    
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id_mem, email, name: user.name_mem, role: user.role || 'user' },
      SECRET_KEY,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: { id: user.id_mem, name: user.name_mem, email, role: user.role || 'user' }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get profile
app.get('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      'SELECT id_mem, name_mem, email_mem, role FROM members WHERE id_mem = ?',
      [req.user.id]
    );
    conn.release();
    
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: rows[0].id_mem,
      name: rows[0].name_mem,
      email: rows[0].email_mem,
      role: rows[0].role || 'user'
    });
  } catch (err) {
    res.status(500).json({ error: 'Profile failed' });
  }
});

// Serve React SPA - fallback route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Database: Narongrit`);
  console.log(`✓ API available at http://localhost:${PORT}/api`);
});
