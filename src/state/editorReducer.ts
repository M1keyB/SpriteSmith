import { DEFAULT_PALETTE, MAX_HISTORY } from "../editor/constants";
import { removeBackgroundFromPoint, removeBackgroundPixels } from "../editor/backgroundRemove";
import { clamp, hexToPacked, packedToRgba, rgbaToHex } from "../editor/color";
import { createId } from "../editor/id";
import { applyPoints, floodFill } from "../editor/pixelBuffer";
import { createLayer, getCompositePixels, getEditablePixels, normalizeProjectFrames, setEditablePixels } from "../editor/layers";
import { resizePixels } from "../editor/render";
import { circlePoints, linePoints, rectPoints } from "../editor/tools";
import type { EditorState, Frame, Point, ProjectData, ReferenceImage, Tool } from "../types/models";
import { loadAutoSavedProject } from "./storage";

interface UpdateFramePixelsAction {
  type: "UPDATE_FRAME_PIXELS";
  frameIndex: number;
  pixels: number[];
  pushHistory?: boolean;
}

interface ApplyToolPointAction {
  type: "APPLY_TOOL_POINT";
  point: Point;
  pushHistory?: boolean;
}

interface ApplyToolDragAction {
  type: "APPLY_TOOL_DRAG";
  start: Point;
  end: Point;
  pushHistory?: boolean;
}

export type EditorAction =
  | { type: "SET_TOOL"; tool: Tool }
  | { type: "SET_BRUSH_SIZE"; size: number }
  | { type: "SET_ACTIVE_COLOR"; hex: string }
  | { type: "SET_ACTIVE_COLOR_FROM_PIXEL"; packed: number }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "PAN"; dx: number; dy: number }
  | { type: "TOGGLE_GRID" }
  | { type: "TOGGLE_CHECKER" }
  | { type: "SET_EXPORT_SCALE"; scale: 1 | 2 | 4 | 8 }
  | { type: "SET_FRAME_DURATION"; frameIndex: number; durationMs: number }
  | { type: "SET_ACTIVE_FRAME"; frameIndex: number }
  | { type: "ADD_FRAME" }
  | { type: "DUPLICATE_FRAME"; frameIndex: number }
  | { type: "DELETE_FRAME"; frameIndex: number }
  | { type: "REORDER_FRAMES"; from: number; to: number }
  | { type: "SET_ONION_PREV"; value: boolean }
  | { type: "SET_ONION_NEXT"; value: boolean }
  | { type: "SET_ONION_PREV_OPACITY"; value: number }
  | { type: "SET_ONION_NEXT_OPACITY"; value: number }
  | { type: "SET_GLOBAL_FPS_OVERRIDE"; value: boolean }
  | { type: "SET_GLOBAL_FPS"; value: number }
  | { type: "SET_PLAYING"; value: boolean }
  | { type: "SET_LOOP"; value: boolean }
  | { type: "SET_REFERENCE_IMAGE"; reference: ReferenceImage }
  | { type: "CLEAR_REFERENCE_IMAGE" }
  | { type: "SET_REFERENCE_VISIBLE"; value: boolean }
  | { type: "SET_REFERENCE_OPACITY"; value: number }
  | { type: "SET_REFERENCE_SCALE"; value: number }
  | { type: "SET_REFERENCE_POSITION"; x: number; y: number }
  | { type: "REMOVE_BG_ACTIVE"; tolerance: number; connectedOnly: boolean }
  | { type: "REMOVE_BG_ALL"; tolerance: number; connectedOnly: boolean }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_TAB"; tab: "editor" | "sprite" }
  | { type: "SET_PROJECT_NAME"; name: string }
  | { type: "LOAD_PROJECT"; project: ProjectData }
  | { type: "SET_GRID_SIZE"; width: number; height: number; mode: "crop" | "clear" | "scale" }
  | { type: "SET_PALETTE"; palette: string[] }
  | { type: "ADD_PALETTE_COLOR"; color: string }
  | { type: "REMOVE_PALETTE_COLOR"; index: number }
  | { type: "REORDER_PALETTE_COLOR"; from: number; to: number }
  | ApplyToolPointAction
  | ApplyToolDragAction
  | UpdateFramePixelsAction;

function createEmptyFrame(width: number, height: number): Frame {
  return {
    id: createId(),
    layers: [createLayer(width, height)],
    durationMs: 120
  };
}

function defaultProject(): ProjectData {
  return {
    name: "Untitled SpriteSmith",
    gridWidth: 32,
    gridHeight: 32,
    frames: [createEmptyFrame(32, 32)],
    palette: DEFAULT_PALETTE,
    exportScale: 4
  };
}

