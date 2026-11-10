import type { GameGear } from './playerGameGear';
import type { Outfit } from './playerWardrobe';

export const STORE_CATEGORIES = [
  { id: 'game-gear', label: 'Game Gear' },
  { id: 'tunnel-fits', label: 'Tunnel Fits' },
  { id: 'profile', label: 'Profile' },
  { id: 'celebrations', label: 'Celebrations' },
  { id: 'franchise', label: 'Franchise' },
  { id: 'bundles', label: 'Bundles' },
] as const;

export type StoreCategory = typeof STORE_CATEGORIES[number]['id'];
export type StoreFilter = 'all' | StoreCategory;

type TryOn = { gear: Partial<GameGear> } | { outfit: Partial<Outfit> };

export type StoreProduct = {
  id: string;
  name: string;
  summary: string;
  description: string;
  priceCents: number;
  categories: readonly StoreCategory[];
  includes: readonly string[];
  use: string;
  tryOn?: TryOn;
};

export const BLACKOUT_KIT: StoreProduct = {
  id: 'blackout',
  name: 'Blackout Gear Kit',
  summary: 'Visor, gloves, cleats & sleeves',
  description: 'An all-black look for your next kickoff. Wear the matching set or style each piece separately.',
  priceCents: 499,
  categories: ['game-gear', 'bundles'],
  includes: ['Smoked visor', 'Blackout gloves', 'Blackout cleats', 'Compression sleeves'],
  use: 'My Player game gear',
  tryOn: { gear: { gloves: 'black', cleats: 'black', leftSleeve: 'black', rightSleeve: 'black' } },
};

export const FEATURED_PACKS: readonly StoreProduct[] = [
  {
    id: 'profile-pack',
    name: 'Profile Pack',
    summary: 'Frame + nameplate',
    description: 'A brushed-gold frame and matching nameplate for your Ball Knower identity.',
    priceCents: 199,
    categories: ['profile', 'bundles'],
    includes: ['Brushed-gold profile frame', 'Matching nameplate'],
    use: 'Profile and Community',
  },
  {
    id: 'founders-pack',
    name: 'Founder’s Pack',
    summary: 'Gold gear + badge',
    description: 'A matching black-and-gold look for your athlete and a Founding Member badge for your profile.',
    priceCents: 799,
    categories: ['game-gear', 'profile', 'bundles'],
    includes: ['Black-and-gold helmet and gloves', 'Profile frame and nameplate', 'Founding Member badge'],
    use: 'My Player and Profile',
  },
];

export const STORE_PRODUCTS: readonly StoreProduct[] = [
  BLACKOUT_KIT,
  ...FEATURED_PACKS,
  {
    id: 'chrome-grip',
    name: 'Chrome Grip Gloves',
    summary: 'Metallic receiver gloves',
    description: 'Textured black receiver gloves with cool chrome accents.',
    priceCents: 99,
    categories: ['game-gear'],
    includes: ['Chrome Grip receiver gloves'],
    use: 'My Player game gear',
  },
  {
    id: 'tunnel-fit',
    name: 'Tunnel Fit',
    summary: 'Hoodie, sweats & trainers',
    description: 'A coordinated graphite outfit with a warm gold trim for training and tunnel arrivals.',
    priceCents: 299,
    categories: ['tunnel-fits', 'bundles'],
    includes: ['Graphite hoodie', 'Graphite sweats', 'Slate trainers'],
    use: 'My Player Locker and Combine',
    tryOn: { outfit: { top: 'top-tunnel-fit', shorts: 'shorts-tunnel-fit', shoes: 'shoes-tunnel-fit' } },
  },
  {
    id: 'gold-standard',
    name: 'Gold Standard',
    summary: 'Gold tracksuit & black-gold trainers',
    description: 'The Gold Standard tunnel collection pairs champagne-gold performance fabric with black panels, cuffs and matching trainers.',
    priceCents: 299,
    categories: ['tunnel-fits', 'bundles'],
    includes: ['Gold Standard track top', 'Gold Standard joggers', 'Black-and-gold trainers'],
    use: 'My Player Locker and Combine',
    tryOn: { outfit: { top: 'top-gold-standard', shorts: 'shorts-gold-standard', shoes: 'shoes-gold-standard' } },
  },
  {
    id: 'bkf-youngboy',
    name: 'BKF YoungBoy',
    summary: 'Shiesty mask, black hoodie, cargos, gold & boots',
    description: 'Street-luxury concept pack inspired by the approved crouched pose: black ski mask, oversized black BK hoodie, baggy brown cargo trousers, rugged tan boots, Cuban-link gold chain and diamond-style watch. The artwork is a concept preview. Detailed wearable 3D assets, ownership and purchasing are not available yet.',
    priceCents: 0,
    categories: ['tunnel-fits', 'bundles'],
    includes: ['Black BK hoodie', 'Brown baggy cargo pants', 'Black shiesty mask', 'Gold Cuban-link chain', 'Diamond-style watch', 'Tan boots'],
    use: 'Streetwear concept collection',
  },
  {
    id: 'ink-pack',
    name: 'Ink Pack',
    summary: 'Three original tattoo designs',
    description: 'Choose from three blackwork designs to customize your athlete in the player builder.',
    priceCents: 199,
    categories: ['tunnel-fits'],
    includes: ['Lightning tattoo', 'Geometric band tattoo', 'Laurel tattoo'],
    use: 'My Player builder',
  },
  {
    id: 'end-zone-backflip',
    name: 'End Zone Backflip',
    summary: 'Touchdown celebration',
    description: 'A signature backflip celebration for the moment your player crosses the goal line.',
    priceCents: 199,
    categories: ['celebrations'],
    includes: ['End Zone Backflip celebration'],
    use: 'My Player touchdown celebrations',
  },
  {
    id: 'franchise-branding',
    name: 'Franchise Branding Pack',
    summary: 'Banner, logos & press room',
    description: 'Build a matching front-office identity around a black-and-gold club crest.',
    priceCents: 399,
    categories: ['franchise', 'bundles'],
    includes: ['Team banner', 'Club logo set', 'Press room theme'],
    use: 'Franchise Command',
  },
];

export const storeImage = (id: string) => '/store/' + id + (id === 'bkf-youngboy' ? '.svg' : '.webp');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const storePrice = (product: StoreProduct) => product.id === 'bkf-youngboy' ? 'Coming soon' : usd.format(product.priceCents / 100);
