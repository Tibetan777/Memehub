const mysql = require('mysql2/promise');

async function migrateTables() {
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
    console.log('Starting database migration...\n');
    const conn = await pool.getConnection();
    
    // 1. Add role column to members if it doesn't exist
    const [cols1] = await conn.execute(`
      SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'members' AND COLUMN_NAME = 'role'
    `);
    
    if (cols1[0].cnt === 0) {
      await conn.execute(`ALTER TABLE members ADD COLUMN role VARCHAR(20) DEFAULT 'user'`);
      console.log('✓ Added role column to members table');
    } else {
      console.log('✓ role column already exists');
    }
    
    // 2. Add is_banned column to members
    const [cols2] = await conn.execute(`
      SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'members' AND COLUMN_NAME = 'is_banned'
    `);
    
    if (cols2[0].cnt === 0) {
      await conn.execute(`ALTER TABLE members ADD COLUMN is_banned BOOLEAN DEFAULT 0`);
      console.log('✓ Added is_banned column to members table');
    } else {
      console.log('✓ is_banned column already exists');
    }
    
    // 3. Recreate memes table with all fields
    try {
      await conn.execute('DROP TABLE IF EXISTS memes');
      console.log('✓ Dropped old memes table');
    } catch (e) {
      console.log('✓ Old memes table cleanup (might not exist)');
    }
    
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS memes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT DEFAULT '',
        image LONGBLOB NOT NULL,
        category VARCHAR(50) DEFAULT 'อื่นๆ',
        likes INT DEFAULT 0,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES members(id_mem) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created memes table with proper structure');
    
    // 4. Set admin user (first user)
    await conn.execute(`UPDATE members SET role = 'admin' WHERE id_mem = 1`);
    console.log('✓ Set ID 1 (James) as admin');
    
    // 5. Verify schema
    const [memesSchema] = await conn.execute('DESCRIBE memes');
    const [membersSchema] = await conn.execute('DESCRIBE members');
    
    console.log('\nMemes table structure:');
    memesSchema.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });
    
    console.log('\nMembers table new columns:');
    ['role', 'is_banned', 'password_encrypted'].forEach(colName => {
      const col = membersSchema.find(c => c.Field === colName);
      if (col) console.log(`  - ${col.Field}: ${col.Type}`);
    });
    
    conn.release();
    console.log('\n✓ Migration complete!');
    process.exit(0);
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

migrateTables();
