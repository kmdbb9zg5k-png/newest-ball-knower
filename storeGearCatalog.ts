export type StoreHelmet = { id: string; name: string; rarity: 'legendary' | 'elite' | 'rare'; price: number; accent: string; description: string };

export const HELMETS: readonly StoreHelmet[] = [
  { id: 'gold-standard', name: 'Gold Standard', rarity: 'legendary', price: 2500, accent: '#f5bd36', description: 'A signature BK look. Premium mirrored gold finish, elite detail, and game-day dominance.' },
  { id: 'frostbite', name: 'Frostbite', rarity: 'elite', price: 2000, accent: '#30c9ff', description: 'Ice-white armor, frozen silver shell and electric blue visor accents.' },
  { id: 'shadow-ops', name: 'Shadow Ops', rarity: 'elite', price: 2000, accent: '#b6b8c5', description: 'Stealth-black carbon weave and dark-tinted game-day visor.' },
  { id: 'bloodline', name: 'Bloodline', rarity: 'legendary', price: 2750, accent: '#fc214d', description: 'Crimson lightning cuts through a dark high-gloss shell.' },
  { id: 'purple-reign', name: 'Purple Reign', rarity: 'elite', price: 2500, accent: '#b15bff', description: 'Royal violet chrome, gold crown details and a midnight visor.' },
  { id: 'camo-elite', name: 'Camo Elite', rarity: 'rare', price: 1500, accent: '#a9bc60', description: 'Woodland camouflage, armored trim and blackout facemask.' },
  { id: 'neon-strike', name: 'Neon Strike', rarity: 'elite', price: 2250, accent: '#baff00', description: 'Electric-lime highlights over a glossy jet-black shell.' },
  { id: 'chrome-phantom', name: 'Chrome Phantom', rarity: 'legendary', price: 2750, accent: '#dce5f1', description: 'Mirror-polished chrome and a fierce black smoked visor.' },
  { id: 'desert-storm', name: 'Desert Storm', rarity: 'rare', price: 1750, accent: '#e8bb81', description: 'Sand-colored digital camo with matching tan facemask.' },
  { id: 'titanium-edge', name: 'Titanium Edge', rarity: 'elite', price: 2250, accent: '#3facff', description: 'Carbon-black titanium weave with vivid blue accents.' },
];

export type StoreJersey = { id: string; name: string; rarity: 'legendary' | 'elite' | 'rare'; price: number; accent: string; description: string };

export const JERSEYS: readonly StoreJersey[] = [
  { id: 'gold-standard', name: 'Gold Standard', rarity: 'legendary', price: 2500, accent: '#f5bd36', description: 'A signature BK look. Premium materials, elite detail, and game-day dominance.' },
  { id: 'frostbite', name: 'Frostbite', rarity: 'elite', price: 2000, accent: '#30c9ff', description: 'Crystal-white frost textures, silver panels and electric blue trim.' },
  { id: 'shadow-ops', name: 'Shadow Ops', rarity: 'elite', price: 2000, accent: '#b6b8c5', description: 'Stealth-black carbon weave, tactical panels and smoke-gray stripes.' },
  { id: 'bloodline', name: 'Bloodline', rarity: 'legendary', price: 2750, accent: '#fc214d', description: 'Crimson lightning runs across a glossy black game-day jersey.' },
  { id: 'purple-reign', name: 'Purple Reign', rarity: 'elite', price: 2500, accent: '#b15bff', description: 'Royal purple shine with metallic gold crowns and premium trim.' },
  { id: 'camo-elite', name: 'Camo Elite', rarity: 'rare', price: 1500, accent: '#a9bc60', description: 'Woodland camouflage with olive detailing and black performance panels.' },
  { id: 'neon-strike', name: 'Neon Strike', rarity: 'elite', price: 2250, accent: '#baff00', description: 'High-voltage neon-lime details over a jet-black performance jersey.' },
  { id: 'chrome-phantom', name: 'Chrome Phantom', rarity: 'legendary', price: 2750, accent: '#dce5f1', description: 'Mirror-polished chrome panels and black-on-black luxury trim.' },
  { id: 'desert-storm', name: 'Desert Storm', rarity: 'rare', price: 1750, accent: '#e8bb81', description: 'Sand-toned digital camo with warm tan and black details.' },
  { id: 'titanium-edge', name: 'Titanium Edge', rarity: 'elite', price: 2250, accent: '#3facff', description: 'Carbon-black texture and vivid electric-blue performance lines.' },
];

export type StorePants = { id: string; name: string; rarity: 'legendary' | 'elite' | 'rare'; price: number; accent: string; description: string };

