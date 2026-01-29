const mysql = require('mysql2/promise');

async function createLargerImages() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'Narongrit',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('Creating larger test images...\n');
    
    const conn = await pool.getConnection();
    
    // Create a 200x200 PNG (larger, more visible)
    function createLargePNG(color) {
      const width = 200;
      const height = 200;
      
      const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      
      const ihdr = createChunk('IHDR', Buffer.concat([
        Buffer.from([0, 0, 0, width]),
        Buffer.from([0, 0, 0, height]),
        Buffer.from([8, 2, 0, 0, 0])
      ]));
      
      // Create larger pixel data
      const zlib = require('zlib');
      const pixelData = Buffer.alloc(height * (1 + width * 3));
      let pos = 0;
      
      for (let y = 0; y < height; y++) {
        pixelData[pos++] = 0;
        for (let x = 0; x < width; x++) {
          pixelData[pos++] = color.r;
          pixelData[pos++] = color.g;
          pixelData[pos++] = color.b;
        }
      }
      
      const compressedData = zlib.deflateSync(pixelData);
      const idat = createChunk('IDAT', compressedData);
      const iend = createChunk('IEND', Buffer.alloc(0));
      
      return Buffer.concat([signature, ihdr, idat, iend]);
    }
    
    function createChunk(type, data) {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length, 0);
      
      const typeBuffer = Buffer.from(type);
      const crcData = Buffer.concat([typeBuffer, data]);
      const crc = calculateCRC(crcData);
      
      const crcBuffer = Buffer.alloc(4);
      crcBuffer.writeUInt32BE(crc >>> 0, 0);
      
      return Buffer.concat([length, typeBuffer, data, crcBuffer]);
    }
    
    function calculateCRC(data) {
      const table = [];
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
          c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
      }
      
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < data.length; i++) {
        crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }
    
    const colors = [
      { r: 255, g: 0, b: 0 },      // Red
      { r: 0, g: 255, b: 0 },      // Green
      { r: 0, g: 0, b: 255 },      // Blue
      { r: 255, g: 255, b: 0 },    // Yellow
      { r: 255, g: 0, b: 255 },    // Magenta
      { r: 0, g: 255, b: 255 },    // Cyan
      { r: 102, g: 126, b: 234 },  // Purple
      { r: 244, g: 114, b: 182 },  // Pink
      { r: 255, g: 165, b: 0 },    // Orange
      { r: 75, g: 192, b: 192 },   // Teal
    ];
    
    // Update first 50 memes with larger images
    for (let i = 1; i <= 50; i++) {
      const color = colors[i % colors.length];
      const imageBuffer = createLargePNG(color);
      
      await conn.execute('UPDATE memes SET image = ? WHERE id = ?', [imageBuffer, i]);
      
      if (i % 10 === 0) {
        console.log(`✓ Updated ${i} memes...`);
      }
    }
    
    console.log(`\n✓ Successfully created 50 larger images!`);
    
    // Verify
    const [result] = await conn.execute(
      'SELECT MIN(LENGTH(image)) as min_size, MAX(LENGTH(image)) as max_size, AVG(LENGTH(image)) as avg_size FROM memes LIMIT 1'
    );
    console.log(`\nImage sizes:`);
    console.log(`  Min: ${result[0].min_size} bytes`);
    console.log(`  Max: ${result[0].max_size} bytes`);
    console.log(`  Avg: ${Math.round(result[0].avg_size)} bytes`);
    
    conn.release();
    process.exit(0);
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

createLargerImages();
