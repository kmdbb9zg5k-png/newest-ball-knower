export function jerseyIdentityKey(player) {
  return [player.team, player.number, player.jerseyName || player.lastName || '', player.kitInk || '', player.kitTrim || ''].join('-');
}
export function jerseySurname(player) { return String(player.jerseyName || player.lastName || '').toUpperCase().replace(/[^A-Z. '-]/g, '').slice(0, 24); }
export function jerseyNameCanvas(player) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 512, 96);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 62px Arial';
  ctx.fillStyle = player.kitInk || (player.team ? '#74322f' : '#fff5dc');
  ctx.fillText(jerseySurname(player), 256, 48, 484);
  return canvas;
}
