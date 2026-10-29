export type ClothingSlot='top'|'shorts'|'shoes'|'wrist';
export type ClothingItem={id:string;name:string;slot:ClothingSlot;color:string;accent?:string;pattern?:boolean;premium?:boolean;description:string};
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
 {id:'top-gold',name:'Gold Standard',slot:'top',color:'#29231a',accent:'#d9b05b',pattern:true,premium:true,description:'Gold diagonal striping on a dark training top.'},
 {id:'top-electric',name:'Electric Blue',slot:'top',color:'#163866',accent:'#65d3ed',pattern:true,premium:true,description:'Bright blue striping for the spotlight.'},
 {id:'shoes-gold',name:'Gold Rush Trainers',slot:'shoes',color:'#c6a04d',premium:true,description:'A gold colorway for your training shoes.'},
 {id:'wrist-gold',name:'Gold Wristbands',slot:'wrist',color:'#c6a04d',premium:true,description:'Gold fabric bands to finish your outfit.'},
];
export const CLOTHING_SLOTS:ClothingSlot[]=['top','shorts','shoes','wrist'];
export type Outfit=Record<ClothingSlot,string>;
export const DEFAULT_OUTFIT:Outfit={top:'top-standard',shorts:'shorts-standard',shoes:'shoes-standard',wrist:'wrist-none'};
export const WARDROBE_KEY='ballknower_player_wardrobe_v1',WARDROBE_CHANGED='ballknower:wardrobe-changed';
// This release has no paid ownership. Local storage must never grant premium items.
// Future purchases require verified account entitlements, not an "owned" flag here.
export function cleanOutfit(raw:unknown):Outfit{
 const value=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 return Object.fromEntries(CLOTHING_SLOTS.map(slot=>[slot,CLOTHING.find(item=>item.id===value[slot]&&item.slot===slot&&!item.premium)?.id||DEFAULT_OUTFIT[slot]])) as Outfit;
}
export function readOutfit():Outfit{try{return cleanOutfit(JSON.parse(localStorage.getItem(WARDROBE_KEY)||'{}'));}catch{return {...DEFAULT_OUTFIT};}}
export function saveOutfit(outfit:Outfit){const clean=cleanOutfit(outfit);localStorage.setItem(WARDROBE_KEY,JSON.stringify(clean));window.dispatchEvent(new Event(WARDROBE_CHANGED));return clean;}
export function outfitLook(outfit:Outfit){return Object.fromEntries(CLOTHING_SLOTS.map(slot=>[slot,CLOTHING.find(item=>item.id===outfit[slot]&&item.slot===slot)||CLOTHING.find(item=>item.id===DEFAULT_OUTFIT[slot])!])) as Record<ClothingSlot,ClothingItem>;}
