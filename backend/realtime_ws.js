const jwt = require('jsonwebtoken');
let ioRef = null;

function setupRealtime(io) {
  ioRef = io;
  io.on('connection', (socket) => {
    const authToken = socket.handshake?.auth?.token;
    if (authToken) {
      try {
        const payload = jwt.verify(authToken, process.env.JWT_SECRET || 'devsecret');
        socket.data.userId = String(payload.id);
        socket.join(`user:${socket.data.userId}`);
      } catch (e) {}
    }
    socket.on('join:thread', (threadId) => { if (threadId) socket.join(`thread:${threadId}`); });
    socket.on('leave:thread', (threadId) => { if (threadId) socket.leave(`thread:${threadId}`); });
  });
}

function emitToUser(userId, event, payload) {
  if (!ioRef) return;
  ioRef.to(`user:${String(userId)}`).emit(event, payload);
}

function emitToThread(threadId, event, payload) {
  if (!ioRef) return;
  ioRef.to(`thread:${String(threadId)}`).emit(event, payload);
}

module.exports = { setupRealtime, emitToUser, emitToThread };
