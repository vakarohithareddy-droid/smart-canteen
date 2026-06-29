// ═══════════════════════════════════════════════════════════
//  server.js  —  SmartCanteen v3
//  Stack: Node.js · Express · MongoDB · Socket.IO · Nodemailer
//  Architecture: MVC (Model–View–Controller)
// ═══════════════════════════════════════════════════════════

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const dotenv     = require('dotenv');
const path       = require('path');

dotenv.config();

const connectDB = require('./config/db');
const app    = express();
const server = http.createServer(app);

// ── Socket.IO ────────────────────────────────────────────────
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Static frontend ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes (thin, delegate to controllers) ───────────────
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/menu',   require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/cart',   require('./routes/cart'));

// ── Fallback ─────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Socket.IO Events ─────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('join_user_room', (userId) => {
    socket.join('user_' + userId);
    console.log(`👤 User ${userId} joined their room`);
  });

  socket.on('join_admin_room', () => {
    socket.join('admin_room');
    console.log('🔑 Admin joined admin room');
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// ── Connect DB → Start Server ─────────────────────────────────
const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Socket.IO ready`);
    console.log(`✅ SmartCanteen ready`);
  });
});
