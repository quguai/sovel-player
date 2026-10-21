/** Require real downward travel; neither finger position nor velocity bypasses this threshold. */
export function shouldDismissPlayer(dx: number, dy: number, height: number) {
  return dy >= height / 3 && dy > Math.abs(dx) * 1.5;
}
