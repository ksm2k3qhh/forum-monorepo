import { useEffect, useState } from 'react';
import { apiGet } from '../../lib/api';
import Link from 'next/link';

export default function Faqs() {
  const [faqs, setFaqs] = useState([]);
  useEffect(() => { apiGet('/faqs').then(setFaqs).catch(err => alert('Lỗi: ' + err.message)); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => location.assign('/')} className="btn-ghost">← Back</button>
        <span />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold">FAQs</h1>
        <p className="mt-2 text-slate-600">Các câu hỏi thường gặp về công nghệ.</p>
      </div>
      <div className="card p-4">
        <div className="grid gap-3">
          {faqs.map((f) => (
            <details key={f._id} className="rounded-lg border border-slate-200 p-4 open:bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <summary className="cursor-pointer select-none text-sm font-semibold">{f.question}</summary>
              <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{f.answer}</div>
            </details>
          ))}
          {faqs.length === 0 && <i className="text-slate-500">Chưa có dữ liệu. Hãy seed từ backend.</i>}
        </div>
      </div>
    </div>
  );
}
