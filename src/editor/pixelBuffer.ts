import type { Point } from "../types/models";

export function indexOf(x: number, y: number, width: number): number {
  return y * width + x;
}

export function inBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

export function clonePixels(pixels: number[]): number[] {
  return pixels.slice();
}

export function applyPoints(
  pixels: number[],
  points: Point[],
  width: number,
  height: number,
  color: number
): number[] {
  const next = clonePixels(pixels);
  for (const point of points) {
    if (!inBounds(point.x, point.y, width, height)) continue;
    next[indexOf(point.x, point.y, width)] = color;
  }
  return next;
}

export function floodFill(
  pixels: number[],
  width: number,
  height: number,
  startX: number,
  startY: number,
  color: number
): number[] {
  if (!inBounds(startX, startY, width, height)) return pixels;

  const next = clonePixels(pixels);
  const startIndex = indexOf(startX, startY, width);
  const targetColor = next[startIndex];
  if (targetColor === color) return next;

  const stack: Point[] = [{ x: startX, y: startY }];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (!inBounds(current.x, current.y, width, height)) continue;
    const idx = indexOf(current.x, current.y, width);
    if (next[idx] !== targetColor) continue;

    next[idx] = color;
    stack.push({ x: current.x + 1, y: current.y });
    stack.push({ x: current.x - 1, y: current.y });
    stack.push({ x: current.x, y: current.y + 1 });
    stack.push({ x: current.x, y: current.y - 1 });
  }

  return next;
}
