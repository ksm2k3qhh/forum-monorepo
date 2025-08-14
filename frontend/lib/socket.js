import { API_URL } from './api';

let socketPromise = null;

export async function getSocket() {
  if (typeof window === 'undefined') return null;
  if (!socketPromise) {
    socketPromise = (async () => {
      const { io } = await import('socket.io-client');
      const token = localStorage.getItem('token');
      const s = io(API_URL, {
        autoConnect: !!token,
        auth: token ? { token } : {},
        transports: ['websocket']
      });
      return s;
    })();
  }
  return socketPromise;
}

export async function ensureConnected() {
  const s = await getSocket();
  if (!s) return null;
  if (!s.connected) s.connect();
  const token = localStorage.getItem('token');
  if (token) s.auth = { token };
  return s;
}
