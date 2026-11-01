import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { partners, activePartners, homePartners, partnerSections } from '../partners.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const data = read('partners.ts');
const card = read('PartnerCard.tsx');
const page = read('PartnersPage.tsx');
const home = read('HomeDashboard.tsx');
const app = read('App.tsx');
const navbar = read('Navbar.tsx');
const footer = read('LaunchCenter.tsx');

assert.ok(data.includes("name: 'The Cowboys Playbook 365'"), 'the official partner must be configured');
assert.ok(data.includes("websiteUrl: 'https://cowboysplaybook365.vercel.app/'"), 'the partner URL must be exact');
const historical = partners.find(partner => partner.name === 'Tank01');
assert.equal(historical?.websiteUrl, 'https://www.tank01.com/', 'retain the historical provider record');
assert.equal(historical?.active, false, 'Tank01 must not be advertised as an active provider');
assert.equal(historical?.featuredOnHome, false);
assert.ok(!activePartners.some(partner => partner.name === 'Tank01'));
assert.deepEqual(homePartners.map(partner => partner.name), ['The Cowboys Playbook 365'], 'Home partnership claims must be reserved for the configured media partner');
const sources = partnerSections.find(section => section.id === 'data');
assert.equal(sources?.label, 'NFL data sources');
assert.deepEqual(sources?.partners.map(partner => [partner.name, partner.websiteUrl]), [
  ['nflverse', 'https://github.com/nflverse/nflverse-data'],
  ['Currents News API', 'https://currentsapi.services/'],
]);
assert.ok(sources?.partners.every(partner => !/partner|real[- ]time|live scores/i.test(`${partner.partnerType} ${partner.description}`)), 'data-source descriptions must not imply formal partnerships or live statistics');
assert.match(sources!.partners[0].description, /periodically.*CC BY 4\.0/);
assert.match(sources!.partners[1].description, /headline.*publisher-link/);
assert.ok(data.includes('partnerType:') && data.includes('associatedTeam:') && data.includes('active:') && data.includes('sortOrder:') && data.includes('featuredOnHome:'), 'partner records must support future additions and independent Home placement');
assert.ok(data.includes('.filter(partner => partner.active)') && data.includes('.sort('), 'only active partners must display in the configured order');
assert.ok(data.includes('homePartners') && data.includes('.filter(partner => partner.featuredOnHome)'), 'Home partners must be selected independently from the full directory');
assert.ok(existsSync(new URL('../public/partners/cowboys-playbook-365.jpeg', import.meta.url)), 'the supplied logo must ship locally');
assert.ok(card.includes('target="_blank"') && card.includes('noopener noreferrer external'), 'partner links must open outside iOS without replacing app navigation');
assert.ok(card.includes('object-contain') && !card.includes('object-cover'), 'the supplied logo must display without cropping');
assert.ok(home.includes('Our Partners') && home.includes('<PartnerCard') && home.indexOf('Our Partners') > home.indexOf('Quick Links'), 'the subtle partner card must appear below primary home content');
assert.ok(card.includes('grid-cols-[56px_minmax(0,1fr)_auto]') && card.includes('h-14 w-14'), 'the Home partner treatment must stay compact on iPhone');
assert.match(home,/homePartners\.length\s*>\s*1\s*&&\s*<button/, 'the Home screen must offer the full directory when multiple featured partners are present');
assert.ok(page.includes('partnerSections.map') && app.includes("currentTab==='partners'"), 'the generic grouped Partners page must be reachable');
assert.ok(page.includes('section.partners.map'), 'each partner category must render from shared partner data');
assert.ok(page.includes('title="Partners & Data Sources"') && page.includes('published data sources used by Ball Knower'), 'directory wording must distinguish data sources from partnerships');
assert.ok(navbar.includes("setCurrentTab('partners')") && footer.includes('onOpenPartners'), 'Partners must be available from account and footer information areas');
assert.ok(page.includes('env(safe-area-inset-left)') && page.includes('env(safe-area-inset-bottom)'), 'the Partners page must respect iPhone safe areas');

console.log('Partner checks passed: preserved media partner, historical Tank01 hidden, truthful linked NFL data sources, local logo, safe external links, and mobile-safe surfaces.');
