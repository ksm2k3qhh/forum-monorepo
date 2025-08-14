import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { apiGet, apiPost } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

function normalizeList(data) {
  const arr = Array.isArray(data)
    ? data
    : data?.threads ?? data?.data ?? data?.items ?? [];
  return Array.isArray(arr) ? arr : [];
}
function pickId(t) {
  return t?._id || t?.id || t?.slug;
}
function pickDate(t) {
  return t?.createdAt || t?.created_at || t?.created || t?.date || null;
}
function pickAuthor(t) {
  return t?.author?.username ?? t?.author ?? t?.authorName ?? "anonymous";
}
function coerceCount(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (!isNaN(n)) return n;
  }
  return null;
}
function pickReplyCount(t) {
  const candidates = [
    t?.replyCount,
    t?.repliesCount,
    t?.commentCount,
    t?.commentsCount,
    t?.answersCount,
    t?.numReplies,
    t?.numComments,
    t?.stats?.replies,
    t?.stats?.comments,
    t?.meta?.replyCount,
    t?.meta?.comments,
    Array.isArray(t?.replies) ? t.replies.length : undefined,
    Array.isArray(t?.comments) ? t.comments.length : undefined,
  ];
  for (const c of candidates) {
    const n = coerceCount(c);
    if (n !== null) return n;
  }
  return 0;
}

export default function CommunityPage() {
  const router = useRouter();
  const { user } = useAuth() || {};
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [form, setForm] = useState({
    title: "",
    content: "",
    author: "",
    hp: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const data = await apiGet("/threads");
      setThreads(normalizeList(data));
    } catch (e) {
      setErr(e);
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSubmitting(true);
    try {
      await apiPost("/threads", form);
      setForm({ title: "", content: "", author: "", hp: "" });
      await load();
    } catch (e) {
      alert("Tạo chủ đề thất bại: " + (e?.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-8">
      {/* Header: Back về homepage, không có Home */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push("/")} className="btn-ghost">
          ← Back
        </button>
        <span />
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold">Community</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Tạo chủ đề và thảo luận cùng mọi người.
        </p>
      </div>

      {err && (
        <div className="p-3 rounded border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800">
          <div className="font-semibold">Load threads failed</div>
          <div className="text-sm opacity-80">{String(err?.message || err)}</div>
        </div>
      )}

      {user ? (
        <form onSubmit={onSubmit} className="card p-6 grid gap-3">
          <div className="grid gap-1">
            <label className="text-sm text-slate-600 dark:text-slate-200">Tiêu đề</label>
            <input
              className="input"
              placeholder="VD: Hỏi về Next.js"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-slate-600 dark:text-slate-200">Nội dung</label>
            <textarea
              className="textarea"
              rows={4}
              placeholder="Mô tả chi tiết câu hỏi/vấn đề…"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-200">
                Tên hiển thị (tuỳ chọn)
              </label>
              <input
                className="input"
                placeholder="anonymous"
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <input
                className="input"
                style={{ display: "none" }}
                tabIndex={-1}
                autoComplete="off"
                value={form.hp}
                onChange={(e) => setForm({ ...form, hp: e.target.value })}
                placeholder="Leave this field empty"
              />
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full sm:w-auto"
              >
                {submitting ? "Đang tạo…" : "Tạo chủ đề"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="card p-6">
          <h3 className="text-lg font-semibold">Create a thread</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Bạn cần đăng nhập để tạo chủ đề.
          </p>
          <div className="mt-3">
            <Link className="btn" href="/login">Đăng nhập</Link>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded" />
          <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded" />
          <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded" />
        </div>
      ) : threads.length === 0 ? (
        <div className="opacity-60">Chưa có chủ đề.</div>
      ) : (
        <ul className="grid gap-3">
          {threads.map((t) => {
            const ident = pickId(t);
            const when = pickDate(t);
            const replies = pickReplyCount(t);
            return (
              <li key={ident} className="card p-5">
                <Link href={`/community/${encodeURIComponent(ident)}`} className="block">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {t.title || "Untitled"}
                  </h3>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    Bởi {pickAuthor(t)} • {when ? new Date(when).toLocaleString() : "—"} • {replies} trả lời
                  </div>
                  {t.content && (
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 line-clamp-2">
                      {t.content}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
