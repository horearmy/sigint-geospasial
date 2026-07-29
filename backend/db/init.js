const { Pool } = require('pg');
require('dotenv').config();

async function initDatabase() {
  const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
  });
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');

    await client.query(`CREATE TABLE IF NOT EXISTS laporan (
      id SERIAL PRIMARY KEY, judul VARCHAR(255) NOT NULL, deskripsi TEXT,
      kategori VARCHAR(100) NOT NULL, lokasi_nama VARCHAR(255),
      koordinat GEOGRAPHY(POINT, 4326) NOT NULL,       gambar VARCHAR(500),
      signature_url VARCHAR(500), signed_by INT REFERENCES users(id), signed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    );`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_laporan_koordinat ON laporan USING GIST(koordinat);');

    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL, full_name VARCHAR(100), role VARCHAR(20) NOT NULL DEFAULT 'viewer',
      avatar_url VARCHAR(500), pangkat VARCHAR(100) DEFAULT '', nrp VARCHAR(50) DEFAULT '',
      jabatan VARCHAR(200) DEFAULT '', satuan VARCHAR(200) DEFAULT '',
      is_active BOOLEAN DEFAULT true, last_login TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()
    );`);

    await client.query(`CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY, laporan_id INT REFERENCES laporan(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id), content TEXT NOT NULL,
      parent_id INT REFERENCES comments(id),
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    );`);

    await client.query(`CREATE TABLE IF NOT EXISTS threat_zones (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, zone_type VARCHAR(50) NOT NULL,
      risk_level INT DEFAULT 1, boundary GEOGRAPHY(POLYGON, 4326) NOT NULL,
      description TEXT, created_by INT REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW()
    );`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_zones_boundary ON threat_zones USING GIST(boundary);');

    await client.query(`CREATE TABLE IF NOT EXISTS alert_rules (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, condition_type VARCHAR(50) NOT NULL,
      threshold INT NOT NULL DEFAULT 5, radius_meters INT DEFAULT 5000,
      center_point GEOGRAPHY(POINT, 4326), is_active BOOLEAN DEFAULT true,
      created_by INT REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW()
    );`);

    await client.query(`CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL, message TEXT, related_id INT,
      is_read BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW()
    );`);

    await client.query(`CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY, user_id INT REFERENCES users(id),
      action VARCHAR(50) NOT NULL, resource VARCHAR(100),
      details JSONB, ip_address INET, timestamp TIMESTAMP DEFAULT NOW()
    );`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);');

    await client.query(`CREATE TABLE IF NOT EXISTS tracking_positions (
      id BIGSERIAL PRIMARY KEY, user_id INT REFERENCES users(id),
      location GEOGRAPHY(POINT, 4326) NOT NULL,
      speed FLOAT DEFAULT 0, heading FLOAT DEFAULT 0, accuracy FLOAT DEFAULT 0,
      recorded_at TIMESTAMP DEFAULT NOW()
    );`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_tracking_user ON tracking_positions(user_id, recorded_at DESC);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tracking_location ON tracking_positions USING GIST(location);');

    await client.query(`CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY, nama_satuan VARCHAR(255) NOT NULL,
      deskripsi TEXT, lokasi_nama VARCHAR(255),
      koordinat GEOGRAPHY(POINT, 4326),
      lambang_url VARCHAR(500), created_by INT REFERENCES users(id),
      parent_id INT REFERENCES units(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );`);
    // Add lokasi_nama column if missing (safe for existing tables)
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='units' AND column_name='lokasi_nama') THEN
        ALTER TABLE units ADD COLUMN lokasi_nama VARCHAR(255);
      END IF;
    END $$;`);
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='units' AND column_name='parent_id') THEN
        ALTER TABLE units ADD COLUMN parent_id INT REFERENCES units(id) ON DELETE SET NULL;
      END IF;
    END $$;`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_units_koordinat ON units USING GIST(koordinat);');

    await client.query(`CREATE TABLE IF NOT EXISTS form_templates (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, kategori VARCHAR(100) NOT NULL,
      fields JSONB NOT NULL, description TEXT,
      created_by INT REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW()
    );`);

    await client.query(`CREATE TABLE IF NOT EXISTS laporan_workflow (
      id SERIAL PRIMARY KEY, laporan_id INT REFERENCES laporan(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      submitted_by INT REFERENCES users(id), reviewed_by INT REFERENCES users(id),
      reviewer_note TEXT,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    );`);

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

    await client.query(`CREATE TABLE IF NOT EXISTS intelligence (
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
    );`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_intel_kategori ON intelligence(kategori);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_intel_created ON intelligence(created_at DESC);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_intel_koordinat ON intelligence USING GIST(koordinat);');

    // Seed main units if none exist
    const unitCount = await client.query('SELECT COUNT(*) FROM units');
    if (parseInt(unitCount.rows[0].count) === 0) {
      const mainUnits = ['MAKOSTRAD', 'DIVISI 1 KOSTRAD', 'DIVISI 2 KOSTRAD', 'DIVISI 3 KOSTRAD'];
      for (const name of mainUnits) {
        await client.query(
          'INSERT INTO units (nama_satuan, deskripsi) VALUES ($1, $2)',
          [name, `Unit utama ${name}`]
        );
      }
      console.log('Main units seeded successfully!');
    }

    console.log('All tables created successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase().catch(err => { console.error('Database init failed:', err); process.exit(1); });
