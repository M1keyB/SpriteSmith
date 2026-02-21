import { packedToRgba, rgbaToPacked } from "./color";
import { createId } from "./id";
import type { Frame, Layer } from "../types/models";

export interface LegacyFrame {
  id: string;
  durationMs: number;
  pixels?: number[];
  layers?: Layer[];
}

export function createLayer(width: number, height: number, name = "Layer 1"): Layer {
  return {
    id: createId(),
    name,
    visible: true,
    opacity: 1,
    pixels: new Array(width * height).fill(0)
  };
}

export function normalizeFrame(frame: LegacyFrame, width: number, height: number): Frame {
  if (Array.isArray(frame.layers) && frame.layers.length > 0) {
    return {
      id: frame.id,
      durationMs: frame.durationMs ?? 120,
      layers: frame.layers.map((layer, index) => ({
        id: layer.id ?? createId(),
        name: layer.name ?? `Layer ${index + 1}`,
        visible: layer.visible ?? true,
        opacity: typeof layer.opacity === "number" ? layer.opacity : 1,
        pixels: layer.pixels.slice(0, width * height).concat(new Array(Math.max(0, width * height - layer.pixels.length)).fill(0))
      }))
    };
  }

  const fallbackPixels = frame.pixels ?? new Array(width * height).fill(0);
  return {
    id: frame.id ?? createId(),
    durationMs: frame.durationMs ?? 120,
    layers: [
      {
        id: createId(),
        name: "Layer 1",
        visible: true,
        opacity: 1,
        pixels: fallbackPixels.slice(0, width * height).concat(new Array(Math.max(0, width * height - fallbackPixels.length)).fill(0))
      }
    ]
  };
}

export function normalizeProjectFrames<T extends { frames: LegacyFrame[]; gridWidth: number; gridHeight: number }>(project: T): T & { frames: Frame[] } {
  return {
    ...project,
    frames: project.frames.map((frame) => normalizeFrame(frame, project.gridWidth, project.gridHeight))
  };
}

export function getEditablePixels(frame: Frame): number[] {
  return frame.layers[0]?.pixels ?? [];
}

export function setEditablePixels(frame: Frame, pixels: number[]): Frame {
  const base = frame.layers[0] ?? createLayer(Math.max(1, pixels.length), 1);
  const nextLayer: Layer = { ...base, pixels };
  const layers = frame.layers.length === 0 ? [nextLayer] : [nextLayer, ...frame.layers.slice(1)];
  return { ...frame, layers };
}

export function getCompositePixels(frame: Frame, width: number, height: number): number[] {
  if (frame.layers.length === 1 && frame.layers[0].visible && frame.layers[0].opacity >= 0.999) {
    return frame.layers[0].pixels;
  }

  const total = width * height;
  const out = new Array<number>(total).fill(0);

  for (const layer of frame.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    for (let i = 0; i < total; i += 1) {
      const src = layer.pixels[i] ?? 0;
      const dst = out[i];
      const [sr, sg, sb, saRaw] = packedToRgba(src);
      const [dr, dg, db, daRaw] = packedToRgba(dst);
      const sa = (saRaw / 255) * layer.opacity;
      const da = daRaw / 255;
      const outA = sa + da * (1 - sa);
      if (outA <= 0) {
        out[i] = 0;
        continue;
      }
      const outR = Math.round((sr * sa + dr * da * (1 - sa)) / outA);
      const outG = Math.round((sg * sa + dg * da * (1 - sa)) / outA);
      const outB = Math.round((sb * sa + db * da * (1 - sa)) / outA);
      out[i] = rgbaToPacked(outR, outG, outB, Math.round(outA * 255));
    }
  }

  return out;
}
