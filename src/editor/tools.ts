import type { Point } from "../types/models";

export function linePoints(start: Point, end: Point): Point[] {
  const points: Point[] = [];
  let x1 = start.x;
  let y1 = start.y;
  const x2 = end.x;
  const y2 = end.y;

  const dx = Math.abs(x2 - x1);
  const sx = x1 < x2 ? 1 : -1;
  const dy = -Math.abs(y2 - y1);
  const sy = y1 < y2 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    points.push({ x: x1, y: y1 });
    if (x1 === x2 && y1 === y2) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x1 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y1 += sy;
    }
  }

  return points;
}

export function rectPoints(start: Point, end: Point): Point[] {
  const xMin = Math.min(start.x, end.x);
  const xMax = Math.max(start.x, end.x);
  const yMin = Math.min(start.y, end.y);
  const yMax = Math.max(start.y, end.y);
  const points: Point[] = [];

  for (let x = xMin; x <= xMax; x += 1) {
    points.push({ x, y: yMin });
    points.push({ x, y: yMax });
  }
  for (let y = yMin + 1; y < yMax; y += 1) {
    points.push({ x: xMin, y });
    points.push({ x: xMax, y });
  }

  return points;
}

export function circlePoints(start: Point, end: Point): Point[] {
  const rx = Math.abs(end.x - start.x);
  const ry = Math.abs(end.y - start.y);
  const radius = Math.max(rx, ry);
  const points: Point[] = [];

  let x = radius;
  let y = 0;
  let err = 1 - x;

  while (x >= y) {
    points.push({ x: start.x + x, y: start.y + y });
    points.push({ x: start.x + y, y: start.y + x });
    points.push({ x: start.x - y, y: start.y + x });
    points.push({ x: start.x - x, y: start.y + y });
    points.push({ x: start.x - x, y: start.y - y });
    points.push({ x: start.x - y, y: start.y - x });
    points.push({ x: start.x + y, y: start.y - x });
    points.push({ x: start.x + x, y: start.y - y });
    y += 1;
    if (err < 0) err += 2 * y + 1;
    else {
      x -= 1;
      err += 2 * (y - x + 1);
    }
  }

  return points;
}
