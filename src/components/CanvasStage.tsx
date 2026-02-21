import { useEffect, useMemo, useRef, useState } from "react";
import { packedToRgba } from "../editor/color";
import { getCompositePixels, getEditablePixels } from "../editor/layers";
import { drawCheckerboard, drawGrid, drawPixels } from "../editor/render";
import { circlePoints, linePoints, rectPoints } from "../editor/tools";
import type { EditorState, Point } from "../types/models";
import type { EditorAction } from "../state/editorReducer";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LassoSelection extends SelectionBox {
  mask: boolean[];
  path: Point[];
}

interface FloatingSelection extends LassoSelection {
  pixels: number[];
  anchorX: number;
  anchorY: number;
}

interface ClipboardSelection extends LassoSelection {
  pixels: number[];
}

function pointInPolygon(px: number, py: number, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x + 0.5;
    const yi = polygon[i].y + 0.5;
    const xj = polygon[j].x + 0.5;
    const yj = polygon[j].y + 0.5;
    const intersects = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function buildLassoSelection(path: Point[]): LassoSelection | null {
  if (path.length < 3) return null;
  let xMin = Number.POSITIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const point of path) {
    if (point.x < xMin) xMin = point.x;
    if (point.x > xMax) xMax = point.x;
    if (point.y < yMin) yMin = point.y;
    if (point.y > yMax) yMax = point.y;
  }
  const width = xMax - xMin + 1;
  const height = yMax - yMin + 1;
  const mask = new Array<boolean>(width * height).fill(false);

  // Include edge pixels so lasso boundaries are part of the selection.
  for (let i = 0; i < path.length; i += 1) {
    const current = path[i];
    const next = path[(i + 1) % path.length];
    const edge = linePoints(current, next);
    for (const point of edge) {
      const lx = point.x - xMin;
      const ly = point.y - yMin;
      if (lx < 0 || ly < 0 || lx >= width || ly >= height) continue;
      mask[ly * width + lx] = true;
    }
  }

  for (let y = 0; y < height; y += 1) {
    const py = yMin + y + 0.5;
    for (let x = 0; x < width; x += 1) {
      const px = xMin + x + 0.5;
      if (mask[y * width + x]) continue;
      mask[y * width + x] = pointInPolygon(px, py, path);
    }
  }
  return {
    x: xMin,
    y: yMin,
    width,
    height,
    mask,
    path: path.map((point) => ({ x: point.x - xMin, y: point.y - yMin }))
  };
}

function isInsideSelection(point: Point, selection: LassoSelection): boolean {
  const localX = point.x - selection.x;
  const localY = point.y - selection.y;
  if (localX < 0 || localY < 0 || localX >= selection.width || localY >= selection.height) return false;
  return selection.mask[localY * selection.width + localX] ?? false;
}

function extractSelection(
  pixels: number[],
  gridWidth: number,
  gridHeight: number,
  selection: LassoSelection
): { remaining: number[]; selected: number[]; selectedMask: boolean[] } {
  const remaining = pixels.slice();
  const selected = new Array<number>(selection.width * selection.height).fill(0);
  const selectedMask = new Array<boolean>(selection.width * selection.height).fill(false);
  for (let y = 0; y < selection.height; y += 1) {
    const sourceY = selection.y + y;
    if (sourceY < 0 || sourceY >= gridHeight) continue;
    for (let x = 0; x < selection.width; x += 1) {
      if (!(selection.mask[y * selection.width + x] ?? false)) continue;
      const sourceX = selection.x + x;
      if (sourceX < 0 || sourceX >= gridWidth) continue;
      const srcIndex = sourceY * gridWidth + sourceX;
      const dstIndex = y * selection.width + x;
      const packed = remaining[srcIndex] ?? 0;
      if ((packed & 255) === 0) continue;
      selected[dstIndex] = packed;
      selectedMask[dstIndex] = true;
      remaining[srcIndex] = 0;
    }
  }
  return { remaining, selected, selectedMask };
}

