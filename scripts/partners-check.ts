import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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
assert.ok(data.includes("name: 'Tank01'") && data.includes("websiteUrl: 'https://www.tank01.com/'"), 'Tank01 must be linked as a data provider');
assert.ok(data.includes("partnerType: 'Official Sports Data Provider'") && data.includes("category: 'data'"), 'Tank01 must be categorized as the official sports data provider');
assert.ok(data.indexOf("name: 'Tank01'") < data.lastIndexOf('featuredOnHome: true'), 'Tank01 must appear in the compact Home partnership area');
assert.ok(data.includes('partnerType:') && data.includes('associatedTeam:') && data.includes('active:') && data.includes('sortOrder:') && data.includes('featuredOnHome:'), 'partner records must support future additions and independent Home placement');
assert.ok(data.includes('.filter(partner => partner.active)') && data.includes('.sort('), 'only active partners must display in the configured order');
assert.ok(data.includes('homePartners') && data.includes('.filter(partner => partner.featuredOnHome)'), 'Home partners must be selected independently from the full directory');
assert.ok(existsSync(new URL('../public/partners/cowboys-playbook-365.jpeg', import.meta.url)), 'the supplied logo must ship locally');
assert.ok(card.includes('target="_blank"') && card.includes('noopener noreferrer external'), 'partner links must open outside iOS without replacing app navigation');
assert.ok(card.includes('object-contain') && !card.includes('object-cover'), 'the supplied logo must display without cropping');
assert.ok(home.includes('Our Partners') && home.includes('<PartnerCard') && home.indexOf('Our Partners') > home.indexOf('Quick Links'), 'the subtle partner card must appear below primary home content');
assert.ok(card.includes('grid-cols-[56px_minmax(0,1fr)_auto]') && card.includes('h-14 w-14'), 'the Home partner treatment must stay compact on iPhone');
assert.ok(home.includes('homePartners.length>1&&<button'), 'the Home screen must not waste space on a view-all row for a single featured partner');
assert.ok(page.includes('partnerSections.map') && app.includes("currentTab==='partners'"), 'the generic grouped Partners page must be reachable');
assert.ok(page.includes('section.partners.map'), 'each partner category must render from shared partner data');
assert.ok(navbar.includes("setCurrentTab('partners')") && footer.includes('onOpenPartners'), 'Partners must be available from account and footer information areas');
assert.ok(page.includes('env(safe-area-inset-left)') && page.includes('env(safe-area-inset-bottom)'), 'the Partners page must respect iPhone safe areas');

console.log('Partner checks passed: exact media partner data, local logo, safe external link, and generic mobile-safe surfaces.');
