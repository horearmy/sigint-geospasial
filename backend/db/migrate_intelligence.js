const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS intelligence (
      id SERIAL PRIMARY KEY,
      kategori VARCHAR(100) NOT NULL,
      subkategori VARCHAR(100),
      judul VARCHAR(500) NOT NULL,
      deskripsi TEXT,
      sumber VARCHAR(255),
      sumber_url VARCHAR(500),
      ancaman_level INT DEFAULT 1,
      lokasi_nama VARCHAR(255),
      koordinat GEOGRAPHY(POINT, 4326),
      tags TEXT[],
      status VARCHAR(20) DEFAULT 'baru',
      reported_by INT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_intel_kategori ON intelligence(kategori);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_intel_created ON intelligence(created_at DESC);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_intel_koordinat ON intelligence USING GIST(koordinat);');
  console.log('Table intelligence created!');
  await pool.end();
}

migrate().catch(e => { console.error(e.message); process.exit(1); });
