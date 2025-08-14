import NotificationsBell from "./NotificationsBell";
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ensureConnected } from '../lib/socket';
import { API_URL } from '../lib/api';

const NavLink = ({ href, children }) => {
  const { pathname } = useRouter();
  const active = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Link href={href} className={`px-3 py-2 rounded-md text-sm font-medium ${active ? 'text-brand' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}>{children}</Link>
  );
};

export default function Layout({ children }) {
  const { user, logout } = useAuth() || {};
  const [dark, setDark] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  };

  useEffect(() => {
    let mounted = true;
    let s;
    let timer;

    async function run() {
      async function fetchCount() {
        try {
          if (!user) { setUnread(0); return; }
          const t = localStorage.getItem('token');
          const res = await fetch(API_URL + '/api/notifications/unread-count', { headers: { Authorization: `Bearer ${t}` } });
          if (res.ok) { const data = await res.json(); if (mounted) setUnread(data.count || 0); }
        } catch {}
      }
      await fetchCount();
      timer = setInterval(fetchCount, 60000);
      if (user) {
        s = await ensureConnected();
        if (s && mounted) {
          const bump = () => setUnread(u => (u || 0) + 1);
          s.on('notification:new', bump);
        }
      }
    }
    run();
    return () => { mounted = false; if (timer) clearInterval(timer); if (s) s.off('notification:new'); };
  }, [user]);

  return (
    <div className="relative min-h-screen flex flex-col">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-50 via-indigo-50 to-sky-50 dark:from-[#070a1a] dark:via-[#0a0f28] dark:to-[#070a1a]" />
        <div className="absolute -top-24 -left-24 h-[55vw] w-[55vw] rounded-full bg-fuchsia-400/25 blur-3xl animate-blob" />
        <div className="absolute -bottom-24 -right-24 h-[60vw] w-[60vw] rounded-full bg-sky-400/25 blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 h-[40vw] w-[40vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-400/10 blur-3xl animate-blob animation-delay-4000" />
      </div>

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <img src="/interlink-logo.svg" alt="InterLink logo" className="h-7 w-7 rounded-md" />
            <span>Interlink</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/community">Community</NavLink>
            <NavLink href="/faqs">FAQs</NavLink>

            {user && (
              <NotificationsBell />
            )}

            <button onClick={toggleTheme} className="btn-ghost ml-1" title="Toggle dark mode" aria-label="Toggle dark mode">
              {dark ? '🌞' : '🌙'}
            </button>

            {user ? (
              <button onClick={logout} className="btn-ghost ml-1" title="Logout">Logout ({user.username})</button>
            ) : (
              <>
                <Link href="/login" className="btn-ghost ml-1">Login</Link>
                <Link href="/register" className="btn-primary ml-1">Sign up</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="container-page flex-1">{children}</main>

      <footer className="mt-16 border-t border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="container py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} Interlink Network
        </div>
      </footer>
    </div>
  );
}