function stampSelection(
  pixels: number[],
  gridWidth: number,
  gridHeight: number,
  selection: LassoSelection,
  selectedPixels: number[],
  mode: "overwrite" | "preserve-destination" = "overwrite"
): number[] {
  const next = pixels.slice();
  for (let y = 0; y < selection.height; y += 1) {
    const targetY = selection.y + y;
    if (targetY < 0 || targetY >= gridHeight) continue;
    for (let x = 0; x < selection.width; x += 1) {
      if (!(selection.mask[y * selection.width + x] ?? false)) continue;
      const targetX = selection.x + x;
      if (targetX < 0 || targetX >= gridWidth) continue;
      const srcIndex = y * selection.width + x;
      const packed = selectedPixels[srcIndex] ?? 0;
      if ((packed & 255) === 0) continue;
      const dstIndex = targetY * gridWidth + targetX;
      if (mode === "preserve-destination" && (next[dstIndex] & 255) !== 0) continue;
      next[dstIndex] = packed;
    }
  }
  return next;
}

function captureSelectionPixels(
  pixels: number[],
  gridWidth: number,
  gridHeight: number,
  selection: LassoSelection
): number[] {
  const selected = new Array<number>(selection.width * selection.height).fill(0);
  for (let y = 0; y < selection.height; y += 1) {
    const sourceY = selection.y + y;
    if (sourceY < 0 || sourceY >= gridHeight) continue;
    for (let x = 0; x < selection.width; x += 1) {
      if (!(selection.mask[y * selection.width + x] ?? false)) continue;
      const sourceX = selection.x + x;
      if (sourceX < 0 || sourceX >= gridWidth) continue;
      selected[y * selection.width + x] = pixels[sourceY * gridWidth + sourceX] ?? 0;
    }
  }
  return selected;
}

function clearSelection(
  pixels: number[],
  gridWidth: number,
  gridHeight: number,
  selection: LassoSelection
): number[] {
  const next = pixels.slice();
  for (let y = 0; y < selection.height; y += 1) {
    const targetY = selection.y + y;
    if (targetY < 0 || targetY >= gridHeight) continue;
    for (let x = 0; x < selection.width; x += 1) {
      if (!(selection.mask[y * selection.width + x] ?? false)) continue;
      const targetX = selection.x + x;
      if (targetX < 0 || targetX >= gridWidth) continue;
      next[targetY * gridWidth + targetX] = 0;
    }
  }
  return next;
}

function flipPixels(
  pixels: number[],
  gridWidth: number,
  gridHeight: number,
  direction: "horizontal" | "vertical"
): number[] {
  const next = new Array<number>(gridWidth * gridHeight).fill(0);
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const srcIndex = y * gridWidth + x;
      const targetX = direction === "horizontal" ? gridWidth - 1 - x : x;
      const targetY = direction === "vertical" ? gridHeight - 1 - y : y;
      const dstIndex = targetY * gridWidth + targetX;
      next[dstIndex] = pixels[srcIndex] ?? 0;
    }
  }
  return next;
}

function translatePixels(
  pixels: number[],
  gridWidth: number,
  gridHeight: number,
  dx: number,
  dy: number
): number[] {
  const next = new Array<number>(gridWidth * gridHeight).fill(0);
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const packed = pixels[y * gridWidth + x] ?? 0;
      if ((packed & 255) === 0) continue;
      const targetX = x + dx;
      const targetY = y + dy;
      if (targetX < 0 || targetY < 0 || targetX >= gridWidth || targetY >= gridHeight) continue;
      next[targetY * gridWidth + targetX] = packed;
    }
  }
  return next;
}

