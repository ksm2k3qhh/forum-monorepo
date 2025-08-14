// backend/api/[...all].js
const app = require("../app");

// Vercel rewrite /anything -> /api/anything
// Bỏ prefix "/api" để Express thấy đúng "/threads", "/notifications", ...
module.exports = (req, res) => {
  req.url = req.url.replace(/^\/api/, "") || "/";
  return app(req, res);
};
