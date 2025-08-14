const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ error: 'Username already exists' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash, role: role === 'admin' ? 'admin' : 'user' });
    res.status(201).json({ id: user._id, username: user.username, role: user.role });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, role: user.role } });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/me', authRequired, async (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

router.post('/seed-admin', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Forbidden' });
  try {
    const { username='admin', password='admin123' } = req.body || {};
    let user = await User.findOne({ username });
    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await User.create({ username, passwordHash, role: 'admin' });
    }
    res.json({ id: user._id, username: user.username, role: user.role });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
