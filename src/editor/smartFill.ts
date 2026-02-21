import { hexToPacked, hexToRgba, rgbaToHex, rgbaToPacked } from "./color";
import type { ReferenceImage } from "../types/models";

export interface SmartFillOptions {
  gridWidth: number;
  gridHeight: number;
  reference: ReferenceImage;
  imageData: ImageData;
  paletteHex: string[];
  basePixels: number[];
  alphaThreshold: number;
  preserveExisting: boolean;
  usePaletteRemap: boolean;
}

function nearestPaletteColor(r: number, g: number, b: number, paletteHex: string[]): number {
  let best = paletteHex[0] ?? "#000000";
  let bestDist = Number.POSITIVE_INFINITY;
  for (const hex of paletteHex) {
    const [pr, pg, pb] = hexToRgba(hex);
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = hex;
    }
  }
  return hexToPacked(best);
}

function sampleNearest(imageData: ImageData, x: number, y: number): [number, number, number, number] {
  const sx = Math.max(0, Math.min(imageData.width - 1, Math.floor(x)));
  const sy = Math.max(0, Math.min(imageData.height - 1, Math.floor(y)));
  const idx = (sy * imageData.width + sx) * 4;
  const data = imageData.data;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

export function smartFillFromReference(options: SmartFillOptions): number[] {
  const {
    gridWidth,
    gridHeight,
    reference,
    imageData,
    paletteHex,
    basePixels,
    alphaThreshold,
    preserveExisting,
    usePaletteRemap
  } = options;

  const out = basePixels.slice();
  if (reference.scale <= 0) return out;

  for (let gy = 0; gy < gridHeight; gy += 1) {
    for (let gx = 0; gx < gridWidth; gx += 1) {
      const idx = gy * gridWidth + gx;
      if (preserveExisting && (out[idx] & 255) > 0) continue;

      const srcX = (gx + 0.5 - reference.x) / reference.scale;
      const srcY = (gy + 0.5 - reference.y) / reference.scale;
      if (srcX < 0 || srcY < 0 || srcX >= imageData.width || srcY >= imageData.height) {
        if (!preserveExisting) out[idx] = 0;
        continue;
      }

      const [r, g, b, a] = sampleNearest(imageData, srcX, srcY);
      if (a < alphaThreshold) {
        if (!preserveExisting) out[idx] = 0;
        continue;
      }
      if (usePaletteRemap && paletteHex.length > 0) {
        out[idx] = nearestPaletteColor(r, g, b, paletteHex);
      } else {
        out[idx] = rgbaToPacked(r, g, b, 255);
      }
    }
  }

  return out;
}

export function extractPaletteFromImageData(imageData: ImageData, maxColors = 16): string[] {
  const bins = new Map<number, number>();
  const exact = new Map<number, number>();
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 32) continue;
    const exactKey = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    exact.set(exactKey, (exact.get(exactKey) ?? 0) + 1);

    const r5 = d[i] >> 3;
    const g5 = d[i + 1] >> 3;
    const b5 = d[i + 2] >> 3;
    const key = (r5 << 10) | (g5 << 5) | b5;
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }

  const exactSorted = [...exact.entries()].sort((a, b) => b[1] - a[1]);
  if (exactSorted.length <= maxColors) {
    return exactSorted.map(([key]) => rgbaToHex((key >> 16) & 255, (key >> 8) & 255, key & 255));
  }

  const sorted = [...bins.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxColors);
  return sorted.map(([key]) => {
    const r = ((key >> 10) & 31) << 3;
    const g = ((key >> 5) & 31) << 3;
    const b = (key & 31) << 3;
    return rgbaToHex(r, g, b);
  });
}
