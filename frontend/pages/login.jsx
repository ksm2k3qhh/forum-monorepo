import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try { await login(form.username, form.password); const next = router.query.next || '/'; router.replace(next); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold">Sign in</h1>
      <form onSubmit={onSubmit} className="card grid gap-3 p-6">
        <input className="input" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <input className="input" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button disabled={loading} className="btn-primary">{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Don’t have an account? <Link href={`/register?next=${encodeURIComponent((typeof window !== 'undefined' && window.location.pathname) || '/')}`} className="text-brand">Sign up</Link></p>
    </div>
  );
}
