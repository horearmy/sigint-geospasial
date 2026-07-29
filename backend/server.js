const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET tidak ditemukan di .env');
  process.exit(1);
}

const laporanRoutes = require('./routes/laporan');
const authRoutes = require('./routes/auth');
const commentRoutes = require('./routes/comments');
const zoneRoutes = require('./routes/zones');
const analysisRoutes = require('./routes/analysis');
const notificationRoutes = require('./routes/notifications');
const exportRoutes = require('./routes/export');
const timelineRoutes = require('./routes/timeline');
const auditRoutes = require('./routes/audit');
const osintRoutes = require('./routes/osint');
const trackingRoutes = require('./routes/tracking');
const workflowRoutes = require('./routes/workflow');
const imageryRoutes = require('./routes/imagery');
const predictiveRoutes = require('./routes/predictive');
const intelligenceRoutes = require('./routes/intelligence');
const drawingRoutes = require('./routes/drawings');
const securityRoutes = require('./routes/security');
const reportRoutes = require('./routes/reports');
const unitRoutes = require('./routes/units');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Socket.IO CORS blocked'));
      }
    },
    methods: ['GET', 'POST'],
  },
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Autentikasi gagal'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Token tidak valid'));
  }
});

const PORT = process.env.PORT || 5000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org", "https://server.arcgisonline.com"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS blocked'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use('/uploads', (req, res, next) => {
  if (req.path.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    return next();
  }
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.access_token;
  if (!token) return res.status(401).json({ success: false, error: 'Akses ditolak' });
  try {
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token tidak valid' });
  }
}, express.static(path.join(__dirname, 'uploads')));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, error: 'Terlalu banyak percobaan login, coba lagi dalam 15 menit' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 2000,
  message: { success: false, error: 'Terlalu banyak request, coba lagi nanti' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use((req, res, next) => {
  req.io = io;
  req.ip_addr = req.ip;
  next();
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/create-admin', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Terlalu banyak percobaan, coba lagi dalam 1 jam' },
  standardHeaders: true,
  legacyHeaders: false,
}));
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/laporan', laporanRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/osint', osintRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/imagery', imageryRoutes);
app.use('/api/predictive', predictiveRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/drawings', drawingRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/units', unitRoutes);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, 'user:', socket.user?.username);

  socket.on('join-room', (room) => {
    const validRooms = ['general', 'alerts', 'tracking'];
    if (typeof room === 'string' && validRooms.includes(room)) {
      socket.join(room);
    }
  });

  socket.on('leave-room', (room) => {
    const validRooms = ['general', 'alerts', 'tracking'];
    if (typeof room === 'string' && validRooms.includes(room)) {
      socket.leave(room);
    }
  });

  socket.on('tracking:publish', (data) => {
    if (socket.user) {
      socket.broadcast.emit('tracking:update', {
        ...data,
        user_id: socket.user.id,
        username: socket.user.username,
      });
    }
  });

  socket.on('chat:message', (data) => {
    if (socket.user && data && typeof data.text === 'string' && data.text.trim().length > 0 && data.text.length < 2000) {
      const room = (typeof data.room === 'string' && ['general', 'alerts', 'tracking'].includes(data.room)) ? data.room : 'general';
      io.to(room).emit('chat:message', {
        text: data.text.substring(0, 2000),
        room,
        username: socket.user.username,
        user_id: socket.user.id,
        timestamp: new Date().toISOString(),
      });
    }
  });

  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

io.emitLaporanEvent = (event, data) => {
  io.emit(`laporan:${event}`, data);
};

io.emitNotification = (userId, notification) => {
  io.emit('notification:new', { userId, ...notification });
};

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
  }
  if (err.message === 'CORS blocked' || err.message === 'Socket.IO CORS blocked') {
    return res.status(403).json({ success: false, error: 'Akses ditolak (CORS)' });
  }
  if (err.message === 'Autentikasi gagal' || err.message === 'Token tidak valid') {
    return res.status(401).json({ success: false, error: err.message });
  }
  if (err.message) {
    console.error('Request error:', err.message);
    return res.status(400).json({ success: false, error: 'Request tidak valid' });
  }
  res.status(500).json({ success: false, error: 'Internal server error' });
});

server.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
