import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const requiredPages = [
  'public/about-ball-knower.html',
  'public/features.html',
  'public/fantasy-football.html',
  'public/nfl-picks.html',
  'public/nfl-trivia.html',
  'public/faq.html',
];
const requiredUrls = [
  'https://ballknowerofficial.com/',
  'https://ballknowerofficial.com/about-ball-knower.html',
  'https://ballknowerofficial.com/features.html',
  'https://ballknowerofficial.com/fantasy-football.html',
  'https://ballknowerofficial.com/nfl-picks.html',
  'https://ballknowerofficial.com/nfl-trivia.html',
  'https://ballknowerofficial.com/faq.html',
];

for (const path of requiredPages) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} must exist`);

const index = read('index.html');
assert.match(index, /<title>Ball Knower — Fantasy Football, NFL Picks & Trivia<\/title>/);
assert.match(index, /<link rel="canonical" href="https:\/\/ballknowerofficial\.com\/"/);
assert.match(index, /<link rel="manifest" href="\/manifest\.webmanifest"/);
assert.match(index, /"@type": \["SoftwareApplication", "WebApplication"\]/);
assert.match(index, /"name": "Ball Knower"/);
assert.match(index, /"applicationSubCategory": "Fantasy Football"/);
assert.match(index, /"featureList"/);

const robots = read('public/robots.txt');
for (const agent of ['OAI-SearchBot','ChatGPT-User','PerplexityBot','Claude-SearchBot','DuckDuckBot','DuckAssistBot','Applebot','Googlebot','Bingbot']) {
  assert.match(robots, new RegExp(`User-agent: ${agent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${agent} should be explicitly allowed`);
}
assert.match(robots, /Sitemap: https:\/\/ballknowerofficial\.com\/sitemap\.xml/);

const sitemap = read('public/sitemap.xml');
for (const url of requiredUrls) assert.ok(sitemap.includes(`<loc>${url}</loc>`), `Sitemap missing ${url}`);
assert.match(sitemap, /<lastmod>2026-09-09<\/lastmod>/);

for (const path of requiredPages) {
  const html = read(path);
  assert.match(html, /<title>[^<]+<\/title>/, `${path} needs a title`);
  assert.match(html, /<meta name="description" content="[^"]+"/, `${path} needs a description`);
  assert.match(html, /<meta name="robots" content="index,follow/, `${path} must be indexable`);
  assert.match(html, /<link rel="canonical" href="https:\/\/ballknowerofficial\.com\//, `${path} needs the official canonical`);
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0, `${path} needs structured data`);
  for (const [, json] of scripts) JSON.parse(json);
}

const faq = read('public/faq.html');
assert.match(faq, /"@type":"FAQPage"/);
assert.match(faq, /What is the official Ball Knower website\?/);
assert.match(faq, /ballknowerofficial\.com/);
assert.match(faq, /similarly named third-party apps and websites are separate products/i);

const llms = read('public/llms.txt');
assert.match(llms, /Official website: https:\/\/ballknowerofficial\.com\//);
assert.match(llms, /## Disambiguation/);
assert.match(llms, /Similarly named third-party apps, websites, games, and products are separate/i);

const manifest = JSON.parse(read('public/manifest.webmanifest'));
assert.equal(manifest.short_name, 'Ball Knower');
assert.equal(manifest.start_url, '/');
assert.ok(manifest.categories.includes('sports'));

const key = '1aa664e2f715ece0f5c3bedcfc833943';
assert.equal(read(`public/${key}.txt`).trim(), key);
const indexNow = read('.github/workflows/indexnow.yml');
assert.match(indexNow, /api\.indexnow\.org\/indexnow/);
assert.match(indexNow, /ballknowerofficial\.com/);

console.log('SEO discovery checks passed: crawl access, canonical identity, structured data, sitemap, FAQ, manifest, disambiguation, and IndexNow automation are present.');
