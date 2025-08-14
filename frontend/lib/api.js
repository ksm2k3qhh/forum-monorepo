export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function authHeaders() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet(path) {
  const res = await fetch(`${API_URL}/api${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDelete(path) {
  const res = await fetch(`${API_URL}/api${path}`, { method: 'DELETE', headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(await res.text());
  try { return await res.json(); } catch { return { ok: true }; }
}

export async function apiPatch(path, body) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