export const PANTS: readonly StorePants[] = [
  { id: 'gold-standard', name: 'Gold Standard', rarity: 'legendary', price: 2500, accent: '#f5bd36', description: 'A signature BK look. Metallic gold padding, black side stripes, premium detailing and game-day dominance.' },
  { id: 'frostbite', name: 'Frostbite', rarity: 'elite', price: 2000, accent: '#30c9ff', description: 'Frosted silver performance pants with ice-blue lightning and crystalline paneling.' },
  { id: 'shadow-ops', name: 'Shadow Ops', rarity: 'elite', price: 2000, accent: '#b6b8c5', description: 'Stealth-black technical panels and carbon-fiber textures for a covert game-day look.' },
  { id: 'bloodline', name: 'Bloodline', rarity: 'legendary', price: 2750, accent: '#fc214d', description: 'Crimson lightning tracks across deep-black, padded performance pants.' },
  { id: 'purple-reign', name: 'Purple Reign', rarity: 'elite', price: 2500, accent: '#b15bff', description: 'Royal-purple shine, black panels and metallic gold accents.' },
  { id: 'camo-elite', name: 'Camo Elite', rarity: 'rare', price: 1500, accent: '#a9bc60', description: 'Tactical woodland camo with black thigh pads and olive-green detailing.' },
  { id: 'neon-strike', name: 'Neon Strike', rarity: 'elite', price: 2250, accent: '#baff00', description: 'Electric neon-lime stripes over black performance fabric and game-day padding.' },
  { id: 'chrome-phantom', name: 'Chrome Phantom', rarity: 'legendary', price: 2750, accent: '#dce5f1', description: 'High-gloss chrome armor detailing over black technical panels.' },
  { id: 'desert-storm', name: 'Desert Storm', rarity: 'rare', price: 1750, accent: '#e8bb81', description: 'Sand-colored digital camouflage with contrasting black panels.' },
  { id: 'titanium-edge', name: 'Titanium Edge', rarity: 'elite', price: 2250, accent: '#3facff', description: 'Black carbon-fiber textures, bold blue stripes and reinforced padded knees.' },
];

export type StoreCleats = { id: string; name: string; rarity: 'legendary' | 'elite' | 'rare'; price: number; accent: string; description: string };

export const CLEATS: readonly StoreCleats[] = [
  { id: 'gold-standard', name: 'Gold Standard', rarity: 'legendary', price: 3500, accent: '#f5bd36', description: 'A signature BK look. Gold-plated accents and a black performance upper built for the biggest moments.' },
  { id: 'frostbite', name: 'Frostbite', rarity: 'elite', price: 3000, accent: '#30c9ff', description: 'Ice-white traction cleats with electric-blue accents and frosted detailing.' },
  { id: 'shadow-ops', name: 'Shadow Ops', rarity: 'elite', price: 3000, accent: '#b6b8c5', description: 'Stealth black-on-black cleats with textured uppers and a smoked soleplate.' },
  { id: 'bloodline', name: 'Bloodline', rarity: 'legendary', price: 3250, accent: '#fc214d', description: 'Blood-red lightning against a glossy black upper, with matching red studs.' },
  { id: 'purple-reign', name: 'Purple Reign', rarity: 'elite', price: 3000, accent: '#b15bff', description: 'Royal violet and metallic-gold cleats with a bold BK crest.' },
  { id: 'camo-elite', name: 'Camo Elite', rarity: 'rare', price: 2250, accent: '#a9bc60', description: 'Woodland camouflage cleats with rugged black and gold trims.' },
  { id: 'neon-strike', name: 'Neon Strike', rarity: 'elite', price: 2750, accent: '#baff00', description: 'Black and neon-lime cleats with high-voltage accents and matching studs.' },
  { id: 'chrome-phantom', name: 'Chrome Phantom', rarity: 'legendary', price: 3250, accent: '#dce5f1', description: 'Polished chrome finish over a jet-black football cleat.' },
  { id: 'desert-storm', name: 'Desert Storm', rarity: 'rare', price: 2500, accent: '#e8bb81', description: 'Desert-tan camo cleats with black accents and durable stud detailing.' },
  { id: 'titanium-edge', name: 'Titanium Edge', rarity: 'elite', price: 2750, accent: '#3facff', description: 'Black carbon-fiber cleats with striking blue graphics and blue studs.' },
];

export type StoreAccessorySet = {
  id: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  price: number;
  accent: string;
  description: string;
};