function rotateSelectionData(
  selection: LassoSelection,
  pixels: number[],
  angleDegrees: number
): { selection: LassoSelection; pixels: number[] } {
  const oldWidth = selection.width;
  const oldHeight = selection.height;
  const radians = (angleDegrees * Math.PI) / 180;
  const cosA = Math.cos(radians);
  const sinA = Math.sin(radians);
  const cx = (oldWidth - 1) / 2;
  const cy = (oldHeight - 1) / 2;
  const transformed: Array<{ x: number; y: number; packed: number }> = [];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < oldHeight; y += 1) {
    for (let x = 0; x < oldWidth; x += 1) {
      const srcIndex = y * oldWidth + x;
      if (!(selection.mask[srcIndex] ?? false)) continue;
      const dx = x - cx;
      const dy = y - cy;
      const rx = Math.round(dx * cosA - dy * sinA + cx);
      const ry = Math.round(dx * sinA + dy * cosA + cy);
      if (rx < minX) minX = rx;
      if (ry < minY) minY = ry;
      if (rx > maxX) maxX = rx;
      if (ry > maxY) maxY = ry;
      transformed.push({ x: rx, y: ry, packed: pixels[srcIndex] ?? 0 });
    }
  }

  if (transformed.length === 0) {
    return {
      selection: { ...selection },
      pixels: pixels.slice()
    };
  }

  const newWidth = maxX - minX + 1;
  const newHeight = maxY - minY + 1;
  const rotatedMask = new Array<boolean>(newWidth * newHeight).fill(false);
  const rotatedPixels = new Array<number>(newWidth * newHeight).fill(0);

  for (const point of transformed) {
    const tx = point.x - minX;
    const ty = point.y - minY;
    if (tx < 0 || ty < 0 || tx >= newWidth || ty >= newHeight) continue;
    const dstIndex = ty * newWidth + tx;
    rotatedMask[dstIndex] = true;
    rotatedPixels[dstIndex] = point.packed;
  }

  const rotatedPath = selection.path.map((point) => {
    const dx = point.x - cx;
    const dy = point.y - cy;
    const rx = Math.round(dx * cosA - dy * sinA + cx);
    const ry = Math.round(dx * sinA + dy * cosA + cy);
    return { x: rx - minX, y: ry - minY };
  });

  return {
    selection: {
      x: selection.x + minX,
      y: selection.y + minY,
      width: newWidth,
      height: newHeight,
      mask: rotatedMask,
      path: rotatedPath
    },
    pixels: rotatedPixels
  };
}

function sameSelectionImage(
  aSelection: LassoSelection,
  aPixels: number[],
  bSelection: LassoSelection,
  bPixels: number[]
): boolean {
  if (
    aSelection.width !== bSelection.width ||
    aSelection.height !== bSelection.height ||
    aSelection.x !== bSelection.x ||
    aSelection.y !== bSelection.y
  ) {
    return false;
  }
  const total = aSelection.width * aSelection.height;
  for (let i = 0; i < total; i += 1) {
    const aMask = aSelection.mask[i] ?? false;
    const bMask = bSelection.mask[i] ?? false;
    if (aMask !== bMask) return false;
    if ((aPixels[i] ?? 0) !== (bPixels[i] ?? 0)) return false;
  }
  return true;
}

function rotationStepDegreesForSelection(selection: LassoSelection): number {
  const rx = Math.max(0.5, (selection.width - 1) / 2);
  const ry = Math.max(0.5, (selection.height - 1) / 2);
  const radius = Math.max(1, Math.hypot(rx, ry));
  const radians = Math.asin(Math.min(1, 1 / radius));
  const degrees = (radians * 180) / Math.PI;
  return Math.max(1, Math.min(30, degrees));
}

