const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Thread' },
  replyId: { type: mongoose.Schema.Types.ObjectId },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
