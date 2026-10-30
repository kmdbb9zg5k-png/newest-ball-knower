import {careerJersey,type CareerJersey} from './careerJersey';
export type ClothingSlot='top'|'shorts'|'shoes'|'wrist';
export type ClothingItem={id:string;name:string;slot:ClothingSlot;color:string;style?:'jersey'|'tee'|'long-sleeve'|'hoodie'|'jeans'|'sweats';jersey?:CareerJersey;accent?:string;pattern?:boolean;premium?:boolean;description:string};
export const CLOTHING:ClothingItem[]=[
 {id:'top-standard',name:'BK Original',slot:'top',color:'#242a30',description:'The original charcoal training top.'},
 {id:'top-bone',name:'Bone Training Top',slot:'top',color:'#e4dfd2',description:'A clean, warm-white training essential.'},
 {id:'top-forest',name:'Forest Training Top',slot:'top',color:'#19604f',description:'Deep green performance fabric.'},
 {id:'shorts-standard',name:'Core Shorts',slot:'shorts',color:'#242a30',description:'Classic charcoal training shorts.'},
 {id:'shorts-slate',name:'Slate Shorts',slot:'shorts',color:'#597082',description:'Cool slate with a lightweight finish.'},
 {id:'shoes-standard',name:'Core Trainers',slot:'shoes',color:'#333940',description:'Your everyday dark training shoes.'},
 {id:'shoes-white',name:'Chalk Trainers',slot:'shoes',color:'#ece8df',description:'Clean white training shoes.'},
 {id:'wrist-none',name:'No Wristbands',slot:'wrist',color:'#242a30',description:'Keep your wrists clear.'},
 {id:'wrist-black',name:'Black Wristbands',slot:'wrist',color:'#111820',description:'A pair of classic black fabric bands.'},
 {id:'wrist-white',name:'White Wristbands',slot:'wrist',color:'#ece8df',description:'A pair of white fabric bands.'},
 {id:'top-navy',name:'Midnight Navy Training Top',slot:'top',color:'#172b48',description:'Midnight Navy training fabric for your everyday rotation.'},
 {id:'top-crimson',name:'Crimson Training Top',slot:'top',color:'#a52e40',description:'Crimson training fabric for your everyday rotation.'},
 {id:'top-royal',name:'Royal Blue Training Top',slot:'top',color:'#315bb5',description:'Royal Blue training fabric for your everyday rotation.'},
 {id:'top-teal',name:'Lagoon Teal Training Top',slot:'top',color:'#198c89',description:'Lagoon Teal training fabric for your everyday rotation.'},
 {id:'top-clay',name:'Desert Clay Training Top',slot:'top',color:'#b66f50',description:'Desert Clay training fabric for your everyday rotation.'},
 {id:'top-lavender',name:'Lavender Training Top',slot:'top',color:'#a195c5',description:'Lavender training fabric for your everyday rotation.'},
 {id:'top-ice',name:'Ice Blue Training Top',slot:'top',color:'#a4c9dc',description:'Ice Blue training fabric for your everyday rotation.'},
 {id:'top-orange',name:'Sunset Orange Training Top',slot:'top',color:'#dc7633',description:'Sunset Orange training fabric for your everyday rotation.'},
 {id:'top-track',name:'Track Stripe Top',slot:'top',color:'#182a42',accent:'#e9e6da',pattern:true,description:'Cream diagonal stripes on a sleeveless training top.'},
 {id:'top-mint',name:'Mint Sprint Top',slot:'top',color:'#194d46',accent:'#a6e2c6',pattern:true,description:'Mint diagonal stripes on a sleeveless training top.'},
 {id:'top-rose',name:'Rose Circuit Top',slot:'top',color:'#492a3e',accent:'#ee9cb5',pattern:true,description:'Rose diagonal stripes on a sleeveless training top.'},
 {id:'top-volt',name:'Volt Stripe Top',slot:'top',color:'#262f36',accent:'#c6e75a',pattern:true,description:'Lime diagonal stripes on a sleeveless training top.'},
 {id:'shorts-navy',name:'Midnight Navy Shorts',slot:'shorts',color:'#172b48',description:'Midnight Navy training shorts to mix with your favorite top.'},
 {id:'shorts-crimson',name:'Crimson Shorts',slot:'shorts',color:'#a52e40',description:'Crimson training shorts to mix with your favorite top.'},
 {id:'shorts-royal',name:'Royal Blue Shorts',slot:'shorts',color:'#315bb5',description:'Royal Blue training shorts to mix with your favorite top.'},
 {id:'shorts-teal',name:'Lagoon Teal Shorts',slot:'shorts',color:'#198c89',description:'Lagoon Teal training shorts to mix with your favorite top.'},
 {id:'shorts-clay',name:'Desert Clay Shorts',slot:'shorts',color:'#b66f50',description:'Desert Clay training shorts to mix with your favorite top.'},
 {id:'shorts-lavender',name:'Lavender Shorts',slot:'shorts',color:'#a195c5',description:'Lavender training shorts to mix with your favorite top.'},
 {id:'shorts-ice',name:'Ice Blue Shorts',slot:'shorts',color:'#a4c9dc',description:'Ice Blue training shorts to mix with your favorite top.'},
 {id:'shorts-orange',name:'Sunset Orange Shorts',slot:'shorts',color:'#dc7633',description:'Sunset Orange training shorts to mix with your favorite top.'},
 {id:'shorts-bone',name:'Bone Shorts',slot:'shorts',color:'#e4dfd2',description:'Bone training shorts to mix with your favorite top.'},
 {id:'shorts-forest',name:'Forest Shorts',slot:'shorts',color:'#19604f',description:'Forest training shorts to mix with your favorite top.'},
 {id:'shoes-navy',name:'Midnight Navy Trainers',slot:'shoes',color:'#172b48',description:'Everyday trainers in a midnight navy colorway.'},
 {id:'shoes-crimson',name:'Crimson Trainers',slot:'shoes',color:'#a52e40',description:'Everyday trainers in a crimson colorway.'},
 {id:'shoes-royal',name:'Royal Blue Trainers',slot:'shoes',color:'#315bb5',description:'Everyday trainers in a royal blue colorway.'},
 {id:'shoes-teal',name:'Lagoon Teal Trainers',slot:'shoes',color:'#198c89',description:'Everyday trainers in a lagoon teal colorway.'},
 {id:'shoes-clay',name:'Desert Clay Trainers',slot:'shoes',color:'#b66f50',description:'Everyday trainers in a desert clay colorway.'},
 {id:'shoes-lavender',name:'Lavender Trainers',slot:'shoes',color:'#a195c5',description:'Everyday trainers in a lavender colorway.'},
 {id:'shoes-ice',name:'Ice Blue Trainers',slot:'shoes',color:'#a4c9dc',description:'Everyday trainers in an ice blue colorway.'},
 {id:'shoes-orange',name:'Sunset Orange Trainers',slot:'shoes',color:'#dc7633',description:'Everyday trainers in a sunset orange colorway.'},
 {id:'shoes-forest',name:'Forest Trainers',slot:'shoes',color:'#19604f',description:'Everyday trainers in a forest colorway.'},
 {id:'shoes-sand',name:'Sand Trainers',slot:'shoes',color:'#bcaa86',description:'Everyday trainers in a sand colorway.'},
 {id:'wrist-navy',name:'Midnight Navy Wristbands',slot:'wrist',color:'#172b48',description:'A pair of midnight navy fabric wristbands for both wrists.'},
 {id:'wrist-crimson',name:'Crimson Wristbands',slot:'wrist',color:'#a52e40',description:'A pair of crimson fabric wristbands for both wrists.'},
 {id:'wrist-royal',name:'Royal Blue Wristbands',slot:'wrist',color:'#315bb5',description:'A pair of royal blue fabric wristbands for both wrists.'},
 {id:'wrist-teal',name:'Lagoon Teal Wristbands',slot:'wrist',color:'#198c89',description:'A pair of lagoon teal fabric wristbands for both wrists.'},
 {id:'wrist-clay',name:'Desert Clay Wristbands',slot:'wrist',color:'#b66f50',description:'A pair of desert clay fabric wristbands for both wrists.'},
 {id:'wrist-lavender',name:'Lavender Wristbands',slot:'wrist',color:'#a195c5',description:'A pair of lavender fabric wristbands for both wrists.'},
 {id:'wrist-ice',name:'Ice Blue Wristbands',slot:'wrist',color:'#a4c9dc',description:'A pair of ice blue fabric wristbands for both wrists.'},
 {id:'wrist-orange',name:'Sunset Orange Wristbands',slot:'wrist',color:'#dc7633',description:'A pair of sunset orange fabric wristbands for both wrists.'},
 {id:'top-tee-chalk',name:'Chalk Tee',slot:'top',style:'tee',color:'#ece8df',description:'Tee with a relaxed athletic fit. Free to mix into your everyday outfit.'},
 {id:'top-tee-black',name:'Black Tee',slot:'top',style:'tee',color:'#20262c',description:'Tee with a relaxed athletic fit. Free to mix into your everyday outfit.'},
 {id:'top-tee-crimson',name:'Crimson Tee',slot:'top',style:'tee',color:'#a52e40',description:'Tee with a relaxed athletic fit. Free to mix into your everyday outfit.'},
 {id:'top-long-sleeve-navy',name:'Navy Long Sleeve',slot:'top',style:'long-sleeve',color:'#172b48',description:'Long Sleeve with a relaxed athletic fit. Free to mix into your everyday outfit.'},
 {id:'top-long-sleeve-bone',name:'Bone Long Sleeve',slot:'top',style:'long-sleeve',color:'#e4dfd2',description:'Long Sleeve with a relaxed athletic fit. Free to mix into your everyday outfit.'},
 {id:'top-long-sleeve-forest',name:'Forest Long Sleeve',slot:'top',style:'long-sleeve',color:'#19604f',description:'Long Sleeve with a relaxed athletic fit. Free to mix into your everyday outfit.'},
 {id:'top-hoodie-grey',name:'Grey Hoodie',slot:'top',style:'hoodie',color:'#8c9093',description:'Hoodie with a relaxed athletic fit. Free to mix into your everyday outfit.'},
 {id:'top-hoodie-black',name:'Black Hoodie',slot:'top',style:'hoodie',color:'#20262c',description:'Hoodie with a relaxed athletic fit. Free to mix into your everyday outfit.'},
 {id:'top-hoodie-lavender',name:'Lavender Hoodie',slot:'top',style:'hoodie',color:'#a195c5',description:'Hoodie with a relaxed athletic fit. Free to mix into your everyday outfit.'},
 {id:'shorts-jeans-indigo',name:'Indigo Jeans',slot:'shorts',style:'jeans',color:'#324c6d',description:'Jeans with a denim finish. Free to mix into your everyday outfit.'},
 {id:'shorts-jeans-black',name:'Black Jeans',slot:'shorts',style:'jeans',color:'#292d33',description:'Jeans with a denim finish. Free to mix into your everyday outfit.'},
 {id:'shorts-jeans-stonewash',name:'Stonewash Jeans',slot:'shorts',style:'jeans',color:'#7998b4',description:'Jeans with a denim finish. Free to mix into your everyday outfit.'},
 {id:'shorts-sweats-grey',name:'Grey Sweats',slot:'shorts',style:'sweats',color:'#8c9093',description:'Sweats with a relaxed athletic fit. Free to mix into your everyday outfit.'},
 {id:'shorts-sweats-black',name:'Black Sweats',slot:'shorts',style:'sweats',color:'#20262c',description:'Sweats with a relaxed athletic fit. Free to mix into your everyday outfit.'},
 {id:'shorts-sweats-sand',name:'Sand Sweats',slot:'shorts',style:'sweats',color:'#bcaa86',description:'Sweats with a relaxed athletic fit. Free to mix into your everyday outfit.'},
 {id:'top-career-jersey',name:'My Team Jersey',slot:'top',style:'jersey',color:'#242a30',description:'Your current career team jersey, without shoulder pads. Uses your name and number; updates when you change teams.'},
 {id:'top-gold',name:'Gold Standard',slot:'top',color:'#29231a',accent:'#d9b05b',pattern:true,premium:true,description:'Gold diagonal striping on a dark training top.'},
 {id:'top-electric',name:'Electric Blue',slot:'top',color:'#163866',accent:'#65d3ed',pattern:true,premium:true,description:'Bright blue striping for the spotlight.'},
 {id:'shoes-gold',name:'Gold Rush Trainers',slot:'shoes',color:'#c6a04d',premium:true,description:'A gold colorway for your training shoes.'},
 {id:'wrist-gold',name:'Gold Wristbands',slot:'wrist',color:'#c6a04d',premium:true,description:'Gold fabric bands to finish your outfit.'},
];
export const CLOTHING_SLOTS:ClothingSlot[]=['top','shorts','shoes','wrist'];
export type Outfit=Record<ClothingSlot,string>;
export const DEFAULT_OUTFIT:Outfit={top:'top-standard',shorts:'shorts-standard',shoes:'shoes-standard',wrist:'wrist-none'};
export const WARDROBE_KEY='ballknower_player_wardrobe_v1',WARDROBE_CHANGED='ballknower:wardrobe-changed';
// Device saves are free-only. Paid ownership comes from the authenticated server.
let verified:{owned:string[];outfit:Outfit|null;expires:number}|null=null;
let expiry:ReturnType<typeof setTimeout>|undefined;
export function setVerifiedWardrobe(value:{owned:string[];outfit:Outfit|null}|null){
 if(expiry)clearTimeout(expiry);
 verified=value?{...value,expires:Date.now()+120000}:null;
 if(value)expiry=setTimeout(()=>setVerifiedWardrobe(null),120000);
 if(typeof window!=='undefined')window.dispatchEvent(new Event(WARDROBE_CHANGED));
}
export function cleanOutfit(raw:unknown):Outfit{
 const value=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 return Object.fromEntries(CLOTHING_SLOTS.map(slot=>[slot,CLOTHING.find(item=>item.id===value[slot]&&item.slot===slot&&!item.premium)?.id||DEFAULT_OUTFIT[slot]])) as Outfit;
}
export function readOutfit():Outfit{
 let free:Outfit;try{free=cleanOutfit(JSON.parse(localStorage.getItem(WARDROBE_KEY)||'{}'));}catch{free={...DEFAULT_OUTFIT};}
 if(!verified||verified.expires<=Date.now()||!verified.outfit)return free;
 const result=cleanOutfit(verified.outfit);
 for(const slot of CLOTHING_SLOTS){const item=CLOTHING.find(v=>v.id===verified!.outfit![slot]&&v.slot===slot);if(item?.premium&&verified.owned.includes(item.id))result[slot]=item.id;}
 return result;
}
export function saveOutfit(outfit:Outfit){const clean=cleanOutfit(outfit);localStorage.setItem(WARDROBE_KEY,JSON.stringify(clean));window.dispatchEvent(new Event(WARDROBE_CHANGED));return clean;}
export function wardrobeCatalog():ClothingItem[]{return CLOTHING.map(item=>{if(item.id!=='top-career-jersey')return item;const jersey=careerJersey();return {...item,color:jersey.color,accent:jersey.accent,jersey,description:`${jersey.teamName} · #${jersey.number} ${jersey.playerName}. Unpadded. ${jersey.team==='BK'?'Your team appears after you join a roster.':'Automatically follows your current career team.'}`};});}
export function outfitLook(outfit:Outfit){const catalog=wardrobeCatalog();return Object.fromEntries(CLOTHING_SLOTS.map(slot=>[slot,catalog.find(item=>item.id===outfit[slot]&&item.slot===slot)||CLOTHING.find(item=>item.id===DEFAULT_OUTFIT[slot])!])) as Record<ClothingSlot,ClothingItem>;}
