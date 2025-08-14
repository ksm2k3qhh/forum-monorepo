import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <span />
      </div>

      <section className="text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Interlink Forum
          </h1>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Your space to solve tech problems, share knowledge, and connect with the community.
          </p>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">Community</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">A place to ask questions, discuss, and share answers.</p>
        <Link href="/community" className="btn mt-3 inline-flex">
          Go to Community
        </Link>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">FAQs</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Quick answers to common technical issues and community guidelines.</p>
        <Link href="/faqs" className="btn mt-3 inline-flex">
          Visit FAQs
        </Link>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Still need help?</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Contact us via Telegram for more support.</p>
        <a href="https://t.me/interlink_technicalsupport" target="_blank" rel="noreferrer" className="btn-primary mt-4 inline-flex">
          Chat on Telegram
        </a>
      </section>
    </div>
  );
}
