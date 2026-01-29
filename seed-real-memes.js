import mysql from 'mysql2/promise';
import fetch from 'node-fetch'; // ต้องลงตัวนี้เพิ่มนิดนึง

// ตั้งค่า Database (ให้ตรงกับ server.js)
const pool = mysql.createPool({
host: 'localhost',
user: 'root',
password: '',
database: 'Narongrit',
connectionLimit: 10
});

async function seedRealMemes() {
console.log('🚀 กำลังเริ่มดูดมีมจาก Imgflip...');

try {
    // 1. ดึงข้อมูลมีมจาก API
    const response = await fetch('https://api.imgflip.com/get_memes');
    const data = await response.json();
    const memes = data.data.memes; // ได้รายการมีมมา 100 อัน

    // 2. เชื่อมต่อฐานข้อมูล
    const conn = await pool.getConnection();

    // เช็คว่ามี User ID 1 หรือยัง (ถ้าไม่มีจะสร้าง Admin ให้)
    const [users] = await conn.query('SELECT id_mem FROM members WHERE id_mem = 1');
    if (users.length === 0) {
    await conn.query(`
        INSERT INTO members (id_mem, name_mem, email_mem, password_mem, role) 
        VALUES (1, 'MemeAdmin', 'admin@memehub.com', '1234', 'admin')
    `);
    console.log('✅ สร้าง User Admin (ID: 1) เรียบร้อย');
    }

    console.log(`📦 เจอมีมทั้งหมด ${memes.length} รูป... กำลังทยอยโหลดและบันทึก...`);

    // 3. วนลูปโหลดรูปและบันทึก
    let successCount = 0;
    // เอาแค่ 50 รูปพอ (เดี๋ยวรอนาน)
    for (const meme of memes.slice(0, 50)) {
    try {
        // โหลดรูปภาพจริง
        const imgRes = await fetch(meme.url);
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // สุ่มหมวดหมู่
        const categories = ['Funny', 'Relatable', 'Dark Humor', 'Other'];
        const randomCat = categories[Math.floor(Math.random() * categories.length)];

        // ยัดลง Database
        await conn.execute(
        'INSERT INTO memes (title, image, category, created_by, likes) VALUES (?, ?, ?, ?, ?)',
          [meme.name, buffer, randomCat, 1, Math.floor(Math.random() * 100)]
        );

        process.stdout.write('.'); // แสดงจุดๆ เวลาโหลด
        successCount++;
    } catch (err) {
        console.error(`\n❌ ข้ามมีม "${meme.name}": ${err.message}`);
    }
    }

    conn.release();
    console.log(`\n\n🎉 เสร็จเรียบร้อย! นำเข้ามีมสำเร็จ ${successCount} รูป`);
    console.log('👉 เปิดเว็บ http://localhost:5173 ดูได้เลย!');
    process.exit(0);

} catch (err) {
    console.error('\n💥 เกิดข้อผิดพลาด:', err.message);
    process.exit(1);
}
}

seedRealMemes();