export const ACCESSORY_SETS: readonly StoreAccessorySet[] = [
  { id: 'gold-standard', name: 'Gold Standard', rarity: 'legendary', price: 3500, accent: '#f6cb53', description: 'Premium metallic-gold on-field essentials. The signature BK statement set.' },
  { id: 'volt', name: 'Volt', rarity: 'epic', price: 2750, accent: '#a3ff00', description: 'Black-and-electric-lime gear, designed for an explosive look.' },
  { id: 'frostbite', name: 'Frostbite', rarity: 'epic', price: 2750, accent: '#6fd6ff', description: 'Ice-white sleeves and blue-tinted accessories with frosted detailing.' },
  { id: 'inferno', name: 'Inferno', rarity: 'rare', price: 2250, accent: '#ff4939', description: 'Fiery red-on-black gear with bold, sharp accents.' },
  { id: 'night-ops', name: 'Night Ops', rarity: 'rare', price: 2250, accent: '#8797bd', description: 'A stealth-ready charcoal and black accessory combination.' },
  { id: 'royal', name: 'Royal', rarity: 'uncommon', price: 1750, accent: '#aa55ff', description: 'Purple-and-gold performance accessories with a royal finish.' },
  { id: 'ocean-wave', name: 'Ocean Wave', rarity: 'uncommon', price: 1750, accent: '#37e6db', description: 'Clean teal and aqua accessories with bright matching details.' },
  { id: 'crimson-strike', name: 'Crimson Strike', rarity: 'common', price: 1250, accent: '#ff5355', description: 'Crimson red gloves, sleeve, visor, and sideline essentials.' },
  { id: 'stealth', name: 'Stealth', rarity: 'common', price: 1250, accent: '#9ea3b2', description: 'The understated blacked-out essentials set.' },
  { id: 'galaxy', name: 'Galaxy', rarity: 'mythic', price: 4500, accent: '#f34dfb', description: 'A cosmic violet and electric-blue look for the boldest BK athletes.' },
];

export type StoreFit = { id:string; name:string; rarity:'legendary' | 'elite' | 'rare'; accent:string; price:number; detail:string; accessory:string; label:string };

export const GAME_FITS: readonly StoreFit[] = [
  {id:'gold-standard',name:'Gold Standard',rarity:'legendary',accent:'#f0bc4e',price:12500,accessory:'gold-standard',label:'Signature gold',detail:'The crown-jewel full BK look: black-and-gold helmet, matching jersey, pants, cleats and gold accessories.'},
  {id:'frostbite',name:'Frostbite',rarity:'elite',accent:'#7cdbff',price:10500,accessory:'frostbite',label:'Ice cold',detail:'Icy silver and electric-blue game gear from helmet to cleats, finished with Frostbite accessories.'},
  {id:'shadow-ops',name:'Shadow Ops',rarity:'elite',accent:'#b0b5c3',price:10000,accessory:'night-ops',label:'Stealth mode',detail:'Black-on-black carbon style with smoked details, built around a complete shadow-game aesthetic.'},
  {id:'bloodline',name:'Bloodline',rarity:'legendary',accent:'#ff3655',price:12000,accessory:'crimson-strike',label:'Redline ready',detail:'Black and crimson lightning across every piece, with fierce matching red accessory accents.'},
  {id:'purple-reign',name:'Purple Reign',rarity:'elite',accent:'#c77bff',price:11500,accessory:'royal',label:'Royal energy',detail:'Royal violet and metallic-gold gear with a matching purple accessories set.'},
  {id:'camo-elite',name:'Camo Elite',rarity:'rare',accent:'#9ab465',price:8500,accessory:'stealth',label:'Built different',detail:'Woodland camouflage from the helmet to the cleats, with stealth-black finishing details.'},
  {id:'neon-strike',name:'Neon Strike',rarity:'elite',accent:'#dbfc35',price:10000,accessory:'volt',label:'Voltage up',detail:'Electric neon-lime and jet-black equipment with high-energy Volt accessories.'},
  {id:'chrome-phantom',name:'Chrome Phantom',rarity:'legendary',accent:'#e1e6f0',price:12500,accessory:'night-ops',label:'Mirror finish',detail:'Polished chrome and silver game-day gear with smoked-black accessory accents.'},
  {id:'desert-storm',name:'Desert Storm',rarity:'rare',accent:'#dcb58a',price:9000,accessory:'stealth',label:'Sandstorm',detail:'Desert-tan camouflage equipment with black trims and understated accessories.'},
  {id:'titanium-edge',name:'Titanium Edge',rarity:'elite',accent:'#57baff',price:10500,accessory:'ocean-wave',label:'Blue lightning',detail:'Black carbon texture with electric-blue detailing, completed by ice-blue accessories.'},
];

export const STORE_GEAR_CART_PRODUCTS = [
  ...HELMETS.map(item => ({ id: 'helmet:' + item.id, name: item.name + ' Helmet', image: '/store/bk-helmet-' + item.id + '.webp' })),
  ...JERSEYS.map(item => ({ id: 'jersey:' + item.id, name: item.name + ' Jersey', image: '/store/bk-jersey-' + item.id + '.webp' })),
  ...PANTS.map(item => ({ id: 'pants:' + item.id, name: item.name + ' Pants', image: '/store/bk-pants-' + item.id + '.webp' })),
  ...CLEATS.map(item => ({ id: 'cleat:' + item.id, name: item.name + ' Cleats', image: '/store/bk-cleat-' + item.id + '.webp' })),
  ...ACCESSORY_SETS.map(item => ({ id: 'accessory:' + item.id, name: item.name + ' Accessory Set', image: '/store/bk-accessory-' + item.id + '.webp' })),
  ...GAME_FITS.map(item => ({ id: 'game-fit:' + item.id, name: item.name + ' Game Fit', image: '/store/bk-helmet-' + item.id + '.webp' })),
];
