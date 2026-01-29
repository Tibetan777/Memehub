const mysql = require('mysql2/promise');
const zlib = require('zlib');

// Create a simple valid PNG programmatically
function createPNG(width, height, color) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk (image header)
  const ihdr = createChunk('IHDR', Buffer.concat([
    Buffer.from([0, 0, 0, width]),  // width
    Buffer.from([0, 0, 0, height]), // height
    Buffer.from([8, 2, 0, 0, 0])    // bit depth, color type, compression, filter, interlace
  ]));
  
  // IDAT chunk (image data) - simple single color
  const pixelData = Buffer.alloc(height * (1 + width * 3));
  let pos = 0;
  for (let y = 0; y < height; y++) {
    pixelData[pos++] = 0; // filter type
    for (let x = 0; x < width; x++) {
      pixelData[pos++] = color.r;
      pixelData[pos++] = color.g;
      pixelData[pos++] = color.b;
    }
  }
  
  const compressedData = zlib.deflateSync(pixelData);
  const idat = createChunk('IDAT', compressedData);
  
  // IEND chunk (image end)
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

// Meme titles and descriptions
const MEMES = [
  { title: 'Drake Meme', desc: 'Drake pointing' },
  { title: 'Distracted Boyfriend', desc: 'Boyfriend looking at other woman' },
  { title: 'Woman Yelling at Cat', desc: 'Woman yelling, cat confused' },
  { title: 'This is Fine', desc: 'Dog in burning room' },
  { title: 'Expanding Brain', desc: 'Expanding brain meme' },
  { title: 'Panik Kalm', desc: 'Panik Kalm meme' },
  { title: 'Stonks', desc: 'Stonks man pointing' },
  { title: 'Confused Math', desc: 'Math lady looking confused' },
  { title: 'Success Kid', desc: 'Fist pumping baby' },
  { title: 'Bad Luck Brian', desc: 'Red tuxedo guy' },
  { title: 'First World Problems', desc: 'Crying rich man' },
  { title: 'Grumpy Cat', desc: 'Angry cat' },
  { title: 'Hide the Pain Harold', desc: 'Smiling old man' },
  { title: 'Wojak', desc: 'Wojak face' },
  { title: 'Loss', desc: 'Loss meme comic' },
  { title: 'Mocking SpongeBob', desc: 'SpongeBob mocking text' },
  { title: 'Troll Face', desc: 'Internet troll face' },
  { title: 'Forever Alone', desc: 'Alone forever' },
  { title: 'Okay Face', desc: 'Okay meme face' },
  { title: 'Y U NO', desc: 'Y U NO meme' },
];

const CATEGORIES = ['ตลกๆ', 'น่ารัก', 'หลอน', 'มีจริง', 'อื่นๆ'];
const COLORS = [
  { r: 102, g: 126, b: 234 },
  { r: 118, g: 75, b: 162 },
  { r: 244, g: 114, b: 182 },
  { r: 59, g: 130, b: 246 },
  { r: 16, g: 185, b: 129 },
  { r: 249, g: 115, b: 22 },
  { r: 139, g: 92, b: 246 },
  { r: 236, g: 72, b: 153 },
  { r: 14, g: 184, b: 166 },
  { r: 239, g: 68, b: 68 },
];

async function seedMemes() {
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
    console.log('Generating 250+ colorful memes...\n');
    
    const conn = await pool.getConnection();
    
    let count = 0;
    const adminId = 1; // James
    
    // Generate approximately 250 memes
    for (let batch = 0; batch < 13; batch++) {
      for (const meme of MEMES) {
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        
        // Create PNG image
        const imageBuffer = createPNG(200, 200, color);
        
        // Random timestamp in past 60 days
        const daysAgo = Math.floor(Math.random() * 60);
        const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        
        const title = `${meme.title} #${batch + 1}`;
        
        await conn.execute(
          'INSERT INTO memes (title, description, image, category, likes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [title, meme.desc, imageBuffer, category, Math.floor(Math.random() * 150), adminId, timestamp]
        );
        
        count++;
        if (count % 25 === 0) {
          process.stdout.write(`\r✓ Generated ${count} memes...`);
        }
      }
    }
    
    console.log(`\n\n✓ Successfully created ${count} memes in database!\n`);
    
    // Verify
    const [result] = await conn.execute('SELECT COUNT(*) as cnt, SUM(LENGTH(image)) as total FROM memes');
    console.log(`Database stats:`);
    console.log(`  - Total memes: ${result[0].cnt}`);
    console.log(`  - Total image data: ${(result[0].total / 1024 / 1024).toFixed(2)} MB`);
    
    conn.release();
    process.exit(0);
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

seedMemes();
