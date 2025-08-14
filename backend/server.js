require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const { setupRealtime } = require('./realtime_ws');

const app = express();

app.use(cors({
  origin: function(origin, callback) {
    const allowed = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const isLocal = origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (!origin) return callback(null, true);
    if (!process.env.CORS_ORIGIN) return callback(null, true);
    if (allowed.includes(origin) || isLocal) return callback(null, true);
    return callback(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true
}));
app.options('*', cors());

app.use(express.json());
app.use(morgan('dev'));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/faqs', require('./routes/faqs'));
app.use('/api/threads', require('./routes/threads'));
app.use('/api/notifications', require('./routes/notifications'));

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000' } });
setupRealtime(io);
server.listen(PORT, () => console.log(`✅ API + WS running http://localhost:${PORT}`));
