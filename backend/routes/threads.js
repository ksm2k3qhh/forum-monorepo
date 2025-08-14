const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Thread = require('../models/Thread');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authOptional, authRequired, requireAdmin } = require('../middleware/auth');
const { emitToThread, emitToUser } = require('../realtime_ws');

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many actions, please slow down.' }
});

router.use(authOptional);

router.get('/', async (req, res) => {
  try {
    const threads = await Thread.find({}, { replies: 0 }).sort({ createdAt: -1 });
    const list = threads.map(t => ({
      _id: t._id, title: t.title, author: t.author, createdAt: t.createdAt, replyCount: t.replies?.length ?? 0
    }));
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authRequired, writeLimiter, async (req, res) => {
  try {
    if (req.body?.hp) return res.status(400).json({ error: 'Spam detected' });
    const { title, content } = req.body;
    let { author } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Missing fields' });
    if (req.user?.username) author = req.user.username;
    const thread = await Thread.create({ title, content, author });
    res.status(201).json(thread);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id);
    if (!thread) return res.status(404).json({ error: 'Not found' });
    res.json(thread);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

function extractMentions(text) {
  if (!text) return [];
  const set = new Set();
  const re = /@([a-zA-Z0-9_]{2,30})/g;
  let m; while ((m = re.exec(text))) set.add(m[1]);
  return Array.from(set);
}

router.post('/:id/replies', authRequired, writeLimiter, async (req, res) => {
  try {
    if (req.body?.hp) return res.status(400).json({ error: 'Spam detected' });
    let { author, content, parentReplyId } = req.body;
    if (!content) return res.status(400).json({ error: 'Missing content' });
    if (req.user?.username) author = req.user.username;
    const thread = await Thread.findById(req.params.id);
    if (!thread) return res.status(404).json({ error: 'Not found' });
    thread.replies.push({ author, content, parentReplyId: parentReplyId || null });
    await thread.save();

    // Mentions + parent author notify
    try {
      const mentions = new Set(extractMentions(content));
      if (parentReplyId) {
        const parent = thread.replies.id(parentReplyId);
        if (parent && parent.author && parent.author !== 'anonymous') {
          mentions.add(String(parent.author));
        }
      }
      if (mentions.size > 0) {
        const users = await User.find({ username: { $in: Array.from(mentions) } });
        for (const u of users) {
          if (!req.user || String(u._id) === String(req.user.id)) continue;
          await Notification.create({
            toUserId: u._id,
            fromUserId: req.user?.id,
            threadId: thread._id,
            replyId: thread.replies[thread.replies.length - 1]._id,
            message: `${req.user?.username || author} mentioned you in a reply`,
          });
          try { emitToUser(u._id, 'notification:new', {}); } catch {}
        }
      }
    } catch (e) {}

    try { emitToThread(thread._id, 'reply:new', { threadId: String(thread._id) }); } catch {}
    res.status(201).json(thread);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id/replies/:replyId', authRequired, requireAdmin, async (req, res) => {
  try {
    const { id, replyId } = req.params;
    const thread = await Thread.findById(id);
    if (!thread) return res.status(404).json({ error: 'Not found' });

    const toDelete = new Set([String(replyId)]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const r of thread.replies) {
        if (r.parentReplyId && toDelete.has(String(r.parentReplyId))) {
          const s = String(r._id);
          if (!toDelete.has(s)) { toDelete.add(s); changed = true; }
        }
      }
    }
    thread.replies = thread.replies.filter(r => !toDelete.has(String(r._id)));
    await thread.save();
    try { emitToThread(thread._id, 'reply:deleted', { threadId: String(thread._id) }); } catch {}
    res.json({ ok: true, deletedCount: toDelete.size });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