export function CanvasStage({ state, dispatch }: Props): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [panning, setPanning] = useState(false);
  const [referenceBitmap, setReferenceBitmap] = useState<HTMLImageElement | null>(null);
  const [selectionBox, setSelectionBox] = useState<LassoSelection | null>(null);
  const [floatingSelection, setFloatingSelection] = useState<FloatingSelection | null>(null);
  const [lassoPath, setLassoPath] = useState<Point[] | null>(null);
  const [clipboardSelection, setClipboardSelection] = useState<ClipboardSelection | null>(null);
  const [grabStart, setGrabStart] = useState<Point | null>(null);
  const [grabBasePixels, setGrabBasePixels] = useState<number[] | null>(null);
  const [grabHasPushedHistory, setGrabHasPushedHistory] = useState(false);

  const frame = state.project.frames[state.activeFrameIndex];
  const prevFrame = state.project.frames[state.activeFrameIndex - 1] ?? null;
  const nextFrame = state.project.frames[state.activeFrameIndex + 1] ?? null;
  const framePixels = useMemo(
    () => getCompositePixels(frame, state.project.gridWidth, state.project.gridHeight),
    [frame, state.project.gridWidth, state.project.gridHeight]
  );
  const prevPixels = useMemo(
    () => (prevFrame ? getCompositePixels(prevFrame, state.project.gridWidth, state.project.gridHeight) : null),
    [prevFrame, state.project.gridWidth, state.project.gridHeight]
  );
  const nextPixels = useMemo(
    () => (nextFrame ? getCompositePixels(nextFrame, state.project.gridWidth, state.project.gridHeight) : null),
    [nextFrame, state.project.gridWidth, state.project.gridHeight]
  );
  const isLassoTool = state.activeTool === "select" || state.activeTool === "manual-remove";

  useEffect(() => {
    let cancelled = false;
    const source = state.referenceImage?.dataUrl;
    setReferenceBitmap(null);
    if (!source) return () => {
      cancelled = true;
    };

    const image = new Image();
    image.onload = () => {
      if (!cancelled) setReferenceBitmap(image);
    };
    image.onerror = () => {
      if (!cancelled) setReferenceBitmap(null);
    };
    image.src = source;
    return () => {
      cancelled = true;
    };
  }, [state.referenceImage]);

  const getPixelPoint = (event: React.MouseEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - state.panX;
    const y = event.clientY - rect.top - state.panY;
    const px = Math.floor(x / state.zoom);
    const py = Math.floor(y / state.zoom);
    if (px < 0 || py < 0 || px >= state.project.gridWidth || py >= state.project.gridHeight) return null;
    return { x: px, y: py };
  };

  const previewPoints = useMemo(() => {
    if (!dragStart || !dragCurrent) return [];
    if (state.activeTool === "line") return linePoints(dragStart, dragCurrent);
    if (state.activeTool === "rect") return rectPoints(dragStart, dragCurrent);
    if (state.activeTool === "circle") return circlePoints(dragStart, dragCurrent);
    return [];
  }, [dragCurrent, dragStart, state.activeTool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !frame) return;

    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;

    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state.showChecker) drawCheckerboard(ctx, canvas.width, canvas.height);
    else {
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (state.referenceImage && state.referenceImage.visible && referenceBitmap) {
      const drawX = state.panX + state.referenceImage.x * state.zoom;
      const drawY = state.panY + state.referenceImage.y * state.zoom;
      const drawW = state.referenceImage.width * state.referenceImage.scale * state.zoom;
      const drawH = state.referenceImage.height * state.referenceImage.scale * state.zoom;
      ctx.globalAlpha = state.referenceImage.opacity;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(referenceBitmap, drawX, drawY, drawW, drawH);
      ctx.globalAlpha = 1;
    }

    if (state.onionSkin.showPrev && prevPixels) drawPixels(ctx, prevPixels, state.project.gridWidth, state.project.gridHeight, state.zoom, state.panX, state.panY, state.onionSkin.opacityPrev);
    if (state.onionSkin.showNext && nextPixels) drawPixels(ctx, nextPixels, state.project.gridWidth, state.project.gridHeight, state.zoom, state.panX, state.panY, state.onionSkin.opacityNext);
    drawPixels(ctx, framePixels, state.project.gridWidth, state.project.gridHeight, state.zoom, state.panX, state.panY, 1);

    if (previewPoints.length > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (const p of previewPoints) ctx.fillRect(state.panX + p.x * state.zoom, state.panY + p.y * state.zoom, state.zoom, state.zoom);
    }

    if (floatingSelection) {
      for (let y = 0; y < floatingSelection.height; y += 1) {
        for (let x = 0; x < floatingSelection.width; x += 1) {
          const packed = floatingSelection.pixels[y * floatingSelection.width + x] ?? 0;
          if ((packed & 255) === 0) continue;
          const [r, g, b, a] = packedToRgba(packed);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          ctx.fillRect(
            state.panX + (floatingSelection.x + x) * state.zoom,
            state.panY + (floatingSelection.y + y) * state.zoom,
            state.zoom,
            state.zoom
          );
        }
      }
    }

    const activeSelection = isLassoTool || state.activeTool === "rotate" ? floatingSelection ?? selectionBox : null;
    if (activeSelection && activeSelection.path.length > 1) {
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#f0f0f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const first = activeSelection.path[0];
      ctx.moveTo(
        state.panX + (activeSelection.x + first.x) * state.zoom + state.zoom / 2,
        state.panY + (activeSelection.y + first.y) * state.zoom + state.zoom / 2
      );
      for (let i = 1; i < activeSelection.path.length; i += 1) {
        const p = activeSelection.path[i];
        ctx.lineTo(
          state.panX + (activeSelection.x + p.x) * state.zoom + state.zoom / 2,
          state.panY + (activeSelection.y + p.y) * state.zoom + state.zoom / 2
        );
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    if (isLassoTool && lassoPath && lassoPath.length > 1) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "#f0f0f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const first = lassoPath[0];
      ctx.moveTo(state.panX + first.x * state.zoom + state.zoom / 2, state.panY + first.y * state.zoom + state.zoom / 2);
      for (let i = 1; i < lassoPath.length; i += 1) {
        const p = lassoPath[i];
        ctx.lineTo(state.panX + p.x * state.zoom + state.zoom / 2, state.panY + p.y * state.zoom + state.zoom / 2);
      }
      if (dragCurrent) {
        ctx.lineTo(state.panX + dragCurrent.x * state.zoom + state.zoom / 2, state.panY + dragCurrent.y * state.zoom + state.zoom / 2);
      }
      ctx.stroke();
      ctx.restore();
    }

    if (state.showGrid) drawGrid(ctx, state.project.gridWidth, state.project.gridHeight, state.zoom, state.panX, state.panY);
  }, [dragCurrent, floatingSelection, framePixels, isLassoTool, lassoPath, nextPixels, prevPixels, previewPoints, referenceBitmap, selectionBox, state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const oldZoom = state.zoom;
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      const nextZoom = Math.min(80, Math.max(4, oldZoom * factor));
      if (Math.abs(nextZoom - oldZoom) < 0.001) return;

      const worldX = (mouseX - state.panX) / oldZoom;
      const worldY = (mouseY - state.panY) / oldZoom;
      const nextPanX = mouseX - worldX * nextZoom;
      const nextPanY = mouseY - worldY * nextZoom;

      dispatch({ type: "SET_ZOOM", zoom: nextZoom });
      dispatch({ type: "PAN", dx: nextPanX - state.panX, dy: nextPanY - state.panY });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [dispatch, state.panX, state.panY, state.zoom]);

  const onMouseDown = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    event.preventDefault();
    if (event.button === 2) {
      setPanning(true);
      return;
    }
    const point = getPixelPoint(event);
    if (!point) return;

    if (state.activeTool === "rotate") {
      if (selectionBox && isInsideSelection(point, selectionBox)) {
        rotateSelectionByPixelStep(1);
      }
      return;
    }

    if (state.activeTool === "grab") {
      setGrabStart(point);
      setGrabBasePixels(getEditablePixels(frame).slice());
      setGrabHasPushedHistory(false);
      setSelectionBox(null);
      setFloatingSelection(null);
      setLassoPath(null);
      return;
    }

    if (isLassoTool) {
      if (state.activeTool === "select" && selectionBox && isInsideSelection(point, selectionBox)) {
        const editablePixels = getEditablePixels(frame);
        const { remaining, selected, selectedMask } = extractSelection(
          editablePixels,
          state.project.gridWidth,
          state.project.gridHeight,
          selectionBox
        );
        dispatch({
          type: "UPDATE_FRAME_PIXELS",
          frameIndex: state.activeFrameIndex,
          pixels: remaining,
          pushHistory: true
        });
        setFloatingSelection({
          ...selectionBox,
          mask: selectedMask,
          pixels: selected,
          anchorX: point.x - selectionBox.x,
          anchorY: point.y - selectionBox.y
        });
        setDragStart(point);
        setDragCurrent(point);
        setLastPoint(null);
        setLassoPath(null);
        return;
      }

      // Manual remove always starts a fresh lasso selection.
      if (state.activeTool === "manual-remove") {
        setFloatingSelection(null);
        setSelectionBox(null);
      }

      if (state.activeTool === "select" && selectionBox && isInsideSelection(point, selectionBox)) {
        return;
      }

      if (state.activeTool === "select") {
        setFloatingSelection(null);
        setSelectionBox(null);
      }
      setDragStart(point);
      setDragCurrent(point);
      setLassoPath([point]);
      setLastPoint(null);
      return;
    }

    setDragStart(point);
    setDragCurrent(point);
    setLastPoint(point);

    if (["fill", "picker", "pencil", "eraser", "auto-remove"].includes(state.activeTool)) {
      dispatch({ type: "APPLY_TOOL_POINT", point });
    }
  };

  const onMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (event.buttons !== 0) event.preventDefault();
    if (panning) {
      dispatch({ type: "PAN", dx: event.movementX, dy: event.movementY });
      return;
    }
    const point = getPixelPoint(event);
    if (!point) return;

    if (state.activeTool === "grab") {
      if (!grabStart || !grabBasePixels) return;
      const dx = point.x - grabStart.x;
      const dy = point.y - grabStart.y;
      const translated = translatePixels(
        grabBasePixels,
        state.project.gridWidth,
        state.project.gridHeight,
        dx,
        dy
      );
      dispatch({
        type: "UPDATE_FRAME_PIXELS",
        frameIndex: state.activeFrameIndex,
        pixels: translated,
        pushHistory: !grabHasPushedHistory
      });
      if (!grabHasPushedHistory) setGrabHasPushedHistory(true);
      return;
    }

    if (isLassoTool) {
      if (floatingSelection) {
        setFloatingSelection({
          ...floatingSelection,
          x: point.x - floatingSelection.anchorX,
          y: point.y - floatingSelection.anchorY
        });
        return;
      }
      if (!dragStart) return;
      setDragCurrent(point);
      setLassoPath((prev) => {
        const current = prev ?? [dragStart];
        const last = current[current.length - 1];
        if (!last) return [point];
        if (last.x === point.x && last.y === point.y) return current;
        const segment = linePoints(last, point);
        return [...current, ...segment.slice(1)];
      });
      return;
    }

    if (!dragStart) return;
    setDragCurrent(point);
    if ((state.activeTool === "pencil" || state.activeTool === "eraser") && lastPoint) {
        dispatch({ type: "APPLY_TOOL_DRAG", start: lastPoint, end: point, pushHistory: false });
        setLastPoint(point);
      }
  };

  const onMouseUp = (): void => {
    if (panning) {
      setPanning(false);
      return;
    }

    if (isLassoTool) {
      if (floatingSelection) {
        const activeFrame = state.project.frames[state.activeFrameIndex];
        const editablePixels = getEditablePixels(activeFrame);
        const pasted = stampSelection(
          editablePixels,
          state.project.gridWidth,
          state.project.gridHeight,
          floatingSelection,
          floatingSelection.pixels,
          "overwrite"
        );
        dispatch({
          type: "UPDATE_FRAME_PIXELS",
          frameIndex: state.activeFrameIndex,
          pixels: pasted,
          pushHistory: false
        });
        setSelectionBox(floatingSelection);
        setFloatingSelection(null);
      } else if (lassoPath && lassoPath.length > 2) {
        const finalized = buildLassoSelection(lassoPath);
        if (state.activeTool === "manual-remove") {
          if (finalized) {
            const editablePixels = getEditablePixels(frame);
            const cleared = clearSelection(
              editablePixels,
              state.project.gridWidth,
              state.project.gridHeight,
              finalized
            );
            dispatch({
              type: "UPDATE_FRAME_PIXELS",
              frameIndex: state.activeFrameIndex,
              pixels: cleared,
              pushHistory: true
            });
          }
          setSelectionBox(null);
          setFloatingSelection(null);
        } else {
          setSelectionBox(finalized);
        }
      }
      setDragStart(null);
      setDragCurrent(null);
      setLassoPath(null);
      setLastPoint(null);
      return;
    }

    if (state.activeTool === "grab") {
      setGrabStart(null);
      setGrabBasePixels(null);
      setGrabHasPushedHistory(false);
      setDragStart(null);
      setDragCurrent(null);
      setLastPoint(null);
      return;
    }

    if (dragStart && dragCurrent && ["line", "rect", "circle"].includes(state.activeTool)) {
      dispatch({ type: "APPLY_TOOL_DRAG", start: dragStart, end: dragCurrent });
    }
    setDragStart(null);
    setDragCurrent(null);
    setLastPoint(null);
  };

  const copySelection = (): void => {
    if (floatingSelection) {
      const { anchorX: _anchorX, anchorY: _anchorY, ...clip } = floatingSelection;
      setClipboardSelection(clip);
      return;
    }
    if (!selectionBox) return;
    const editablePixels = getEditablePixels(frame);
    const pixels = captureSelectionPixels(editablePixels, state.project.gridWidth, state.project.gridHeight, selectionBox);
    setClipboardSelection({ ...selectionBox, pixels });
  };

  const pasteSelection = (): void => {
    if (!clipboardSelection) return;
    const editablePixels = getEditablePixels(frame);
    const offsetX = selectionBox ? selectionBox.x + 1 : clipboardSelection.x + 1;
    const offsetY = selectionBox ? selectionBox.y + 1 : clipboardSelection.y + 1;
    const target: LassoSelection = {
      ...clipboardSelection,
      x: offsetX,
      y: offsetY
    };
    const pasted = stampSelection(
      editablePixels,
      state.project.gridWidth,
      state.project.gridHeight,
      target,
      clipboardSelection.pixels
    );
    dispatch({
      type: "UPDATE_FRAME_PIXELS",
      frameIndex: state.activeFrameIndex,
      pixels: pasted,
      pushHistory: true
    });
    setSelectionBox(target);
    setFloatingSelection(null);
    setLassoPath(null);
  };

  const duplicateSelection = (): void => {
    if (!selectionBox) return;
    const editablePixels = getEditablePixels(frame);
    const pixels = captureSelectionPixels(editablePixels, state.project.gridWidth, state.project.gridHeight, selectionBox);
    const target: LassoSelection = {
      ...selectionBox,
      x: selectionBox.x + 1,
      y: selectionBox.y + 1
    };
    const pasted = stampSelection(editablePixels, state.project.gridWidth, state.project.gridHeight, target, pixels);
    dispatch({
      type: "UPDATE_FRAME_PIXELS",
      frameIndex: state.activeFrameIndex,
      pixels: pasted,
      pushHistory: true
    });
    setClipboardSelection({ ...selectionBox, pixels });
    setSelectionBox(target);
    setFloatingSelection(null);
    setLassoPath(null);
  };

  const rotateSelection = (degrees: number): void => {
    if (floatingSelection) {
      const rotated = rotateSelectionData(floatingSelection, floatingSelection.pixels, degrees);
      const { selection, pixels } = rotated;
      if (sameSelectionImage(floatingSelection, floatingSelection.pixels, selection, pixels)) return;
      const nextAnchorX = Math.min(Math.max(0, floatingSelection.anchorX), selection.width - 1);
      const nextAnchorY = Math.min(Math.max(0, floatingSelection.anchorY), selection.height - 1);
      setFloatingSelection({
        ...selection,
        pixels,
        anchorX: nextAnchorX,
        anchorY: nextAnchorY
      });
      return;
    }
    if (!selectionBox) return;
    const editablePixels = getEditablePixels(frame);
    const { remaining, selected, selectedMask } = extractSelection(
      editablePixels,
      state.project.gridWidth,
      state.project.gridHeight,
      selectionBox
    );
    const rotated = rotateSelectionData({ ...selectionBox, mask: selectedMask }, selected, degrees);
    if (sameSelectionImage(selectionBox, selected, rotated.selection, rotated.pixels)) return;
    const pasted = stampSelection(
      remaining,
      state.project.gridWidth,
      state.project.gridHeight,
      rotated.selection,
      rotated.pixels
    );
    dispatch({
      type: "UPDATE_FRAME_PIXELS",
      frameIndex: state.activeFrameIndex,
      pixels: pasted,
      pushHistory: true
    });
    setSelectionBox(rotated.selection);
    setFloatingSelection(null);
    setLassoPath(null);
  };

  const rotateSelectionByPixelStep = (direction: 1 | -1): void => {
    const source = floatingSelection ?? selectionBox;
    if (!source) return;
    const step = rotationStepDegreesForSelection(source);
    rotateSelection(direction * step);
  };

  const removeSelectedArea = (): void => {
    if (floatingSelection) {
      // Floating selection is already lifted from canvas; removing means discard it.
      setFloatingSelection(null);
      setSelectionBox(null);
      setLassoPath(null);
      return;
    }
    if (!selectionBox) return;
    const editablePixels = getEditablePixels(frame);
    const cleared = clearSelection(
      editablePixels,
      state.project.gridWidth,
      state.project.gridHeight,
      selectionBox
    );
    dispatch({
      type: "UPDATE_FRAME_PIXELS",
      frameIndex: state.activeFrameIndex,
      pixels: cleared,
      pushHistory: true
    });
    setSelectionBox(null);
    setFloatingSelection(null);
    setLassoPath(null);
  };

  const flipImage = (direction: "horizontal" | "vertical"): void => {
    const editablePixels = getEditablePixels(frame);
    const flipped = flipPixels(editablePixels, state.project.gridWidth, state.project.gridHeight, direction);
    dispatch({
      type: "UPDATE_FRAME_PIXELS",
      frameIndex: state.activeFrameIndex,
      pixels: flipped,
      pushHistory: true
    });
    setSelectionBox(null);
    setFloatingSelection(null);
    setLassoPath(null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const tag = (event.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!selectionBox && !floatingSelection) return;
      event.preventDefault();
      removeSelectedArea();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [floatingSelection, selectionBox, state.activeFrameIndex, state.project.gridHeight, state.project.gridWidth]);

  return (
    <>
      <div className="canvas-actions">
        <button onClick={copySelection} disabled={!floatingSelection && !selectionBox}>
          Copy
        </button>
        <button onClick={pasteSelection} disabled={!clipboardSelection}>
          Paste
        </button>
        <button onClick={duplicateSelection} disabled={!selectionBox}>
          Duplicate
        </button>
        <button onClick={() => rotateSelectionByPixelStep(-1)} disabled={!floatingSelection && !selectionBox}>
          Rotate -1px
        </button>
        <button onClick={() => rotateSelectionByPixelStep(1)} disabled={!floatingSelection && !selectionBox}>
          Rotate +1px
        </button>
        <button onClick={removeSelectedArea} disabled={!floatingSelection && !selectionBox}>
          Remove Selected
        </button>
        <button onClick={() => flipImage("horizontal")}>
          Flip H
        </button>
        <button onClick={() => flipImage("vertical")}>
          Flip V
        </button>
        <button onClick={() => dispatch({ type: "UNDO" })} disabled={state.undoStack.length === 0}>
          Undo
        </button>
        <button onClick={() => dispatch({ type: "REDO" })} disabled={state.redoStack.length === 0}>
          Redo
        </button>
      </div>
      <div className="canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      </div>
    </>
  );
}
