import { hexToPacked } from "../editor/color";
import type { Point, SpriteGeneratorParams } from "../types/models";

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paint(points: Point[], pixels: number[], width: number, color: number): void {
  for (const p of points) {
    if (p.x < 0 || p.y < 0 || p.x >= width) continue;
    const idx = p.y * width + p.x;
    if (idx >= 0 && idx < pixels.length) pixels[idx] = color;
  }
}

export function generateSprite(params: SpriteGeneratorParams): number[] {
  const { size, symmetry, accessoryHat, accessoryBelt, headSize, bodyType } = params;
  const pixels = new Array<number>(size * size).fill(0);
  const primary = hexToPacked(params.primaryColor);
  const secondary = hexToPacked(params.secondaryColor);
  const rng = mulberry32(params.seed);

  const bodyHeight = Math.max(2, Math.floor(size * (0.3 + bodyType * 0.4)));
  const headHeight = Math.max(2, Math.floor(size * (0.15 + headSize * 0.35)));
  const torsoTop = Math.floor(size * 0.35);
  const headTop = Math.max(1, torsoTop - headHeight);

  const points: Point[] = [];
  for (let y = torsoTop; y < Math.min(size - 1, torsoTop + bodyHeight); y += 1) {
    const half = Math.floor(size * (0.18 + bodyType * 0.2) + rng() * 2);
    const cx = Math.floor(size / 2);
    for (let x = cx - half; x <= cx + half; x += 1) points.push({ x, y });
  }

  for (let y = headTop; y < headTop + headHeight; y += 1) {
    const half = Math.floor(size * (0.1 + headSize * 0.18));
    const cx = Math.floor(size / 2);
    for (let x = cx - half; x <= cx + half; x += 1) points.push({ x, y });
  }

  if (accessoryHat) {
    for (let y = Math.max(0, headTop - 2); y < headTop; y += 1) {
      for (let x = Math.floor(size / 2) - 3; x <= Math.floor(size / 2) + 3; x += 1) points.push({ x, y });
    }
  }

  paint(points, pixels, size, primary);

  if (accessoryBelt) {
    const y = torsoTop + Math.floor(bodyHeight / 2);
    for (let x = Math.floor(size / 2) - 4; x <= Math.floor(size / 2) + 4; x += 1) {
      if (x >= 0 && x < size && y >= 0 && y < size) pixels[y * size + x] = secondary;
    }
  }

  if (symmetry) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < Math.floor(size / 2); x += 1) {
        pixels[y * size + (size - 1 - x)] = pixels[y * size + x];
      }
    }
  }

  return pixels;
}
