const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema(
  {
    author:  { type: String, default: 'anonymous' },
    content: { type: String, required: true },
    parentReplyId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

const ThreadSchema = new mongoose.Schema(
  {
    title:   { type: String, required: true },
    content: { type: String, required: true },
    author:  { type: String, default: 'anonymous' },
    replies: [ReplySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Thread', ThreadSchema);
