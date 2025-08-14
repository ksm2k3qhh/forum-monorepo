// frontend/lib/socket.js — rv1
import { io } from "socket.io-client";

let s;
export async function ensureConnected() {
  if (s && s.connected) return s;
  const URL = (process.env.NEXT_PUBLIC_SOCKET_ORIGIN || "").replace(/\/$/, "") || undefined;
  if (!URL) return null; // rv1: nếu không cấu hình, bỏ qua realtime
  s = io(URL, {
    path: "/socket.io",
    transports: ["websocket"],
    withCredentials: true,
  });
  return new Promise((resolve) => {
    if (s.connected) return resolve(s);
    s.on("connect", () => resolve(s));
  });
}
