import GIF from "gif.js";
import workerUrl from "gif.js/dist/gif.worker.js?url";
import { drawRigOverlay } from "../editor/rig";
import type { BonePose, Frame, RigData } from "../types/models";
import { packedToRgba } from "../editor/color";
import { getCompositePixels } from "../editor/layers";

function frameToCanvas(
  frame: Frame,
  framePoseKey: string,
  width: number,
  height: number,
  scale: number,
  transparentKey?: number,
  rigOptions?: { rig: RigData; rigPoseByFrame: Record<string, Record<string, BonePose>>; includeOverlay: boolean }
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const composite = getCompositePixels(frame, width, height);
  if (typeof transparentKey === "number") {
    const tr = (transparentKey >> 16) & 255;
    const tg = (transparentKey >> 8) & 255;
    const tb = transparentKey & 255;
    ctx.fillStyle = `rgb(${tr},${tg},${tb})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const packed = composite[y * width + x];
      if ((packed & 255) === 0) continue;
      const [r, g, b, a] = packedToRgba(packed);
      ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  if (rigOptions?.includeOverlay) {
    drawRigOverlay(ctx, rigOptions.rig, framePoseKey, rigOptions.rigPoseByFrame, scale, 0, 0, null, null);
  }
  return canvas;
}

export function exportFrameImage(
  frame: Frame,
  width: number,
  height: number,
  scale: number,
  format: "png" | "jpeg",
  rigOptions?: { rig: RigData; rigPoseByFrame: Record<string, Record<string, BonePose>>; includeOverlay: boolean },
  framePoseKey = frame.id
): string {
  const canvas = frameToCanvas(frame, framePoseKey, width, height, scale, undefined, rigOptions);
  return canvas.toDataURL(format === "png" ? "image/png" : "image/jpeg", 0.95);
}

function pickTransparentKey(frames: Frame[], width: number, height: number): number {
  const used = new Set<number>();
  for (const frame of frames) {
    const pixels = getCompositePixels(frame, width, height);
    for (const packed of pixels) {
      if ((packed & 255) === 0) continue;
      const [r, g, b] = packedToRgba(packed);
      used.add((r << 16) | (g << 8) | b);
    }
  }

  const candidates = [0xff00ff, 0x00ff00, 0x00ffff, 0xff0000, 0x0000ff, 0xffff00, 0x010101, 0xfefefe];
  for (const candidate of candidates) {
    if (!used.has(candidate)) return candidate;
  }

  for (let i = 0; i <= 0xffffff; i += 257) {
    if (!used.has(i)) return i;
  }
  return 0xff00ff;
}

export async function exportGif(
  frames: Frame[],
  width: number,
  height: number,
  scale: number,
  fpsOverrideEnabled: boolean,
  fps: number,
  rigOptions?: { rig: RigData; rigPoseByFrame: Record<string, Record<string, BonePose>>; includeOverlay: boolean }
): Promise<Blob> {
  const transparentKey = pickTransparentKey(frames, width, height);
  const gif = new GIF({
    workers: 2,
    quality: 10,
    workerScript: workerUrl,
    width: width * scale,
    height: height * scale,
    transparent: transparentKey
  });

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const canvas = frameToCanvas(frame, frame.id ?? String(frameIndex), width, height, scale, transparentKey, rigOptions);
    const delay = fpsOverrideEnabled ? Math.round(1000 / fps) : frame.durationMs;
    gif.addFrame(canvas, { delay, copy: true });
  }

  return new Promise((resolve) => {
    gif.on("finished", (blob: Blob) => resolve(blob));
    gif.render();
  });
}
