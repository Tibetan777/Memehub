const mysql = require('mysql2/promise');

(async () => {
  try {
    const pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'Narongrit'
    });
    
    const conn = await pool.getConnection();
    
    // Check total memes
    const [count] = await conn.execute('SELECT COUNT(*) as total FROM memes');
    console.log(`Total memes: ${count[0].total}`);
    
    // Check sample images
    const [samples] = await conn.execute('SELECT id, title, LENGTH(image) as img_size FROM memes LIMIT 5');
    console.log('\nSample memes with image sizes:');
    samples.forEach(r => {
      console.log(`  ID ${r.id}: "${r.title}" - ${r.img_size} bytes`);
    });
    
    // Check if any have null images
    const [nullCount] = await conn.execute('SELECT COUNT(*) as null_count FROM memes WHERE image IS NULL');
    console.log(`\nMemes with NULL image: ${nullCount[0].null_count}`);
    
    // Check actual image data from ID 1
    const [actualImage] = await conn.execute('SELECT LENGTH(image) as size FROM memes WHERE id = 1');
    if (actualImage[0]) {
      console.log(`\nMeme ID 1 image size: ${actualImage[0].size} bytes`);
    }
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
