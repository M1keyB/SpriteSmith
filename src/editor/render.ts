import { rgbaToPacked, packedToRgba } from "./color";

export function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cell = 16
): void {
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      const dark = ((x / cell) + (y / cell)) % 2 === 0;
      ctx.fillStyle = dark ? "#1a1a1a" : "#242424";
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

export function drawPixels(
  ctx: CanvasRenderingContext2D,
  pixels: number[],
  gridWidth: number,
  gridHeight: number,
  pixelSize: number,
  offsetX: number,
  offsetY: number,
  alphaMultiplier = 1
): void {
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const packed = pixels[y * gridWidth + x];
      if ((packed & 255) === 0) continue;
      const [r, g, b, a] = packedToRgba(packed);
      const alpha = (a / 255) * alphaMultiplier;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillRect(offsetX + x * pixelSize, offsetY + y * pixelSize, pixelSize, pixelSize);
    }
  }
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  gridWidth: number,
  gridHeight: number,
  pixelSize: number,
  offsetX: number,
  offsetY: number
): void {
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= gridWidth; x += 1) {
    const px = Math.round(offsetX + x * pixelSize) + 0.5;
    ctx.moveTo(px, offsetY);
    ctx.lineTo(px, offsetY + gridHeight * pixelSize);
  }
  for (let y = 0; y <= gridHeight; y += 1) {
    const py = Math.round(offsetY + y * pixelSize) + 0.5;
    ctx.moveTo(offsetX, py);
    ctx.lineTo(offsetX + gridWidth * pixelSize, py);
  }
  ctx.stroke();
}

export function resizePixels(
  oldPixels: number[],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
  mode: "crop" | "clear" | "scale"
): number[] {
  const next = new Array<number>(newWidth * newHeight).fill(0);
  if (mode === "clear") return next;

  for (let y = 0; y < newHeight; y += 1) {
    for (let x = 0; x < newWidth; x += 1) {
      let sourceX = x;
      let sourceY = y;
      if (mode === "scale") {
        sourceX = Math.floor((x / newWidth) * oldWidth);
        sourceY = Math.floor((y / newHeight) * oldHeight);
      }
      if (sourceX < 0 || sourceY < 0 || sourceX >= oldWidth || sourceY >= oldHeight) continue;
      next[y * newWidth + x] = oldPixels[sourceY * oldWidth + sourceX] ?? rgbaToPacked(0, 0, 0, 0);
    }
  }

  return next;
}
