const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { authMiddleware, roleMiddleware, JWT_SECRET } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Username, email, dan password wajib diisi' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password minimal 6 karakter' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Username atau email sudah terdaftar' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'viewer')
       RETURNING id, username, email, full_name, role, created_at`,
      [username, email, password_hash, full_name || '']
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({ success: true, data: { user, token } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Gagal mendaftar' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username dan password wajib diisi' });
    }

    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND is_active = true', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    delete user.password_hash;
    res.json({ success: true, data: { user, token } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Gagal login' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, role, avatar_url, is_active, last_login, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal mengambil data user' });
  }
});

router.get('/users', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal mengambil data users' });
  }
});

router.put('/users/:id/role', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const validRoles = ['admin', 'analis', 'operator', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Role tidak valid' });
    }
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, email, full_name, role',
      [role, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal update role' });
  }
});

router.put('/users/:id/toggle-active', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING id, username, is_active',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal update status user' });
  }
});

router.post('/create-admin', async (req, res) => {
  try {
    const { username, email, password, full_name, secret } = req.body;
    if (secret !== (process.env.ADMIN_SECRET || 'sigint-admin-2024')) {
      return res.status(403).json({ success: false, error: 'Secret tidak valid' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Username sudah ada' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'admin')
       RETURNING id, username, email, full_name, role`,
      [username, email, password_hash, full_name || '']
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ success: false, error: 'Gagal membuat admin' });
  }
});

module.exports = router;
