import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { ensureConnected } from '../../lib/socket';

export default function ThreadDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth() || {};

  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(false);

  const [reply, setReply] = useState({ author: '', content: '', hp: '' });

  const load = async () => {
    if (!id) return;
    const data = await apiGet(`/threads/${id}`);
    setThread(data);
  };

  useEffect(() => { load(); }, [id]);

  // realtime replies
  useEffect(() => {
    if (!id) return;
    let s;
    let mounted = true;
    (async () => {
      s = await ensureConnected();
      if (!s || !mounted) return;
      s.emit('join:thread', id);
      s.off('reply:new'); s.on('reply:new', (p) => { if (p?.threadId === String(id)) load(); });
      s.off('reply:deleted'); s.on('reply:deleted', (p) => { if (p?.threadId === String(id)) load(); });
    })();
    return () => { mounted = false; if (s) { s.emit('leave:thread', id); s.off('reply:new'); s.off('reply:deleted'); } };
  }, [id]);

  // ===== Users for suggestions =====
  const usersInThread = useMemo(() => {
    if (!thread) return [];
    const set = new Set();
    if (thread.author && thread.author !== 'anonymous') set.add(String(thread.author));
    for (const r of (thread.replies || thread.comments || [])) {
      const a = r.author || r.authorName;
      if (a && a !== 'anonymous') set.add(String(a));
    }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [thread]);

  // ===== Utils for mentions =====
  const mergeUniqueCI = (arrs) => {
    const seen = new Set();
    const out = [];
    for (const arr of arrs) {
      for (const x of (arr || [])) {
        const k = String(x).toLowerCase();
        if (!seen.has(k)) { seen.add(k); out.push(String(x)); }
      }
    }
    return out;
  };
  const filterLocalUsers = (q) => {
    const ql = q.toLowerCase();
    const starts = usersInThread.filter(u => u.toLowerCase().startsWith(ql));
    const contains = usersInThread.filter(u => u.toLowerCase().includes(ql) && !starts.includes(u));
    return [...starts, ...contains];
  };

  const mentionCache = useRef(new Map());
  const fetchMentionCandidates = async (q) => {
    const key = q.toLowerCase();
    if (mentionCache.current.has(key)) return mentionCache.current.get(key);

    const endpoints = [
      ['/users/search', 'q'],
      ['/users', 'q'],
      ['/users', 'query'],
      ['/user/search', 'q'],
    ];

    let collected = [];
    for (const [ep, param] of endpoints) {
      try {
        const data = await apiGet(`${ep}?${param}=${encodeURIComponent(q)}`);
        const arr = Array.isArray(data) ? data : (data?.users || data?.data || []);
        const names = (arr || []).map(u => u.username || u.name || u.handle).filter(Boolean);
        collected = collected.concat(names);
      } catch {}
    }
    const unique = mergeUniqueCI([collected]);
    mentionCache.current.set(key, unique);
    return unique;
  };

  // ===== Build reply tree =====
  const buildReplyTree = (list) => {
    const replies = (list || []).map(r => ({ ...r, children: [] }));
    const byId = new Map(replies.map(n => [String(n._id || n.id), n]));
    const roots = [];
    for (const n of replies) {
      const idStr = String(n._id || n.id);
      const parent = n.parentReplyId || n.parentId || n.replyTo || n.parent || null;
      const pid = parent ? String(parent) : null;
      if (pid && byId.has(pid) && pid !== idStr) byId.get(pid).children.push(n);
      else roots.push(n);
    }
    return roots;
  };

  // ===== Focus + highlight theo anchor từ notifications =====
  const commentRefs = useRef({});
  const [flashId, setFlashId] = useState(null);
  const focusAndFlash = (focusId) => {
    const idStr = String(focusId);
    let tries = 0;
    const tryScroll = () => {
      tries++;
      const el = commentRefs.current[idStr] || document.getElementById(`c-${idStr}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFlashId(idStr);
        setTimeout(() => setFlashId(null), 2200);
      } else if (tries < 10) {
        setTimeout(tryScroll, 120);
      }
    };
    tryScroll();
  };
  useEffect(() => {
    if (!thread) return;
    let focusId = router.query?.focus;
    if (!focusId && typeof window !== 'undefined') {
      const m = /^#c-([A-Za-z0-9]+)/.exec(window.location.hash);
      if (m) focusId = m[1];
    }
    if (!focusId) return;
    focusAndFlash(focusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, router.query?.focus]);

  // ===== Inline reply editor (tách riêng để tránh re-mount) =====
  function InlineReplyEditor({ rid, defaultPrefix = '', onCancel, onSubmit }) {
    const [value, setValue] = useState(defaultPrefix);
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState([]);
    const [activeIdx, setActiveIdx] = useState(-1);
    const [composing, setComposing] = useState(false);

    const taRef = useRef(null);
    const caretRef = useRef(null);
    const debounceRef = useRef(null);
    const suggestBoxRef = useRef(null);

    // ⭐ Giữ caret/focus bền vững sau mỗi render (tránh văng focus khi state đổi)
    useLayoutEffect(() => {
      const el = taRef.current;
      if (!el) return;
      if (document.activeElement !== el) {
        // nếu bị blur vì render, focus lại
        el.focus();
      }
      if (caretRef.current != null) {
        try { el.setSelectionRange(caretRef.current, caretRef.current); } catch {}
        caretRef.current = null;
      }
    });

    // Nếu blur mà không phải do click vào nút/link trong editor -> focus lại
    const onBlur = (e) => {
      const rt = e.relatedTarget;
      if (rt && (rt.closest && (rt.closest('button') || rt.closest('a') || rt.closest('input')))) {
        return; // blur hợp lệ (nhấn nút, link...)
      }
      // Blur không mong muốn → focus lại
      requestAnimationFrame(() => {
        if (taRef.current) taRef.current.focus();
      });
    };

    const updateSuggestions = (q, caret) => {
      if (!q) { setOpen(false); setOptions([]); return; }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const local = filterLocalUsers(q);
        let remote = [];
        try { remote = await fetchMentionCandidates(q); } catch {}
        const merged = mergeUniqueCI([local, remote]).slice(0, 20);
        setOptions(merged);
        setActiveIdx(merged.length ? 0 : -1);
        setOpen(true);
        caretRef.current = caret; // giữ vị trí caret cho lần render kế
      }, 120);
    };

    const insertMention = (username) => {
      const el = taRef.current;
      const caret = el ? (el.selectionStart || value.length) : value.length;
      const before = value.slice(0, caret);
      const after  = value.slice(caret);
      const needsAt = !before.endsWith('@');
      const insert = `${needsAt ? '@' : ''}${username} `;
      const next = before + insert + after;
      const nextCaret = before.length + insert.length;
      setValue(next);
      caretRef.current = nextCaret;
      setOpen(false);
      requestAnimationFrame(() => el?.focus());
    };

    return (
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}
      >
        <div className="relative">
          <textarea
            ref={taRef}
            className="textarea w-full"
            rows={3}
            value={value}
            onBlur={onBlur}
            onChange={(e) => {
              const el = e.target;
              const caret = el.selectionStart;
              const v = el.value;
              setValue(v);

              if (composing) return; // đang gõ dấu → đợi end

              const head = v.slice(0, caret);
              const m = /@([a-zA-Z0-9_]{1,30})$/.exec(head);
              if (m && m[1]) updateSuggestions(m[1], caret);
              else { setOpen(false); setOptions([]); }
              caretRef.current = caret;
            }}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => {
              setComposing(false);
              const el = e.target;
              const caret = el.selectionStart;
              const v = el.value;
              const head = v.slice(0, caret);
              const m = /@([a-zA-Z0-9_]{1,30})$/.exec(head);
              if (m && m[1]) updateSuggestions(m[1], caret);
              caretRef.current = caret;
            }}
            onKeyDown={(e) => {
              if (composing) return;

              if (open && options.length) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveIdx((i) => (i + 1) % options.length);
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIdx((i) => (i - 1 + options.length) % options.length);
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  insertMention(options[activeIdx >= 0 ? activeIdx : 0]);
                  return;
                }
                if (e.key === 'Escape') {
                  setOpen(false); return;
                }
              }
            }}
            required
          />
          {/* Nút mở gợi ý thủ công */}
          <button
            type="button"
            onClick={() => {
              setOpen((o) => !o);
              setOptions(usersInThread);
              setActiveIdx(0);
              const el = taRef.current;
              if (el) {
                const caret = el.selectionStart || el.value.length;
                caretRef.current = caret;
                el.focus();
              }
            }}
            className="absolute right-2 top-2 rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >@</button>

          {/* Panel gợi ý – giữ focus khi click bằng onMouseDown.preventDefault */}
          {open && options.length > 0 && (
            <div
              ref={suggestBoxRef}
              className="absolute z-10 mt-1 max-h-48 overflow-auto rounded border bg-white p-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
              onMouseDown={(e) => e.preventDefault()}
            >
              {options.map((u, i) => (
                <button
                  key={u}
                  type="button"
                  className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    i === activeIdx ? 'bg-slate-100 dark:bg-slate-800' : ''
                  }`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => insertMention(u)}
                >
                  @{u}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="btn-primary"
            disabled={!value.trim() || loading}
          >
            {loading ? 'Đang gửi…' : 'Gửi trả lời'}
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
        </div>
      </form>
    );
  }

  const onDeleteReply = async (rid) => {
    if (!confirm('Delete this reply?')) return;
    try { await apiDelete(`/threads/${id}/replies/${rid}`); await load(); }
    catch (err) { alert('Delete failed: ' + err.message); }
  };

  const postTopLevel = async (e) => {
    e.preventDefault();
    if (!reply.content.trim()) return;
    setLoading(true);
    try { await apiPost(`/threads/${id}/replies`, reply); setReply({ author: '', content: '', hp: '' }); await load(); }
    catch (err) { alert('Lỗi: ' + err.message); }
    finally { setLoading(false); }
  };

  const postChildReply = async (parentId, content) => {
    const body = (content || '').trim();
    if (!body) return;
    setLoading(true);
    try {
      await apiPost(`/threads/${id}/replies`, { content: body, parentReplyId: parentId });
      await load();
    } catch (err) { alert('Lỗi: ' + err.message); }
    finally { setLoading(false); }
  };

  const [replyTo, setReplyTo] = useState(null);

  const ReplyItem = ({ node }) => {
    const rid = node._id || node.id;
    const isAdmin = user?.role === 'admin';
    const content = node.content ?? node.text ?? node.body ?? '';

    return (
      <li
        id={`c-${rid}`}
        ref={el => { if (el) commentRefs.current[String(rid)] = el; }}
        className={`rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 transition-shadow ${
          String(flashId) === String(rid) ? 'ring-2 ring-amber-400 flash' : ''
        }`}
      >
        <div className="text-xs text-slate-500 dark:text-slate-300 flex items-center justify-between">
          <span>{node.author || node.authorName || 'anonymous'} • {node.createdAt ? new Date(node.createdAt).toLocaleString() : ''}</span>
          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={() => setReplyTo(rid)}
                className="btn-ghost text-xs"
              >Reply</button>
            )}
            {isAdmin && <button onClick={() => onDeleteReply(rid)} className="btn-ghost text-xs">Delete</button>}
          </div>
        </div>

        {content && (
          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
            {content}
          </div>
        )}

        {replyTo === rid && (
          <InlineReplyEditor
            key={rid}
            rid={rid}
            defaultPrefix={
              (node.author || node.authorName) && (node.author || node.authorName) !== 'anonymous'
                ? '@' + (node.author || node.authorName) + ' ' : ''
            }
            onCancel={() => setReplyTo(null)}
            onSubmit={(val) => { postChildReply(rid, val); setReplyTo(null); }}
          />
        )}

        {node.children?.length > 0 && (
          <ul className="mt-3 ml-4 border-l border-slate-200 pl-4 dark:border-slate-800 space-y-3">
            {node.children.map(child => <ReplyItem key={child._id || child.id} node={child} />)}
          </ul>
        )}
      </li>
    );
  };

  const tree = buildReplyTree(thread?.replies || thread?.comments || []);

  return (
    <>
      {!thread ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push('/community')} className="btn-ghost">← Back</button>
            <Link href="/" className="btn-ghost">Home</Link>
          </div>
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-6 w-40 bg-gray-300 dark:bg-gray-700 rounded" />
            <div className="h-10 w-full bg-gray-300 dark:bg-gray-700 rounded" />
            <div className="h-10 w-3/4 bg-gray-300 dark:bg-gray-700 rounded" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push('/community')} className="btn-ghost">← Back</button>
            <Link href="/" className="btn-ghost">Home</Link>
          </div>

          <div className="card p-6">
            <h1 className="text-2xl font-bold">{thread.title}</h1>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">Bởi {thread.author || 'anonymous'} • {thread.createdAt ? new Date(thread.createdAt).toLocaleString() : ''}</div>
            <p className="mt-4 whitespace-pre-wrap text-slate-800 dark:text-slate-100">{thread.content}</p>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold">Trả lời</h3>
            <ul className="mt-4 grid gap-3">
              {tree.length > 0 ? tree.map(n => <ReplyItem key={n._id || n.id} node={n} />) : <i className="text-slate-500 dark:text-slate-300">Chưa có trả lời.</i>}
            </ul>

            {/* form trả lời top-level */}
            <div className="mt-6">
              {user ? (
                <form className="grid gap-2" onSubmit={postTopLevel}>
                  <div className="grid gap-1">
                    <label className="text-sm text-slate-600 dark:text-slate-200">Nội dung</label>
                    <textarea className="textarea" rows={3} value={reply.content} onChange={e => setReply({ ...reply, content: e.target.value })} required />
                  </div>
                  <div className="grid gap-1 sm:grid-cols-2">
                    <div>
                      <label className="text-sm text-slate-600 dark:text-slate-200">Tên hiển thị (tuỳ chọn)</label>
                      <input className="input" placeholder="anonymous" value={reply.author} onChange={e => setReply({ ...reply, author: e.target.value })} />
                    </div>
                    <div className="flex items-end">
                      <input className="input" style={{display:'none'}} tabIndex={-1} autoComplete="off" value={reply.hp} onChange={e=>setReply({...reply, hp: e.target.value})} placeholder="Leave this field empty" />
                      <button type="submit" disabled={loading || !reply.content.trim()} className="btn-primary w-full sm:w-auto">{loading ? 'Đang gửi…' : 'Gửi trả lời'}</button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="rounded-lg border p-4 text-sm">Vui lòng đăng nhập để trả lời.</div>
              )}
            </div>
          </div>

          {/* hiệu ứng highlight khi focus vào comment */}
          <style jsx>{`
            .flash {
              animation: flashIn 1.8s ease-out;
            }
            @keyframes flashIn {
              0%   { box-shadow: 0 0 0 0 rgba(234,179,8,0.75); background: rgba(250,204,21,0.18); }
              60%  { box-shadow: 0 0 0 8px rgba(234,179,8,0.0); background: rgba(250,204,21,0.10); }
              100% { box-shadow: 0 0 0 0 rgba(234,179,8,0); background: transparent; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
