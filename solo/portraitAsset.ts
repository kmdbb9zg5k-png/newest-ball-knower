import { CREATOR_EASTER_EGG_ID, FACE_COUNT, SOLO_ART_ROOT } from './appearance';
import type { AppearancePlayer } from './appearance';

export const PORTRAIT_COLUMNS = 3;
export const PORTRAIT_ROWS = 3;
export const CREATOR_PORTRAIT = `${SOLO_ART_ROOT}/creator/eli-face.webp`;

/** One source/crop contract for rows and full-body previews. A missing face is never replaced by a different person. */
export function portraitAsset(player: AppearancePlayer, face: number, previewFace = false) {
  const selected = Number.isInteger(face) && face >= 0 && face < FACE_COUNT ? face : 0;
  const single = player.id === CREATOR_EASTER_EGG_ID && !previewFace;
  return {
    src: single ? CREATOR_PORTRAIT : `${SOLO_ART_ROOT}/faces.webp`,
    single,
    face: selected,
    column: selected % PORTRAIT_COLUMNS,
    row: Math.floor(selected / PORTRAIT_COLUMNS),
  };
}
