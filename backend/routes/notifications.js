const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authRequired } = require('../middleware/auth');
const { emitToUser } = require('../realtime_ws');

// Lấy danh sách thông báo của user (mới nhất trước)
router.get('/', authRequired, async (req, res) => {
  try {
    const list = await Notification
      .find({ toUserId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Đếm chưa đọc
router.get('/unread-count', authRequired, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ toUserId: req.user.id, read: false });
    res.json({ count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Đánh dấu đã đọc 1 cái
router.post('/:id/read', authRequired, async (req, res) => {
  try {
    const r = await Notification.updateOne(
      { _id: req.params.id, toUserId: req.user.id },
      { $set: { read: true } }
    );
    const unread = await Notification.countDocuments({ toUserId: req.user.id, read: false });
    try { emitToUser(req.user.id, 'notifications:updated', { unread }); } catch {}
    res.json({ ok: true, matched: r.matchedCount ?? r.n, modified: r.modifiedCount ?? r.nModified, unread });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Đánh dấu đã đọc tất cả
router.post('/read-all', authRequired, async (req, res) => {
  try {
    const r = await Notification.updateMany(
      { toUserId: req.user.id, read: false },
      { $set: { read: true } }
    );
    try { emitToUser(req.user.id, 'notifications:updated', { unread: 0 }); } catch {}
    res.json({ ok: true, modified: r.modifiedCount ?? r.nModified });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ❗ XÓA 1 THÔNG BÁO (xoá trong DB)
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const r = await Notification.deleteOne({ _id: req.params.id, toUserId: req.user.id });
    const unread = await Notification.countDocuments({ toUserId: req.user.id, read: false });
    try { emitToUser(req.user.id, 'notifications:updated', { unread }); } catch {}
    res.json({ ok: true, deleted: r.deletedCount, unread });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ❗ XÓA NHIỀU (bulk) — khớp với frontend hiện tại: POST /notifications/bulk-delete { ids: [...] }
router.post('/bulk-delete', authRequired, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : [];
    if (!ids.length) return res.status(400).json({ error: 'ids required' });

    const r = await Notification.deleteMany({ _id: { $in: ids }, toUserId: req.user.id });
    const unread = await Notification.countDocuments({ toUserId: req.user.id, read: false });
    try { emitToUser(req.user.id, 'notifications:updated', { unread }); } catch {}
    res.json({ ok: true, deleted: r.deletedCount, unread });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Alias tương thích: POST /notifications/delete { ids: [...] } => dùng chung bulk-delete
router.post('/delete', authRequired, async (req, res) => {
  req.url = '/bulk-delete';
  router.handle(req, res);
});

module.exports = router;
