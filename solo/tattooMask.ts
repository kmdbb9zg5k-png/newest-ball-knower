/** Restrict procedural ink to visible skin using the existing material and body alpha masks. */
export function maskTattooInk(
  ink: Uint8ClampedArray,
  regions: Uint8ClampedArray,
  body: Uint8ClampedArray,
): void {
  if (ink.length % 4 || ink.length !== regions.length || ink.length !== body.length) {
    throw new Error('Tattoo layer and material masks must have identical RGBA dimensions.');
  }
  for (let offset = 0; offset < ink.length; offset += 4) {
    // Match the renderer's material precedence: red=jersey, green=pants, blue=skin.
    const exposedSkin = regions[offset] <= 127 && regions[offset + 1] <= 127
      && regions[offset + 2] > 127 && regions[offset + 3] > 0;
    ink[offset + 3] = exposedSkin
      ? Math.round(ink[offset + 3] * body[offset + 3] / 255 * regions[offset + 3] / 255)
      : 0;
  }
}
