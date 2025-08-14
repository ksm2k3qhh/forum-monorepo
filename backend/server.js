// backend/server.js
require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 4000;

/* ===== MongoDB ===== */
async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("[DB] Missing MONGODB_URI");
    return;
  }
  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log("[DB] Connected");
  } catch (e) {
    console.error("[DB] Connect error:", e.message);
  }
}
connectDB();

/* ===== App ===== */
const app = express();

// CORS từ env: CORS_ORIGIN = "https://frontend.vercel.app,http://localhost:3000"
const allowlist = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowlist.length === 0) return cb(null, true);
    const ok =
      allowlist.includes(origin) ||
      allowlist.some((pat) => {
        if (!pat.includes("*")) return false;
        const re = new RegExp("^" + pat.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
        return re.test(origin);
      });
    cb(ok ? null : new Error("CORS blocked: " + origin), ok);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.set("trust proxy", 1);

/* ===== Guard sửa URL sai kiểu /undefined/api/* ===== */
app.use((req, _res, next) => {
  if (req.url.startsWith("/undefined/api/")) {
    const old = req.url;
    req.url = req.url.replace(/^\/undefined\/api\//, "/api/");
    console.warn("[guard] rewrite", old, "->", req.url);
  }
  next();
});

/* ===== Health & Diag ===== */
app.get("/", (_req, res) =>
  res.json({ service: "forum-backend (rv1)", ok: true, env: process.env.NODE_ENV || "development" })
);
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/diag", async (_req, res) => {
  try {
    const state = mongoose.connection.readyState; // 0..3
    let pingOK = false;
    try {
      const admin = mongoose.connection.db?.admin?.();
      const ping = admin ? await admin.ping() : null;
      pingOK = !!ping?.ok;
    } catch {}
    let collections = [];
    try {
      collections = (await mongoose.connection.db.listCollections().toArray()).map(c => c.name);
    } catch {}
    res.json({ ok: true, db: { readyState: state, pingOK, collections } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ===== Mount routes rv1 dưới /api/* ===== */
function safeUse(path, mod) {
  try { app.use(path, require(mod)); console.log("[Router] mounted", path, "->", mod); }
  catch { console.warn("[Router] missing", mod); }
}
safeUse("/api/auth", "./routes/auth");
safeUse("/api/users", "./routes/users");
safeUse("/api/faqs", "./routes/faqs");
safeUse("/api/threads", "./routes/threads");
safeUse("/api/notifications", "./routes/notifications");

// Error handler
app.use((err, _req, res, _next) => {
  console.error("[ERR]", err);
  res.status(err.status || 500).json({ ok: false, error: err.message || "Server error" });
});

/* ===== Socket.io (tuỳ chọn) ===== */
const server = http.createServer(app);
try {
  const { Server } = require("socket.io");
  const io = new Server(server, {
    path: "/socket.io",
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowlist.length === 0) return cb(null, true);
        const ok =
          allowlist.includes(origin) ||
          allowlist.some((pat) => {
            if (!pat.includes("*")) return false;
            const re = new RegExp("^" + pat.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
            return re.test(origin);
          });
        cb(ok ? null : new Error("CORS blocked: " + origin), ok);
      },
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  try {
    const rt = require("./realtime_ws");
    if (typeof rt.setIO === "function") rt.setIO(io);
  } catch {}

  io.on("connection", (socket) => {
    socket.on("join:thread", (threadId) => threadId && socket.join(`thread:${threadId}`));
    socket.on("leave:thread", (threadId) => threadId && socket.leave(`thread:${threadId}`));
  });

  server.listen(PORT, () => console.log(`API listening on http://localhost:${PORT} (with socket.io)`));
} catch {
  server.listen(PORT, () => console.log(`API listening on http://localhost:${PORT} (no socket.io)`));
}
