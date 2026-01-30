import axios from "axios";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, ".env");
dotenv.config({ path: envPath });

// --- CONFIG ---
const TARGET_TOTAL = 500; // จำนวนมีมที่ต้องการเพิ่มในรอบนี้
const BATCH_SIZE = 50; // ดึงรอบละ 50 (Limit ของ API)
const BOT_USER_ID = 1;

// ขยายแหล่งข้อมูลให้ครอบคลุมและหลากหลายขึ้น
const SUBREDDIT_MAP = {
    memes: "Funny",
    funny: "Funny",
    dankmemes: "Dark Humor",
    wholesomememes: "Relatable",
    me_irl: "Relatable",
    meirl: "Relatable",
    "2meirl4meirl": "Relatable",
    programmerhumor: "Work Life",
    anime_irl: "Anime",
    animemes: "Anime",
    goodanimemes: "Anime",
    historymemes: "Other",
    sciencememes: "Other",
    surrealmemes: "Dark Humor",
    terriblefacebookmemes: "Funny",
    PrequelMemes: "Funny",
    AdviceAnimals: "Other",
};

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// ฟังก์ชันสร้างลายนิ้วมือรูปภาพ (MD5)
const getBufferHash = (buffer) =>
    crypto.createHash("md5").update(buffer).digest("hex");

const downloadImage = async (url) => {
    try {
        const response = await axios({
            url,
            method: "GET",
            responseType: "arraybuffer",
            timeout: 8000,
        });
        return Buffer.from(response.data);
    } catch (e) {
        return null;
    }
};

// --- ส่วนที่ 1: ล้างข้อมูลที่ซ้ำกันใน Database (Cleanup) ---
const cleanDuplicatesInDB = async () => {
    console.log("🧹 กำลังตรวจสอบและลบรูปที่ซ้ำกันในฐานข้อมูล...");

    // ค้นหา ID ของรูปที่ซ้ำกันโดยดูจาก image_hash (เก็บไว้แค่ตัวที่เก่าที่สุด)
    const [duplicates] = await pool.query(`
        SELECT id, image FROM memes
        WHERE image_hash IN (
            SELECT image_hash FROM memes GROUP BY image_hash HAVING COUNT(*) > 1
        ) AND id NOT IN (
            SELECT MIN(id) FROM memes GROUP BY image_hash
        )
    `);

    for (const row of duplicates) {
        const filePath = path.join(__dirname, "uploads", row.image);
        await pool.query("DELETE FROM memes WHERE id = ?", [row.id]);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    console.log(`✅ ล้างข้อมูลซ้ำเสร็จสิ้น: ลบออกไป ${duplicates.length} รายการ`);
};

// --- ส่วนที่ 2: เริ่มการดูดข้อมูลใหม่ ---
const runScraper = async () => {
    // ล้างของเก่าก่อนรัน
    await cleanDuplicatesInDB();

    console.log(
        `\n🚀 เริ่มดึงมีมใหม่จากทั่วโลก (เป้าหมาย: ${TARGET_TOTAL} รูป)...`,
    );
    let totalSuccess = 0;
    let attempts = 0;
    const subList = Object.keys(SUBREDDIT_MAP);

    while (totalSuccess < TARGET_TOTAL && attempts < 50) {
        attempts++;
        const randomSub = subList[Math.floor(Math.random() * subList.length)];
        console.log(`📦 Batch ${attempts}: กำลังค้นหาใน r/${randomSub}...`);

        try {
            const apiUrl = `https://meme-api.com/gimme/${randomSub}/${BATCH_SIZE}`;
            const { data } = await axios.get(apiUrl);

            for (const meme of data.memes) {
                if (totalSuccess >= TARGET_TOTAL) break;
                if (meme.nsfw) continue;

                // ดาวน์โหลดมาเพื่อเช็คความซ้ำซ้อนจากเนื้อหาไฟล์จริง
                const imageBuffer = await downloadImage(meme.url);
                if (!imageBuffer) continue;

                const hash = getBufferHash(imageBuffer);

                // 🔍 เช็คซ้ำ: ถ้ามี Hash นี้ใน DB แล้ว ให้ข้ามทันที
                const [exists] = await pool.query(
                    "SELECT id FROM memes WHERE image_hash = ? OR title = ?",
                    [hash, meme.title],
                );
                if (exists.length > 0) {
                    process.stdout.write("s"); // Skip
                    continue;
                }

                const category = SUBREDDIT_MAP[meme.subreddit] || "General";
                const ext = path.extname(meme.url) || ".jpg";
                const filename = `${uuidv4()}${ext}`;
                const savePath = path.join(__dirname, "uploads", filename);

                // บันทึกไฟล์และลงฐานข้อมูล
                fs.writeFileSync(savePath, imageBuffer);
                await pool.query(
                    "INSERT INTO memes (title, image, category, created_by, likes, image_hash) VALUES (?, ?, ?, ?, ?, ?)",
                    [meme.title, filename, category, BOT_USER_ID, meme.ups || 0, hash],
                );

                totalSuccess++;
                console.log(
                    `\n✅ [${totalSuccess}/${TARGET_TOTAL}] บันทึก: ${meme.title.substring(0, 30)}...`,
                );
            }
        } catch (err) {
            console.log("⚠️ เกิดข้อผิดพลาดใน Batch นี้ กำลังข้ามไป...");
        }
        // พักเครื่อง 1 วินาทีกันโดนแบน IP
        await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(`\n🎉 ภารกิจสำเร็จ! เพิ่มมีมใหม่ทั้งหมด ${totalSuccess} รูป`);
    process.exit(0);
};

runScraper();
