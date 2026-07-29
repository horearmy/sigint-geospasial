const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const pool = require('../db/pool');
const { authMiddleware, roleMiddleware, JWT_SECRET } = require('../middleware/auth');

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

function validatePasswordStrength(password) {
  if (password.length < 8) return 'Password minimal 8 karakter';
  if (!/[A-Z]/.test(password)) return 'Password harus mengandung huruf besar';
  if (!/[a-z]/.test(password)) return 'Password harus mengandung huruf kecil';
  if (!/[0-9]/.test(password)) return 'Password harus mengandung angka';
  return null;
}

function setAuthCookies(res, user) {
  const accessToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRY, algorithm: 'HS256' }
  );
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRY, algorithm: 'HS256' }
  );
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOpts = (maxAge) => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
    maxAge,
  });
  res.cookie('access_token', accessToken, cookieOpts(15 * 60 * 1000));
  res.cookie('refresh_token', refreshToken, cookieOpts(7 * 24 * 60 * 60 * 1000));
  return { accessToken, refreshToken };
}

function clearAuthCookies(res) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Username, email, dan password wajib diisi' });
    }
    const strengthErr = validatePasswordStrength(password);
    if (strengthErr) {
      return res.status(400).json({ success: false, error: strengthErr });
    }
    if (username.length < 4) {
      return res.status(400).json({ success: false, error: 'Username minimal 4 karakter' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Email tidak valid' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Username atau email sudah terdaftar' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'viewer')
       RETURNING id, username, email, full_name, role, avatar_url, pangkat, nrp, jabatan, satuan, created_at`,
      [username, email, password_hash, full_name || '']
    );

    const user = result.rows[0];
    const { accessToken } = setAuthCookies(res, user);

    res.status(201).json({ success: true, data: { user, token: accessToken } });
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

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({ success: false, error: `Akun terkunci, coba lagi dalam ${minutesLeft} menit` });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000);
        await pool.query('UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3', [attempts, lockUntil, user.id]);
        return res.status(423).json({ success: false, error: `Akun terkunci karena ${MAX_FAILED_ATTEMPTS} percobaan gagal. Coba lagi dalam ${LOCKOUT_MINUTES} menit` });
      }
      await pool.query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [attempts, user.id]);
      return res.status(401).json({ success: false, error: 'Username atau password salah' });
    }

    await pool.query('UPDATE users SET last_login = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);

    const { accessToken } = setAuthCookies(res, user);

    delete user.password_hash;
    delete user.failed_login_attempts;
    delete user.locked_until;
    res.json({ success: true, data: { user, token: accessToken } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Gagal login' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Refresh token tidak ditemukan' });
    }
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, error: 'Refresh token tidak valid atau expired' });
    }
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, error: 'Token tipe tidak valid' });
    }

    const result = await pool.query('SELECT id, username, role, is_active FROM users WHERE id = $1 AND is_active = true', [decoded.id]);
    if (result.rows.length === 0) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, error: 'User tidak ditemukan atau tidak aktif' });
    }

    const user = result.rows[0];
    const { accessToken } = setAuthCookies(res, user);
    res.json({ success: true, data: { token: accessToken } });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ success: false, error: 'Gagal refresh token' });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true, message: 'Logout berhasil' });
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, role, avatar_url, pangkat, nrp, jabatan, satuan, is_active, last_login, created_at FROM users WHERE id = $1',
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

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { full_name, email, avatar_url, pangkat, nrp, jabatan, satuan } = req.body;
    const result = await pool.query(
      `UPDATE users SET
        full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        avatar_url = COALESCE($3, avatar_url),
        pangkat = COALESCE($4, pangkat),
        nrp = COALESCE($5, nrp),
        jabatan = COALESCE($6, jabatan),
        satuan = COALESCE($7, satuan)
       WHERE id = $8
       RETURNING id, username, email, full_name, role, avatar_url, pangkat, nrp, jabatan, satuan, created_at`,
      [full_name, email, avatar_url, pangkat, nrp, jabatan, satuan, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ success: false, error: 'Gagal update profile' });
  }
});

router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, error: 'Password lama dan baru wajib diisi' });
    }
    const strengthErr = validatePasswordStrength(new_password);
    if (strengthErr) {
      return res.status(400).json({ success: false, error: strengthErr });
    }

    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
    }

    const valid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Password lama salah' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ success: false, error: 'Gagal mengubah password' });
  }
});

router.get('/users', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, role, avatar_url, pangkat, nrp, jabatan, satuan, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
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
    const validRoles = ['admin', 'analis', 'operator', 'lapangan', 'viewer'];
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

router.post('/create-admin', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { username, email, password, full_name, secret } = req.body;
    if (!process.env.ADMIN_SECRET) {
      return res.status(500).json({ success: false, error: 'ADMIN_SECRET belum dikonfigurasi' });
    }
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, error: 'Secret tidak valid' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Username atau email sudah ada' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password minimal 8 karakter' });
    }
    const strengthErr = validatePasswordStrength(password);
    if (strengthErr) {
      return res.status(400).json({ success: false, error: strengthErr });
    }
    if (!username || username.length < 4) {
      return res.status(400).json({ success: false, error: 'Username minimal 4 karakter' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Email tidak valid' });
    }

    const password_hash = await bcrypt.hash(password, 12);
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

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Hanya file gambar yang diizinkan'));
  },
});

router.post('/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'File avatar tidak ditemukan' });
    const avatar_url = `/uploads/${req.file.filename}`;
    const result = await pool.query(
      `UPDATE users SET avatar_url = $1 WHERE id = $2
       RETURNING id, username, email, full_name, role, avatar_url, pangkat, nrp, jabatan, satuan, created_at`,
      [avatar_url, req.user.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Upload avatar error:', err);
    res.status(500).json({ success: false, error: 'Gagal upload avatar' });
  }
});

module.exports = router;
