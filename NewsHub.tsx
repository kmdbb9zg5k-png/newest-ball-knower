import React, { useEffect, useState } from 'react';
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';

type NewsItem = {
  id: string;
  headline: string;
  description?: string;
  published?: string;
  image?: string;
  url?: string;
};

export const NewsHub: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/nfl-news', { cache: 'no-store' });
      if (!r.ok) throw new Error('News feed unavailable');
      const data = await r.json();
      setItems(Array.isArray(data?.articles) ? data.articles : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load NFL news.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-[calc(100vh-7rem)] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.28em] text-[#D4AF37]">
              <Newspaper className="h-4 w-4" /> NFL News
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
            </div>
            <h2 className="font-display text-4xl font-black uppercase sm:text-6xl">Around the <span className="text-[#D4AF37]">League</span></h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">Current NFL headlines in one place so you can make smarter Ball Knower decisions.</p>
          </div>
          <button onClick={() => void load()} className="flex shrink-0 items-center gap-2 border border-white/10 bg-[#151515] px-3 py-2 text-xs font-black uppercase tracking-wider text-zinc-300 hover:border-[#D4AF37]/50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {error && <div className="mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-300">{error}</div>}
        {loading && items.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0,1,2,3].map(i => <div key={i} className="h-48 animate-pulse rounded-xl border border-white/5 bg-white/[.03]" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#111] p-10 text-center text-zinc-400">No headlines are available right now.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map(item => (
              <article key={item.id} className="group overflow-hidden rounded-xl border border-white/10 bg-[#111]/90 shadow-xl transition hover:border-[#D4AF37]/40">
                {item.image && <img src={item.image} alt="" className="h-44 w-full object-cover opacity-85 transition group-hover:opacity-100" />}
                <div className="p-5">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[.2em] text-zinc-500">{item.published ? new Date(item.published).toLocaleString() : 'NFL'}</div>
                  <h3 className="text-xl font-black leading-tight text-white">{item.headline}</h3>
                  {item.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-400">{item.description}</p>}
                  {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#D4AF37]">Read Story <ExternalLink className="h-3.5 w-3.5" /></a>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
