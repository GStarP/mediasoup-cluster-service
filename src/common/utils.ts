export function numberReserve(n: number, reserve: number): number {
  return Number(Math.round(parseFloat(n + 'e' + reserve)) + 'e-' + reserve);
}
