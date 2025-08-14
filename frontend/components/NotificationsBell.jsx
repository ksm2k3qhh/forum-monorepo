import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, apiDelete } from "../lib/api";
import { ensureConnected } from "../lib/socket";

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);      // chỉ dùng cho load list
  const [deleting, setDeleting] = useState(false);    // trạng thái xoá (không show skeleton)
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const btnRef = useRef(null);
  const panelRef = useRef(null);

  // fetch notifications
  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      const data = await apiGet("/notifications");
      const list = Array.isArray(data)
        ? data
        : data?.notifications || data?.data || [];
      setItems(Array.isArray(list) ? list : []);
      setSelected(new Set());
    } catch (e) {
      setErr(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Toggle open + lazy load
  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  // Click outside / Esc => close
  useEffect(() => {
    function onDocClick(e) {
      const t = e.target;
      if (
        panelRef.current &&
        !panelRef.current.contains(t) &&
        btnRef.current &&
        !btnRef.current.contains(t)
      ) {
        setOpen(false);
      }
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // Realtime cập nhật
  useEffect(() => {
    let s, mounted = true;
    (async () => {
      try {
        s = await ensureConnected();
        if (!mounted || !s) return;
        const handlers = [
          ["notification:new", () => load()],
          ["notify:new", () => load()],
          ["notifications:updated", () => load()],
        ];
        handlers.forEach(([ev, fn]) => { s.off(ev); s.on(ev, fn); });
      } catch {}
    })();
    return () => {
      if (s) {
        ["notification:new","notify:new","notifications:updated"].forEach(ev => s.off(ev));
      }
      mounted = false;
    };
  }, []);

  const BellIcon = ({ hasUnread }) => (
    <span className="relative inline-flex">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .53-.21 1.04-.59 1.41L4 17h5m6 0H9m6 0a3 3 0 1 1-6 0" />
      </svg>
      {hasUnread ? (
        <span className="absolute -top-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
      ) : null}
    </span>
  );

  const hasUnread = items.some((n) => n?.read === false || n?.isRead === false);

  // toggle chọn
  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Xoá nhiều (optimistic UI)
  const deleteSelected = async () => {
    if (selected.size === 0 || deleting) return;

    const ids = Array.from(selected).map(String);
    const prevItems = items;
    const prevSelected = new Set(selected);

    // 1) Optimistic: ẩn ngay các item đã chọn
    const nextItems = prevItems.filter((n) => {
      const nid = String(n._id || n.id);
      return !prevSelected.has(nid);
    });
    setItems(nextItems);
    setSelected(new Set());
    setErr(null);
    setDeleting(true);

    // 2) Gọi API thật
    try {
      let bulkOk = false;
      try {
        await apiPost("/notifications/bulk-delete", { ids });
        bulkOk = true;
      } catch {
        try {
          await apiPost("/notifications/delete", { ids });
          bulkOk = true;
        } catch { bulkOk = false; }
      }
      if (!bulkOk) {
        await Promise.all(
          ids.map((id) => apiDelete(`/notifications/${id}`).catch(() => null))
        );
      }

      // 3) (tuỳ chọn) tải lại nền để đồng bộ badge unread, nhưng
      // KHÔNG bắt người dùng chờ; nếu muốn có thể uncomment:
      // await load();
    } catch (e) {
      // 4) Lỗi → khôi phục danh sách cũ
      setItems(prevItems);
      setSelected(prevSelected);
      setErr(e);
    } finally {
      setDeleting(false);
    }
  };

  const onSeeClick = () => setOpen(false);

  const buildHref = (n) => {
    const threadId = n.threadId || n.topicId || n.postThreadId;
    const commentId =
      n.replyId || n.commentId || n.targetId || n.mentionId || n.anchorId;
    if (!threadId) return n.url || n.link || null;
    const anchor = commentId ? `?focus=${commentId}#c-${commentId}` : "";
    return `/community/${threadId}${anchor}`;
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={onToggle}
        className="btn-ghost"
        aria-haspopup="true"
        aria-expanded={open ? "true" : "false"}
        aria-label="Notifications"
        title="Notifications"
      >
        <BellIcon hasUnread={hasUnread} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          role="dialog"
          aria-label="Notifications panel"
        >
          <div className="px-2 py-1.5 text-sm font-semibold">Notifications</div>

          {loading ? (
            <div className="space-y-2 p-2 animate-pulse">
              <div className="h-10 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-10 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-10 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ) : err ? (
            <div className="p-3 text-sm rounded bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800">
              {String(err)}
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <div className="text-sm font-medium">Không có thông báo nào</div>
              <div className="mt-1 text-xs opacity-80">
                Khi có người <span className="font-mono">@mention</span> hoặc trả lời bạn,
                thông báo sẽ hiện ở đây.
              </div>
              <div className="mt-3">
                <Link href="/community" className="btn-ghost text-sm" onClick={onSeeClick}>
                  ← Về Community
                </Link>
              </div>
            </div>
          ) : (
            <ul className="max-h-96 overflow-auto divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((n) => {
                const id = String(n._id || n.id);
                const title = n.title || n.message || n.text || "Notification";
                const desc = n.description || n.detail || n.preview || n.context || "";
                const when = n.createdAt || n.time || n.timestamp;
                const href = buildHref(n);
                const checked = selected.has(id);

                return (
                  <li
                    key={id}
                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    onClick={(e) => {
                      const tag = (e.target.tagName || "").toLowerCase();
                      if (tag === "input" || tag === "a" || tag === "button" || e.target.closest("a,button,input")) return;
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id); else next.add(id);
                        return next;
                      });
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={checked}
                        onChange={() => toggleOne(id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select notification"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {title}
                            </div>
                            {desc && (
                              <div className="text-xs mt-0.5 line-clamp-2 text-slate-600 dark:text-slate-300">
                                {desc}
                              </div>
                            )}
                            {when && (
                              <div className="text-[11px] mt-1 text-slate-500 dark:text-slate-400">
                                {new Date(when).toLocaleString()}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0">
                            {href ? (
                              <Link
                                href={href}
                                className="btn-ghost text-xs"
                                onClick={onSeeClick}
                              >
                                Xem
                              </Link>
                            ) : (
                              <span className="text-[11px] text-slate-500 dark:text-slate-300">No link</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="pt-2 px-2">
            <button
              className="btn w-full text-sm"
              onClick={deleteSelected}
              disabled={selected.size === 0 || deleting}
              title={
                selected.size === 0
                  ? "Chọn thông báo để xóa"
                  : `Xóa ${selected.size} thông báo`
              }
            >
              {deleting ? "Đang xóa…" : `Xóa${selected.size ? ` (${selected.size})` : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
