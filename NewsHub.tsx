import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Newspaper, RefreshCw, Search, X } from 'lucide-react';
import { BroadcastStage } from './BroadcastScene';
import { loadNewsFeed, type NewsFeed, type NewsItem } from './sportsApiClient';
import { ModeHelp } from './ModeHelp';
import './newsHub.css';

function safeExternalUrl(value?: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : '';
  } catch {
    return '';
  }
}

function publishedLabel(value?: string) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) return 'Publication time not supplied';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StoryCredit({ value, link, linkLabel }: { value?: string; link?: string; linkLabel?: string }) {
  const href = safeExternalUrl(link);
  return href ? <a href={href} target="_blank" rel="noreferrer noopener">{linkLabel || value}</a> : <span>{value}</span>;
}

function NewsStory({ item, featured = false }: { item: NewsItem; featured?: boolean }) {
  const storyUrl = safeExternalUrl(item.url);
  return (
    <article className={`bk-news-story${featured ? ' bk-news-story-featured' : ''}`}>
      <div className="bk-news-card-meta">
        <span>{item.source || 'NFL News'}</span>
        <time dateTime={item.published || undefined}>{publishedLabel(item.published)}</time>
      </div>
      <h3>
        {storyUrl ? (
          <a href={storyUrl} target="_blank" rel="noreferrer noopener" className="bk-news-card-link">
            {item.headline}<ExternalLink aria-hidden="true" size={16} />
          </a>
        ) : item.headline}
      </h3>
      {featured && storyUrl && <span className="bk-news-story-cta" aria-hidden="true">Read at publisher</span>}
      {(item.license || item.attribution) && (
        <p className="bk-news-credit">
          {item.license && <StoryCredit value={item.license} link={item.licenseUrl} />}
          {item.license && item.attribution && ' · '}
          {item.attribution && <StoryCredit value={item.attribution} link={item.attribution} linkLabel="Source attribution" />}
        </p>
      )}
    </article>
  );
}

export const NewsHub: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [search, setSearch] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const load = async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError('');
    setItems([]);
    setFeed(null);
    try {
      const data = await loadNewsFeed({
        useSportsApi: import.meta.env.VITE_BK_NEWS_API_ENABLED === 'true',
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setItems(data.articles);
      setFeed(data);
    } catch {
      if (controller.signal.aborted) return;
      setError('NFL news is temporarily unavailable. Use Refresh to try again.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    return () => activeRequest.current?.abort();
  }, []);

  const query = search.trim().toLowerCase();
  const matches = query
    ? items.filter(item => `${item.headline} ${item.source || ''}`.toLowerCase().includes(query))
    : items;
  const featured = query ? undefined : matches[0];
  const remaining = featured ? matches.slice(1) : matches;

  return (
    <BroadcastStage scene="studio" page="news" className="bk-news-page min-h-[calc(100dvh-7rem)]">
      <div className="bk-news-shell">
        <header className="bk-news-masthead">
          <div>
            <p className="bk-news-kicker">Around the league</p>
            <h1>NFL News</h1>
          </div>
          <div className="bk-news-controls">
            <ModeHelp mode="news" />
            <button type="button" onClick={() => void load()} aria-label="Refresh" disabled={loading} className="bk-news-refresh">
              <RefreshCw size={15} aria-hidden="true" className={loading ? 'motion-safe:animate-spin' : ''} />
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        {feed && (
          <div className="bk-news-feed-meta">
            {feed.provider === 'Currents' ? (
              <a href="https://currentsapi.services/" target="_blank" rel="noreferrer noopener">Powered by Currents News API</a>
            ) : <span>Headlines supplied by {feed.provider}.</span>}
            <span role="status">
              {feed.fetchedAt ? <>Checked <time dateTime={feed.fetchedAt}>{publishedLabel(feed.fetchedAt)}</time></> : 'Feed check time unavailable'}
              {feed.stale && <strong> · Feed may be out of date</strong>}
            </span>
          </div>
        )}

        {loading && <div className="bk-news-empty" role="status">Loading NFL headlines…</div>}
        {error && <div className="bk-news-empty" role="status">{error}</div>}
        {!loading && !error && !items.length && <div className="bk-news-empty" role="status">No current headlines are available right now.</div>}

        {items.length > 0 && (
          <>
            <div className="bk-news-search">
              <Search aria-hidden="true" size={17} />
              <input ref={searchInput} type="search" aria-label="Search headlines" placeholder="Search headlines or publishers" value={search} onChange={event => setSearch(event.target.value)} />
              {search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(''); searchInput.current?.focus(); }}><X aria-hidden="true" size={16} /></button>}
            </div>
            {featured && (
              <section className="bk-news-feature" aria-labelledby="news-feature-title">
                <h2 id="news-feature-title" className="bk-news-kicker">Top headline</h2>
                <NewsStory item={featured} featured />
              </section>
            )}
            {(query || remaining.length > 0) && (
              <section className="bk-news-more" aria-labelledby="news-list-title">
                <div className="bk-news-list-heading">
                  <h2 id="news-list-title">{query ? 'Search results' : 'More headlines'}</h2>
                  <span role="status">{remaining.length} {remaining.length === 1 ? 'story' : 'stories'}</span>
                </div>
                {remaining.length ? (
                  <div className="bk-news-grid">{remaining.map(item => <NewsStory key={item.id} item={item} />)}</div>
                ) : <div className="bk-news-empty"><Newspaper aria-hidden="true" size={20} />No matching headlines.</div>}
              </section>
            )}
          </>
        )}
      </div>
    </BroadcastStage>
  );
};