function pushHistory(state: EditorState, project: ProjectData): EditorState {
  const nextUndo = [...state.undoStack, state.project].slice(-MAX_HISTORY);
  return { ...state, project, undoStack: nextUndo, redoStack: [] };
}

const bootProject = loadAutoSavedProject() ?? defaultProject();

export const initialEditorState: EditorState = {
  project: bootProject,
  activeFrameIndex: 0,
  activeTool: "pencil",
  brushSize: 1,
  activeColorHex: "#ff004d",
  zoom: 20,
  panX: 40,
  panY: 40,
  showGrid: true,
  showChecker: true,
  onionSkin: {
    showPrev: true,
    showNext: false,
    opacityPrev: 0.35,
    opacityNext: 0.2
  },
  globalFpsOverrideEnabled: false,
  globalFps: 12,
  isPlaying: false,
  loopPreview: true,
  tab: "editor",
  referenceImage: null,
  undoStack: [],
  redoStack: []
};

function updateActiveFramePixels(state: EditorState, pixels: number[], push = true): EditorState {
  const frames = state.project.frames.map((frame, index) =>
    index === state.activeFrameIndex ? setEditablePixels(frame, pixels) : frame
  );
  const project = { ...state.project, frames };
  return push ? pushHistory(state, project) : { ...state, project };
}

const AUTO_REMOVE_TOLERANCE = 56;

