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
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, ".env");

console.log("Loading .env from:", envPath);
dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  console.error("FATAL: JWT_SECRET missing");
  process.exit(1);
}
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.set("trust proxy", 1);
app.use("/uploads", express.static("uploads", { maxAge: "1y", etag: false }));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
});

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

const optionalAuth = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (token) {
    try {
      req.user = jwt.verify(token, SECRET);
    } catch (e) {}
  }
  next();
};

// ... (Login/Register/Categories Routes เหมือนเดิม) ...
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
      !!(await bcrypt.compare(password, user.password_encrypted || ""))
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
      "INSERT INTO members (name_mem, email_mem, password_encrypted, role) VALUES (?, ?, ?, ?)",
      [name, email, hashed, "user"],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Email exists" });
  }
});

app.get("/api/categories", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT name FROM categories ORDER BY name ASC",
    );
    res.json(rows.map((row) => row.name));
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

// GET MEMES (อัปเกรด FYP Algorithm)
app.get("/api/memes", optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const search = req.query.search || "";
    const category = req.query.category || "All";
    const sort = req.query.sort || "fyp"; // เปลี่ยน Default เป็น FYP
    const offset = (page - 1) * limit;
    const userId = req.user ? req.user.id : 0;

    let orderByClause = "ORDER BY m.created_at DESC"; // Default fallback

    // FYP Algorithm Logic
    if (sort === "fyp" && userId > 0) {
      // 1. หาหมวดหมู่ที่ user คนนี้ชอบมากที่สุด 3 อันดับแรก
      const [favCats] = await pool.query(
        `
            SELECT m.category, COUNT(*) as count
            FROM meme_likes ml
            JOIN memes m ON ml.meme_id = m.id
            WHERE ml.user_id = ?
            GROUP BY m.category
            ORDER BY count DESC LIMIT 3
        `,
        [userId],
      );

      if (favCats.length > 0) {
        // ถ้ามีประวัติการไลค์ ให้ดันหมวดพวกนี้ขึ้นก่อน แล้วค่อยสุ่ม
        const favCatNames = favCats.map((c) => `'${c.category}'`).join(",");
        // Logic: ถ้าอยู่ในหมวดที่ชอบ ให้คะแนน 1, ถ้าไม่ ให้ 0 -> แล้วสุ่มในกลุ่มนั้น
        orderByClause = `ORDER BY (CASE WHEN m.category IN (${favCatNames}) THEN 1 ELSE 0 END) DESC, RAND()`;
      } else {
        // ถ้า User ใหม่ (ไม่มีประวัติ) -> สุ่มล้วนๆ
        orderByClause = "ORDER BY RAND()";
      }
    } else if (sort === "fyp") {
      // ถ้าไม่ได้ Login -> สุ่มล้วนๆ
      orderByClause = "ORDER BY RAND()";
    } else if (sort === "popular") {
      orderByClause = "ORDER BY m.likes DESC, m.created_at DESC";
    } else if (sort === "newest") {
      orderByClause = "ORDER BY m.created_at DESC";
    }

    let query = `
      SELECT m.id, m.title, m.category, m.likes, m.created_at, m.image, m.created_by,
      mem.name_mem as uploader, (ml.id IS NOT NULL) as isLiked
      FROM memes m
      LEFT JOIN members mem ON m.created_by = mem.id_mem
      LEFT JOIN meme_likes ml ON m.id = ml.meme_id AND ml.user_id = ?
    `;

    const params = [userId];
    const conditions = [];

    if (search) {
      conditions.push(`(m.title LIKE ? OR m.category LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category && category !== "All") {
      conditions.push(`m.category = ?`);
      params.push(category);
    }

    if (conditions.length > 0) query += ` WHERE ` + conditions.join(" AND ");

    query += ` ${orderByClause} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.query(query, params);
    const memesWithUrl = rows.map((meme) => ({
      ...meme,
      imageUrl: meme.image ? `/uploads/${meme.image}` : null,
      isLiked: Boolean(meme.isLiked),
    }));

    res.set("Cache-Control", "no-store");
    res.json({ data: memesWithUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ... (Routes อื่นๆ POST/PUT/DELETE คงเดิม) ...
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

app.put("/api/memes/:id", auth, async (req, res) => {
  const { category } = req.body;
  try {
    const [meme] = await pool.query(
      "SELECT created_by FROM memes WHERE id = ?",
      [req.params.id],
    );
    if (!meme[0]) return res.status(404).json({ error: "Not found" });
    if (
      req.user.role !== "admin" &&
      Number(req.user.id) !== Number(meme[0].created_by)
    )
      return res.status(403).json({ error: "Forbidden" });
    await pool.query("UPDATE memes SET category = ? WHERE id = ?", [
      category,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    )
      return res.status(403).json({ error: "Forbidden" });
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
