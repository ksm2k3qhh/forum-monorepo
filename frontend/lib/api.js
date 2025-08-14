// frontend/lib/api.js
// KHÔNG override window.fetch nữa (tránh xung đột extension).
// Tự chọn BASE URL cho dev/prod để không bao giờ tạo "/undefined/api/*".
// Tự gắn Authorization nếu có token trong localStorage.

const PROD_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const DEV_URL  = (process.env.NEXT_PUBLIC_API_URL_DEV || "http://localhost:4000").replace(/\/$/, "");

function pickBase() {
  // Ưu tiên biến môi trường production
  if (PROD_URL) return PROD_URL;
  if (typeof window === "undefined") return DEV_URL;

  const host = window.location.hostname;
  // Local dev
  if (host === "localhost" || host === "127.0.0.1") return DEV_URL;

  // Fallback an toàn: dùng cùng origin của frontend (sẽ thành /api/* trên cùng domain)
  return window.location.origin.replace(/\/$/, "");
}

function build(path) {
  const base = pickBase();
  const p = path.startsWith("/") ? path : `/${path}`;

  // Nếu caller (ở nơi khác ngoài api.js) lỡ truyền vào "/undefined/api/xxx",
  // sửa lại thành "/api/xxx" để tránh 404.
  const cleaned = p.replace(/^\/undefined\/api\//, "/api/");

  // Chúng ta luôn gắn prefix /api vào sau BASE
  return `${base}/api${cleaned.startsWith("/api/") ? cleaned.slice(4) : cleaned}`;
}

// ---- Token helpers ----
function getToken() {
  if (typeof window === "undefined") return null;
  const keys = ["token", "auth_token", "accessToken", "access_token", "jwt", "AUTH_TOKEN"];
  for (const k of keys) {
    const v = window.localStorage.getItem(k);
    if (v && typeof v === "string") return v.replace(/^"|"$/g, "");
  }
  return null;
}

// ---- Error helpers ----
function enrichError(res, url, bodyText) {
  const err = new Error(`HTTP ${res.status} @ ${url}\n${bodyText || res.statusText}`);
  err.status = res.status;
  err.url = url;
  err.body = bodyText;
  return err;
}

async function handle(res, url) {
  if (!res.ok) {
    let text = "";
    try { text = await res.text(); } catch {}
    throw enrichError(res, url, text);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// ---- Core request ----
async function request(method, path, body) {
  const url = build(path);
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: "include",
      headers,
      body: method === "GET" ? undefined : JSON.stringify(body || {}),
    });
  } catch (e) {
    const err = new Error(`Network error @ ${url}\n${e?.message || ""}`);
    err.status = 0;
    err.url = url;
    throw err;
  }
  return handle(res, url);
}

export const apiGet = (path) => request("GET", path);
export const apiPost = (path, body) => request("POST", path, body);
export const apiDelete = (path) => request("DELETE", path);
