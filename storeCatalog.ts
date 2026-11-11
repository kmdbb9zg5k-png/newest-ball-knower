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
  department?: 'clothing';
  posterOnly?: boolean;
  proposedCoins?: number;
  showcase?: { model?: string; look: string; collection: string; theme: string; pose?: 'A-pose' };
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
    id: 'bfk-dee', name: 'BKF Dee',
    summary: 'Black leather, burgundy top & matching high-tops',
    description: 'BKF Dee pairs a black leather jacket with a burgundy crop top, loose leather cargo pants and burgundy, black and white sneakers. Explore the full poster and full-body A-pose photo. Wearable items, purchasing and gifting are not available yet.',
    priceCents: 0, categories: ['tunnel-fits', 'bundles'],
    includes: ['Black leather jacket', 'Burgundy crop top', 'Black leather cargo pants', 'Burgundy, black and white sneakers', 'BK necklace', 'Earrings'],
    use: 'BKF Dee outfit pack · Photo collection',
    showcase: { look: '/store/bfk-dee-apose-v2.webp', collection: 'BKF Dee · Burgundy & Chrome Collection', theme: 'dee', pose: 'A-pose' },
  },
  {
    id: 'bk-femme', name: 'BKF Nicki', proposedCoins: 1500,
    summary: 'Leather jacket, crop top, cargos & silver accessories',
    description: 'BKF Nicki pairs a black leather jacket and white crop top with loose leather cargos, black-and-white sneakers and silver accessories. Explore the campaign poster, full-body A-pose and detailed rotating 3D showcase. Proposed pack price: 1,500 BK Coins. Wearable items, purchasing and gifting are not available yet.',
    priceCents: 0, categories: ['tunnel-fits', 'bundles'],
    includes: ['Leather jacket', 'White crop top', 'Black cargo pants', 'Black-and-white sneakers', 'BK necklace', 'Earrings'],
    use: 'BKF Nicki outfit pack · Character showcase',
    showcase: { model: 'https://v3b.fal.media/files/b/0ab1f89e/7V-fQltpUHPX18nf2I0aG_model.glb', look: '/store/bkf-nicki-apose-v1.webp', collection: 'BKF Nicki · Leather Collection', theme: 'nicki' },
  },
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
    name: 'Gray Standard',
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
    description: 'Street-luxury concept pack featuring an upright 3D athlete: black ski mask, oversized black BK hoodie, baggy brown cargo trousers, rugged tan boots, Cuban-link gold chain and diamond-style watch. The artwork is a concept preview. Detailed wearable 3D assets, ownership and purchasing are not available yet.',
    priceCents: 0,
    categories: ['tunnel-fits', 'bundles'],
    includes: ['Black BK hoodie', 'Brown baggy cargo pants', 'Black shiesty mask', 'Gold Cuban-link chain', 'Diamond-style watch', 'Tan boots'],
    use: 'Streetwear concept collection',
  },
  {
    id: 'frostbite',
    name: 'Frostbite',
    summary: 'Ice-silver puffer, white mask & glacier cargos',
    description: 'An icy streetwear concept featuring a glossy silver-white quilted puffer, white knit balaclava, pale-gray cargo trousers, silver Cuban-link chain, diamond-style watch and icy white boots. The complete rigged 3D character is available to preview; individual wearable clothing, ownership and checkout are not available yet.',
    priceCents: 0,
    categories: ['tunnel-fits', 'bundles'],
    includes: ['Ice-silver quilted puffer', 'White knit balaclava', 'Ice-gray cargo pants', 'Silver Cuban-link chain', 'Diamond-style watch', 'Icy white high-top boots'],
    use: 'Streetwear concept collection',
  },
  {
    id: 'bkf-iron-wolf', name: 'Iron Wolf',
    summary: 'Charcoal & silver · Wolf character streetwear',
    description: 'An original wolf character in a washed-charcoal BK hoodie, oversized cargo pants, silver chain and black-and-silver sneakers. Explore the full poster, standing reference and detailed 360° model. This is a static showcase character; wearable items, purchasing and ownership are not available yet.',
    priceCents: 0, categories: ['tunnel-fits', 'bundles'],
    includes: ['Iron Wolf character', 'Charcoal BK hoodie', 'Oversized charcoal cargos', 'Silver chain', 'Black-and-silver sneakers'],
    use: 'Charcoal & Silver collection concept preview',
    showcase: { model: '/store/bkf-iron-wolf-athlete-v1.glb', look: '/store/bkf-iron-wolf-look.webp', collection: 'Charcoal & Silver Collection', theme: 'iron-wolf' },
  },
  {
    id: 'bkf-phantom', name: 'The Phantom',
    summary: 'Shadow kit · Tactical hoodie, chrome mask & boots',
    description: 'The Phantom moves in silence: a matte-black layered tactical streetwear hoodie, dark chrome face mask, technical cargo trousers, silver BK chain, black lace-up boots and a metal watch. An original cinematic masked streetwear character. The 3D preview is a static showcase character that rotates 360°; individual wearable items, purchasing, and ownership are not available yet.',
    priceCents: 0, categories: ['tunnel-fits', 'bundles'],
    includes: ['Black tactical hoodie-jacket', 'Chrome-trim mask', 'Black technical cargo trousers', 'Black combat boots', 'Silver BK chain', 'Silver wristwatch'],
    use: 'Shadow collection concept preview',
    showcase: { model: 'https://v3b.fal.media/files/b/0ab1f248/LwJJTnq5TIJ6S9RsHOcW0_model.glb', look: 'https://v3b.fal.media/files/b/0ab1f21d/aEW__qpU6k2Ik8P7TywbO_lUUJVFfQ.png', collection: 'Shadow Collection', theme: 'phantom' },
  },
  {
    id: 'black-tie', name: 'Black Tie', department: 'clothing',
    summary: 'Country Boy · Classic black tuxedo',
    description: 'Country Boy dressed for the spotlight: a tailored black tuxedo, crisp white dress shirt, black bow tie and polished dress shoes. Explore the campaign cover, realistic reference and full 360° showcase. Wearable garments and checkout are not available yet.',
    priceCents: 0, categories: ['tunnel-fits', 'bundles'],
    includes: ['Black tuxedo jacket', 'White dress shirt', 'Black bow tie', 'Tailored black trousers', 'Polished black dress shoes'],
    use: 'Country Boy formalwear collection',
    showcase: { model: '/store/black-tie-athlete-v1.glb', look: '/store/black-tie-look.webp', collection: 'Country Boy · Formal Collection', theme: 'black-tie' },
  },
  {
    id: 'ivory-standard', name: 'Ivory Standard', department: 'clothing',
    summary: 'Country Boy · Ivory tunnel fit',
    description: 'A coordinated ivory tunnel fit on the Country Boy showcase model: a cream hoodie, matching joggers and clean light trainers. Explore the campaign cover, realistic reference and full 360° showcase. Wearable garments and checkout are not available yet.',
    priceCents: 0, categories: ['tunnel-fits', 'bundles'],
    includes: ['Ivory hoodie', 'Matching ivory joggers', 'Light trainers'],
    use: 'Country Boy tunnel collection',
    showcase: { model: '/store/ivory-standard-athlete-v1.glb', look: '/store/ivory-standard-look.webp', collection: 'Country Boy · Tunnel Collection', theme: 'ivory-standard' },
  },
  {
    id: 'bkf-outlaw', name: 'BKF Outlaw',
    summary: 'Country Boy · Plaid, denim & cowboy boots',
    description: 'Red plaid over a white tank. A weathered cowboy hat, classic denim, engraved belt buckle and stitched leather boots. The original Country Boy showcase character.',
    priceCents: 0, categories: ['tunnel-fits', 'bundles'],
    includes: ['Cowboy hat', 'Red plaid shirt', 'White tank top', 'Denim jeans', 'Western belt buckle', 'Cowboy boots'],
    use: 'Country collection',
    showcase: { model: '/store/bkf-outlaw-athlete-v1.glb', look: '/store/bkf-outlaw-look.webp', collection: 'Country Collection', theme: 'outlaw' },
  },
  {
    id: 'bkf-kickflip', name: 'BKF Kickflip',
    summary: 'Skater · Layered BKF tee & baggy denim',
    description: 'Washed-black BKF tee over cream sleeves. A knit beanie, baggy denim with a wallet chain, and worn skate shoes. The original Kickflip showcase character.',
    priceCents: 0, categories: ['tunnel-fits', 'bundles'],
    includes: ['BKF knit beanie', 'Layered BKF tee', 'Cream long sleeves', 'Baggy black denim', 'Wallet chain', 'Skate shoes'],
    use: 'Skate collection',
    showcase: { model: '/store/bkf-kickflip-athlete-v1.glb', look: '/store/bkf-kickflip-look.webp', collection: 'Skate Collection', theme: 'kickflip' },
  },
  {
    id: 'bkf-lowrider', name: 'BKF Lowrider',
    summary: 'Plaid, baggy khakis & clean white kicks',
    description: 'Charcoal plaid over a white tank. A black paisley bandana, baggy khakis and crisp white sneakers, finished with a silver chain. Classic lowrider-inspired streetwear on its own showcase character.',
    priceCents: 0, categories: ['tunnel-fits', 'bundles'],
    includes: ['Black paisley bandana', 'Plaid short-sleeve shirt', 'White ribbed tank', 'Baggy khaki pants', 'Silver chain', 'White low-top sneakers'],
    use: 'Lowrider collection',
    showcase: { model: '/store/bkf-lowrider-athlete-v1.glb', look: '/store/bkf-lowrider-look.webp', collection: 'Lowrider Collection', theme: 'lowrider' },
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

export const storeImage = (id: string) => id === 'bfk-dee'
  ? '/store/bkf-dee-cover-v2.webp'
  : id === 'bk-femme'
  ? '/store/bkf-nicki-cover-v3.webp'
  : id === 'bkf-phantom'
  ? 'https://v3b.fal.media/files/b/0ab1f22f/ZV1i2C4x_u3pGyWgsReKS_7OOQNTpM.png'
  : id === 'gold-standard'
  ? 'https://v3b.fal.media/files/b/0ab1ee44/enaihGc_oxFoSOBQfobNp_gold_standard_outfit_pack.png'
  : id === 'gold-standard-realistic'
  ? 'https://v3b.fal.media/files/b/0ab1ee44/Ko9rmQPklzzMtX5q6LNRn_golden_bk_tracksuit_athlete.png'
  : id === 'bkf-youngboy'
  ? '/store/bkf-youngboy-cover.webp'
  : id === 'bkf-youngboy-look'
  ? 'https://v3b.fal.media/files/b/0ab1ea94/Xh-J82kvc_xaAQT6S_pUO_USEo0H0r.png'
  : id === 'frostbite'
  ? 'https://v3b.fal.media/files/b/0ab1ed77/_WCyDW9OAkL4xAehcl2KE_3CD98264-BD29-4D30-9FAE-8EE444BB6E92.jpeg'
  : id === 'frostbite-look'
  ? 'https://v3b.fal.media/files/b/0ab1ea94/hSYeTuHMXg21r6ipNqX7c_ByU6fl61.png'
  : '/store/' + id + '.webp';
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const storePrice = (product: StoreProduct) => product.proposedCoins ? `${product.proposedCoins.toLocaleString('en-US')} BK Coins` : (product.showcase || product.id === 'bkf-youngboy' || product.id === 'frostbite') ? 'Coming soon' : usd.format(product.priceCents / 100);
