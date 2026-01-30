import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import Joi from "joi";

const app = express();
const PORT = 3000;
const SECRET = "meme-hub-secret-2024";

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// เพิ่ม Cache Control ให้รูปภาพ (Optimization)
// บอก Browser และ Cloudflare ว่าให้เก็บรูปไว้ 1 ปี (1y) ไม่ต้องมาขอใหม่บ่อยๆ
// ช่วยลดภาระ Server เวลาคนเข้าเยอะๆ
app.use(
  "/uploads",
  express.static("uploads", {
    maxAge: "1y",
    etag: false,
  }),
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many requests",
});
app.use("/api/", apiLimiter);

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "Narongrit",
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
});

// Middleware
const auth = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(403).json({ error: "Invalid Token" });
  }
};

// Middleware สำหรับหน้า Feed
const optionalAuth = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (token) {
    try {
      req.user = jwt.verify(token, SECRET);
    } catch (e) {
      console.log("Token Invalid:", e.message);
    }
  }
  next();
};

const uploadSchema = Joi.object({
  title: Joi.string().min(1).max(100).required(),
  category: Joi.string()
    .valid(
      "Funny",
      "Relatable",
      "Dark Humor",
      "Anime",
      "Other",
      "Work Life",
      "General",
    )
    .default("General"),
  description: Joi.string().allow("").optional(),
  image: Joi.string()
    .required()
    .pattern(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/),
});

// --- Routes ---

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await pool.query(
      "SELECT * FROM members WHERE email_mem = ?",
      [email],
    );
    const user = users[0];
    if (
      !user ||
      !(
        (await bcrypt.compare(password, user.password_encrypted || "")) ||
        user.password_mem === password
      )
    ) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id_mem, role: user.role }, SECRET, {
      expiresIn: "24h",
    });
    res.json({
      token,
      user: { id: user.id_mem, name: user.name_mem, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO members (name_mem, email_mem, password_mem, password_encrypted, role) VALUES (?, ?, ?, ?, ?)",
      [name, email, password, hashed, "user"],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Email exists" });
  }
});

// GET MEMES (High Performance & Accurate Like Check)
app.get("/api/memes", optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "";
    const offset = (page - 1) * limit;

    const userId = req.user ? req.user.id : 0;

    console.log(`[GET /memes] Request by UserID: ${userId}`);

    let query = `
      SELECT
        m.id, m.title, m.category, m.likes, m.created_at, m.image, m.created_by,
        mem.name_mem as uploader,
        (ml.id IS NOT NULL) as isLiked
      FROM memes m
      LEFT JOIN members mem ON m.created_by = mem.id_mem
      LEFT JOIN meme_likes ml ON m.id = ml.meme_id AND ml.user_id = ?
    `;
    const params = [userId];

    if (search) {
      query += ` WHERE m.title LIKE ? OR m.category LIKE ? `;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ? `;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);

    const memesWithUrl = rows.map((meme) => ({
      ...meme,
      imageUrl: meme.image ? `/uploads/${meme.image}` : null,
      isLiked: Boolean(meme.isLiked),
    }));

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.json({ data: memesWithUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/memes", auth, async (req, res) => {
  const { title, image, category } = req.body;
  try {
    const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: "Invalid image" });
    const filename = `${uuidv4()}.${matches[1] === "jpeg" ? "jpg" : matches[1]}`;
    fs.writeFileSync(
      path.join("uploads", filename),
      Buffer.from(matches[2], "base64"),
    );

    await pool.query(
      "INSERT INTO memes (title, image, category, created_by, likes) VALUES (?, ?, ?, ?, 0)",
      [title, filename, category || "General", req.user.id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

app.post("/api/memes/:id/like", auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [exists] = await conn.query(
      "SELECT id FROM meme_likes WHERE meme_id = ? AND user_id = ?",
      [req.params.id, req.user.id],
    );

    let status = "liked";
    if (exists.length > 0) {
      await conn.query("DELETE FROM meme_likes WHERE id = ?", [exists[0].id]);
      await conn.query(
        "UPDATE memes SET likes = GREATEST(0, likes - 1) WHERE id = ?",
        [req.params.id],
      );
      status = "unliked";
    } else {
      await conn.query(
        "INSERT INTO meme_likes (meme_id, user_id) VALUES (?, ?)",
        [req.params.id, req.user.id],
      );
      await conn.query("UPDATE memes SET likes = likes + 1 WHERE id = ?", [
        req.params.id,
      ]);
    }
    await conn.commit();
    res.json({ status });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: "Failed" });
  } finally {
    conn.release();
  }
});

app.delete("/api/memes/:id", auth, async (req, res) => {
  try {
    const [meme] = await pool.query(
      "SELECT created_by, image FROM memes WHERE id = ?",
      [req.params.id],
    );
    if (!meme[0]) return res.status(404).json({ error: "Not found" });

    if (
      req.user.role !== "admin" &&
      Number(req.user.id) !== Number(meme[0].created_by)
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // ลบไฟล์รูปจริงออกจากโฟลเดอร์ uploads (Clean up)
    const filePath = path.join("uploads", meme[0].image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await pool.query("DELETE FROM meme_likes WHERE meme_id = ?", [
      req.params.id,
    ]);
    await pool.query("DELETE FROM memes WHERE id = ?", [req.params.id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/memes/:id/image", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT image FROM memes WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows[0]) return res.status(404).send("Not found");
    res.redirect(`/uploads/${rows[0].image}`);
  } catch (err) {
    res.status(500).send("Error");
  }
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`),
);
