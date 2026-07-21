const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

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

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const PORT = process.env.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, message: { success: false, error: 'Terlalu banyak request' } });
app.use('/api/', limiter);

app.use((req, res, next) => {
  req.io = io;
  req.ip_addr = req.ip;
  next();
});

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

app.use((err, req, res, next) => {
  if (err instanceof require('multer').MulterError) {
    return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
  }
  if (err.message) return res.status(400).json({ success: false, error: err.message });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

server.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
