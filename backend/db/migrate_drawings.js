const { Pool } = require('pg');
require('dotenv').config();

async function migrateDrawings() {
  const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
  });
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS drawings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) DEFAULT '',
      description TEXT DEFAULT '',
      shape_type VARCHAR(20) NOT NULL CHECK (shape_type IN ('marker', 'polyline', 'polygon')),
      coordinates JSONB NOT NULL,
      color VARCHAR(20) DEFAULT '#1b4332',
      stroke_width INTEGER DEFAULT 3,
      fill_opacity DECIMAL(3,2) DEFAULT 0.2,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );`);
    console.log('Table "drawings" created successfully.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateDrawings();