function expandPointsForBrush(points: Point[], brushSize: number): Point[] {
  if (brushSize <= 1) return points;
  const radius = (brushSize - 1) / 2;
  const limit = Math.ceil(radius);
  const out: Point[] = [];
  const seen = new Set<string>();

  for (const point of points) {
    for (let dy = -limit; dy <= limit; dy += 1) {
      for (let dx = -limit; dx <= limit; dx += 1) {
        const distance = Math.hypot(dx, dy);
        if (distance > radius + 0.35) continue;
        const x = point.x + dx;
        const y = point.y + dy;
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x, y });
      }
    }
  }

  return out;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_TOOL":
      return { ...state, activeTool: action.tool };
    case "SET_BRUSH_SIZE":
      return { ...state, brushSize: clamp(Math.round(action.size), 1, 16) };
    case "SET_ACTIVE_COLOR":
      return { ...state, activeColorHex: action.hex };
    case "SET_ACTIVE_COLOR_FROM_PIXEL": {
      const [r, g, b, a] = packedToRgba(action.packed);
      if (a === 0) return state;
      return { ...state, activeColorHex: rgbaToHex(r, g, b), activeTool: "pencil" };
    }
    case "SET_ZOOM":
      return { ...state, zoom: clamp(action.zoom, 4, 80) };
    case "PAN":
      return { ...state, panX: state.panX + action.dx, panY: state.panY + action.dy };
    case "TOGGLE_GRID":
      return { ...state, showGrid: !state.showGrid };
    case "TOGGLE_CHECKER":
      return { ...state, showChecker: !state.showChecker };
    case "SET_EXPORT_SCALE":
      return { ...state, project: { ...state.project, exportScale: action.scale } };
    case "SET_FRAME_DURATION": {
      const frames = state.project.frames.map((frame, index) =>
        index === action.frameIndex ? { ...frame, durationMs: clamp(action.durationMs, 16, 5000) } : frame
      );
      return pushHistory(state, { ...state.project, frames });
    }
    case "SET_ACTIVE_FRAME":
      return { ...state, activeFrameIndex: clamp(action.frameIndex, 0, state.project.frames.length - 1) };
    case "ADD_FRAME": {
      const frame = createEmptyFrame(state.project.gridWidth, state.project.gridHeight);
      const frames = [...state.project.frames, frame];
      return pushHistory({ ...state, activeFrameIndex: frames.length - 1 }, { ...state.project, frames });
    }
    case "DUPLICATE_FRAME": {
      const src = state.project.frames[action.frameIndex];
      const dup: Frame = {
        ...src,
        id: createId(),
        layers: src.layers.map((layer) => ({
          ...layer,
          id: createId(),
          pixels: layer.pixels.slice()
        }))
      };
      const frames = state.project.frames.slice();
      frames.splice(action.frameIndex + 1, 0, dup);
      return pushHistory({ ...state, activeFrameIndex: action.frameIndex + 1 }, { ...state.project, frames });
    }
    case "DELETE_FRAME": {
      if (state.project.frames.length <= 1) return state;
      const frames = state.project.frames.filter((_, i) => i !== action.frameIndex);
      const activeFrameIndex = clamp(
        state.activeFrameIndex > action.frameIndex ? state.activeFrameIndex - 1 : state.activeFrameIndex,
        0,
        frames.length - 1
      );
      return pushHistory({ ...state, activeFrameIndex }, { ...state.project, frames });
    }
    case "REORDER_FRAMES": {
      if (action.from === action.to) return state;
      const frames = state.project.frames.slice();
      const [moved] = frames.splice(action.from, 1);
      frames.splice(action.to, 0, moved);

      let active = state.activeFrameIndex;
      if (active === action.from) active = action.to;
      else if (action.from < active && action.to >= active) active -= 1;
      else if (action.from > active && action.to <= active) active += 1;

      return pushHistory({ ...state, activeFrameIndex: active }, { ...state.project, frames });
    }
    case "SET_ONION_PREV":
      return { ...state, onionSkin: { ...state.onionSkin, showPrev: action.value } };
    case "SET_ONION_NEXT":
      return { ...state, onionSkin: { ...state.onionSkin, showNext: action.value } };
    case "SET_ONION_PREV_OPACITY":
      return { ...state, onionSkin: { ...state.onionSkin, opacityPrev: clamp(action.value, 0, 1) } };
    case "SET_ONION_NEXT_OPACITY":
      return { ...state, onionSkin: { ...state.onionSkin, opacityNext: clamp(action.value, 0, 1) } };
    case "SET_GLOBAL_FPS_OVERRIDE":
      return { ...state, globalFpsOverrideEnabled: action.value };
    case "SET_GLOBAL_FPS":
      return { ...state, globalFps: clamp(action.value, 1, 60) };
    case "SET_PLAYING":
      return { ...state, isPlaying: action.value };
    case "SET_LOOP":
      return { ...state, loopPreview: action.value };
    case "SET_REFERENCE_IMAGE":
      return { ...state, referenceImage: action.reference };
    case "CLEAR_REFERENCE_IMAGE":
      return { ...state, referenceImage: null };
    case "SET_REFERENCE_VISIBLE":
      return state.referenceImage
        ? { ...state, referenceImage: { ...state.referenceImage, visible: action.value } }
        : state;
    case "SET_REFERENCE_OPACITY":
      return state.referenceImage
        ? { ...state, referenceImage: { ...state.referenceImage, opacity: clamp(action.value, 0, 1) } }
        : state;
    case "SET_REFERENCE_SCALE":
      return state.referenceImage
        ? { ...state, referenceImage: { ...state.referenceImage, scale: clamp(action.value, 0.05, 20) } }
        : state;
    case "SET_REFERENCE_POSITION":
      return state.referenceImage
        ? { ...state, referenceImage: { ...state.referenceImage, x: action.x, y: action.y } }
        : state;
    case "REMOVE_BG_ACTIVE": {
      const frame = state.project.frames[state.activeFrameIndex];
      const editable = getEditablePixels(frame);
      const keyColor = hexToPacked(state.activeColorHex);
      const pixels = removeBackgroundPixels(
        editable,
        state.project.gridWidth,
        state.project.gridHeight,
        keyColor,
        clamp(action.tolerance, 0, 441),
        action.connectedOnly
      );
      return updateActiveFramePixels(state, pixels, true);
    }
    case "REMOVE_BG_ALL": {
      const keyColor = hexToPacked(state.activeColorHex);
      const frames = state.project.frames.map((frame) => {
        const editable = getEditablePixels(frame);
        const pixels = removeBackgroundPixels(
          editable,
          state.project.gridWidth,
          state.project.gridHeight,
          keyColor,
          clamp(action.tolerance, 0, 441),
          action.connectedOnly
        );
        return setEditablePixels(frame, pixels);
      });
      return pushHistory(state, { ...state.project, frames });
    }
    case "UNDO": {
      const last = state.undoStack[state.undoStack.length - 1];
      if (!last) return state;
      const undoStack = state.undoStack.slice(0, -1);
      return {
        ...state,
        project: last,
        activeFrameIndex: clamp(state.activeFrameIndex, 0, last.frames.length - 1),
        undoStack,
        redoStack: [state.project, ...state.redoStack].slice(0, MAX_HISTORY)
      };
    }
    case "REDO": {
      const [next, ...rest] = state.redoStack;
      if (!next) return state;
      return {
        ...state,
        project: next,
        activeFrameIndex: clamp(state.activeFrameIndex, 0, next.frames.length - 1),
        undoStack: [...state.undoStack, state.project].slice(-MAX_HISTORY),
        redoStack: rest
      };
    }
    case "SET_TAB":
      return { ...state, tab: action.tab };
    case "SET_PROJECT_NAME":
      return { ...state, project: { ...state.project, name: action.name } };
    case "LOAD_PROJECT":
      return {
        ...state,
        project: normalizeProjectFrames(action.project),
        activeFrameIndex: 0,
        undoStack: [],
        redoStack: []
      };
    case "SET_GRID_SIZE": {
      const frames = state.project.frames.map((frame) => ({
        ...frame,
        layers: frame.layers.map((layer) => ({
          ...layer,
          pixels: resizePixels(
            layer.pixels,
            state.project.gridWidth,
            state.project.gridHeight,
            action.width,
            action.height,
            action.mode
          )
        }))
      }));
      const project = { ...state.project, gridWidth: action.width, gridHeight: action.height, frames };
      return pushHistory(state, project);
    }
    case "SET_PALETTE":
      return { ...state, project: { ...state.project, palette: action.palette } };
    case "ADD_PALETTE_COLOR": {
      if (state.project.palette.includes(action.color)) return state;
      return { ...state, project: { ...state.project, palette: [...state.project.palette, action.color] } };
    }
    case "REMOVE_PALETTE_COLOR": {
      const palette = state.project.palette.filter((_, i) => i !== action.index);
      return { ...state, project: { ...state.project, palette } };
    }
    case "REORDER_PALETTE_COLOR": {
      if (action.from === action.to) return state;
      const palette = state.project.palette.slice();
      const [moved] = palette.splice(action.from, 1);
      palette.splice(action.to, 0, moved);
      return { ...state, project: { ...state.project, palette } };
    }
    case "APPLY_TOOL_POINT": {
      const frame = state.project.frames[state.activeFrameIndex];
      const editablePixels = getEditablePixels(frame);
      const color = state.activeTool === "eraser" ? 0 : hexToPacked(state.activeColorHex);
      const shouldPush = action.pushHistory !== false;
      if (state.activeTool === "fill") {
        const pixels = floodFill(
          editablePixels,
          state.project.gridWidth,
          state.project.gridHeight,
          action.point.x,
          action.point.y,
          color
        );
        return updateActiveFramePixels(state, pixels, shouldPush);
      }

      if (state.activeTool === "picker") {
        const idx = action.point.y * state.project.gridWidth + action.point.x;
        const composite = getCompositePixels(frame, state.project.gridWidth, state.project.gridHeight);
        return editorReducer(state, { type: "SET_ACTIVE_COLOR_FROM_PIXEL", packed: composite[idx] });
      }

      if (state.activeTool === "auto-remove") {
        const pixels = removeBackgroundFromPoint(
          editablePixels,
          state.project.gridWidth,
          state.project.gridHeight,
          action.point.x,
          action.point.y,
          AUTO_REMOVE_TOLERANCE
        );
        return updateActiveFramePixels(state, pixels, shouldPush);
      }

      const points =
        state.activeTool === "pencil" || state.activeTool === "eraser"
          ? expandPointsForBrush([action.point], state.brushSize)
          : [action.point];
      const pixels = applyPoints(editablePixels, points, state.project.gridWidth, state.project.gridHeight, color);
      return updateActiveFramePixels(state, pixels, shouldPush);
    }
    case "APPLY_TOOL_DRAG": {
      const frame = state.project.frames[state.activeFrameIndex];
      const editablePixels = getEditablePixels(frame);
      const color = state.activeTool === "eraser" ? 0 : hexToPacked(state.activeColorHex);
      const shouldPush = action.pushHistory !== false;
      let points: Point[] = [];
      if (state.activeTool === "line") points = linePoints(action.start, action.end);
      if (state.activeTool === "rect") points = rectPoints(action.start, action.end);
      if (state.activeTool === "circle") points = circlePoints(action.start, action.end);
      if (state.activeTool === "pencil" || state.activeTool === "eraser") points = linePoints(action.start, action.end);
      if (state.activeTool === "pencil" || state.activeTool === "eraser") {
        points = expandPointsForBrush(points, state.brushSize);
      }
      const pixels = applyPoints(editablePixels, points, state.project.gridWidth, state.project.gridHeight, color);
      return updateActiveFramePixels(state, pixels, shouldPush);
    }
    case "UPDATE_FRAME_PIXELS": {
      const frames = state.project.frames.map((frame, i) =>
        i === action.frameIndex ? setEditablePixels(frame, action.pixels) : frame
      );
      const project = { ...state.project, frames };
      return action.pushHistory === false ? { ...state, project } : pushHistory(state, project);
    }
    default:
      return state;
  }
}
