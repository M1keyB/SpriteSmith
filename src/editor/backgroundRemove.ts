import { packedToRgba } from "./color";

function colorDistance(a: number, b: number): number {
  const [ar, ag, ab] = packedToRgba(a);
  const [br, bg, bb] = packedToRgba(b);
  const dr = ar - br;
  const dg = ag - bg;
  const db = ab - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function matches(packed: number, keyColor: number, tolerance: number): boolean {
  const alpha = packed & 255;
  if (alpha === 0) return false;
  return colorDistance(packed, keyColor) <= tolerance;
}

export function removeBackgroundPixels(
  pixels: number[],
  width: number,
  height: number,
  keyColor: number,
  tolerance: number,
  connectedOnly: boolean
): number[] {
  const next = pixels.slice();

  if (!connectedOnly) {
    for (let i = 0; i < next.length; i += 1) {
      if (matches(next[i], keyColor, tolerance)) next[i] = 0;
    }
    return next;
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  const pushIfMatch = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    if (!matches(next[idx], keyColor, tolerance)) return;
    visited[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    pushIfMatch(x, 0);
    pushIfMatch(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfMatch(0, y);
    pushIfMatch(width - 1, y);
  }

  while (stack.length > 0) {
    const idx = stack.pop()!;
    next[idx] = 0;
    const x = idx % width;
    const y = Math.floor(idx / width);
    pushIfMatch(x + 1, y);
    pushIfMatch(x - 1, y);
    pushIfMatch(x, y + 1);
    pushIfMatch(x, y - 1);
  }

  return next;
}

export function removeBackgroundFromPoint(
  pixels: number[],
  width: number,
  height: number,
  startX: number,
  startY: number,
  tolerance: number
): number[] {
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return pixels;

  const next = pixels.slice();
  const startIndex = startY * width + startX;
  const keyColor = next[startIndex] ?? 0;
  if ((keyColor & 255) === 0) return next;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [startIndex];
  visited[startIndex] = 1;

  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (!matches(next[idx], keyColor, tolerance)) continue;

    next[idx] = 0;
    const x = idx % width;
    const y = Math.floor(idx / width);

    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ] as const;

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;
      stack.push(nIdx);
    }
  }

  return next;
}
