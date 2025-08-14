// backend/app.js
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./db");

const app = express();

// Kết nối DB 1 lần cho mỗi lambda container
connectDB().catch((e) => console.error("DB connect error:", e.message));

app.use(
  cors({
    origin: true,          // hoặc cấu hình domain frontend cụ thể
    credentials: true,     // nếu dùng cookie auth
  })
);
app.use(express.json());
app.use(cookieParser());
app.set("trust proxy", 1); // để set cookie chính xác khi sau proxy

// ── Mount các routes sẵn có của bạn:
app.use("/threads", require("./routes/threads"));
app.use("/notifications", require("./routes/notifications"));
// app.use("/users", require("./routes/users"));
// app.use("/auth", require("./routes/auth"));

app.get("/healthz", (req, res) => res.json({ ok: true }));

module.exports = app;
