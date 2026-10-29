import {readOutfit,type Outfit} from './playerWardrobe';

/** Only the controlled athlete receives a personal outfit. Game renderers use kits. */
export function dressMyAthlete<T extends object>(athlete:T,setting:'workout'|'game',outfit:Outfit=readOutfit()):Omit<T,'wardrobe'>&{wardrobe?:Outfit}{
 const {wardrobe:_ignored,...player}=athlete as T&{wardrobe?:unknown};
 return setting==='game'?player:{...player,wardrobe:{...outfit}};
}
