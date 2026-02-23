import { DEFAULT_PALETTE, MAX_HISTORY } from "../editor/constants";
import { removeBackgroundFromPoint, removeBackgroundPixels } from "../editor/backgroundRemove";
import { clamp, hexToPacked, packedToRgba, rgbaToHex } from "../editor/color";
import { createId } from "../editor/id";
import { applyPoints, floodFill } from "../editor/pixelBuffer";
import { alphaCompositePixels, createLayer, getCompositePixels, getEditablePixels, normalizeProjectFrames, setEditablePixels } from "../editor/layers";
import { resizePixels } from "../editor/render";
import { createDefaultRigData, normalizeRigData, normalizeRigPoseByFrame } from "../editor/rig";
import { autoMapBones, createEmptyBoneMapping, getPresetById, normalizeBoneMapping, type PresetId } from "../rig/presets";
import { getRigPresetById } from "../rig/rigPresets";
import { circlePoints, linePoints, rectPoints } from "../editor/tools";
import type {
  BoneMapping,
  BonePose,
  BoneRole,
  EditorState,
  Frame,
  Point,
  ProjectData,
  ReferenceImage,
  RigBone,
  RigData,
  Segment,
  Layer,
  Tool
} from "../types/models";
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
  brushSizeOverride?: number;
  pushHistory?: boolean;
}

interface ApplyToolDragAction {
  type: "APPLY_TOOL_DRAG";
  start: Point;
  end: Point;
  brushSizeOverride?: number;
  pushHistory?: boolean;
}

export type EditorAction =
  | { type: "SET_EDITOR_MODE"; mode: "pixels" | "bones" }
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
  | { type: "SET_ACTIVE_LAYER"; layerId: string }
  | { type: "ADD_LAYER" }
  | { type: "DUPLICATE_LAYER"; layerId?: string }
  | { type: "DELETE_LAYER"; layerId?: string }
  | { type: "MERGE_LAYER_DOWN"; layerId?: string }
  | { type: "FLATTEN_LAYERS" }
  | { type: "RENAME_LAYER"; layerId: string; name: string }
  | { type: "SET_LAYER_VISIBLE"; layerId: string; visible: boolean }
  | { type: "SET_LAYER_OPACITY"; layerId: string; opacity: number }
  | { type: "MOVE_LAYER"; layerId: string; direction: "up" | "down" }
  | { type: "RIG_SELECT_JOINT"; jointId: string | null }
  | { type: "RIG_SELECT_BONE"; boneId: string | null }
  | { type: "SET_BONE_MAPPING"; role: BoneRole; boneId: string | null }
  | { type: "AUTO_MAP_BONES" }
  | {
      type: "RIG_INSERT_PRESET";
      presetId: string;
      replaceExisting: boolean;
      autoMap: boolean;
      centerRig: boolean;
    }
  | { type: "APPLY_RIG_PRESET"; presetId: PresetId; frameCount: number; overwrite: boolean }
  | { type: "SELECT_SEGMENT"; segmentId: string | null }
  | { type: "SET_SEGMENT_SELECTION_MODE"; value: boolean }
  | { type: "SET_SEGMENT_SELECTION"; selection: { x: number; y: number; w: number; h: number } | null }
  | { type: "ATTACH_SEGMENT"; segment: Segment; clearedPixels?: number[] }
  | { type: "DETACH_SEGMENT"; segmentId: string }
  | { type: "RIG_SET_OVERLAY"; value: boolean }
  | { type: "RIG_SET_INCLUDE_OVERLAY_EXPORT"; value: boolean }
  | { type: "RIG_ADD_CHAIN_JOINT"; x: number; y: number; parentJointId: string | null }
  | { type: "RIG_MOVE_JOINT"; jointId: string; x: number; y: number; pushHistory?: boolean }
  | { type: "RIG_SET_BONE_ROTATION"; boneId: string; rotDeg: number; frameIndex?: number }
  | { type: "RIG_DELETE_SELECTED" }
  | { type: "RIG_RENAME_BONE"; boneId: string; name: string }
  | { type: "RIG_CLEAR" }
  | { type: "RIG_APPLY_WAVE"; amplitudeDeg?: number; boneId?: string | null }
  | { type: "SET_GRID_SIZE"; width: number; height: number; mode: "crop" | "clear" | "scale" }
  | { type: "SET_PALETTE"; palette: string[] }
  | { type: "ADD_PALETTE_COLOR"; color: string }
  | { type: "REMOVE_PALETTE_COLOR"; index: number }
  | { type: "REORDER_PALETTE_COLOR"; from: number; to: number }
  | ApplyToolPointAction
  | ApplyToolDragAction
  | UpdateFramePixelsAction;

function createEmptyFrame(width: number, height: number): Frame {
  const baseLayer = createLayer(width, height);
  return {
    id: createId(),
    layers: [baseLayer],
    activeLayerId: baseLayer.id,
    durationMs: 120
  };
}

function cloneFrameWithFreshLayerIds(frame: Frame): Frame {
  const layerIdMap = new Map<string, string>();
  const layers = frame.layers.map((layer) => {
    const id = createId();
    layerIdMap.set(layer.id, id);
    return { ...layer, id, pixels: layer.pixels.slice() };
  });
  return {
    ...frame,
    id: createId(),
    layers,
    activeLayerId: layerIdMap.get(frame.activeLayerId) ?? layers[0]?.id ?? createId()
  };
}

function framePoseKey(frame: Frame | undefined, fallbackIndex = 0): string {
  return frame?.id ?? String(fallbackIndex);
}

function defaultProject(): ProjectData {
  return {
    name: "Untitled SpriteSmith",
    gridWidth: 32,
    gridHeight: 32,
    frames: [createEmptyFrame(32, 32)],
    palette: DEFAULT_PALETTE,
    exportScale: 4,
    rig: createDefaultRigData(),
    rigPoseByFrame: {},
    segments: [],
    boneMapping: createEmptyBoneMapping()
  };
}

function pushHistory(state: EditorState, project: ProjectData): EditorState {
  const nextUndo = [...state.undoStack, state.project].slice(-MAX_HISTORY);
  return { ...state, project, undoStack: nextUndo, redoStack: [] };
}

function normalizeProject(project: ProjectData): ProjectData {
  const normalizedFrames = normalizeProjectFrames(project);
  const rig = normalizeRigData(normalizedFrames);
  const segments = Array.isArray((normalizedFrames as { segments?: Segment[] }).segments)
    ? (normalizedFrames as { segments?: Segment[] }).segments!
        .filter((segment) => typeof segment?.id === "string" && typeof segment?.boneId === "string")
        .map((segment) => ({
          id: segment.id,
          boneId: segment.boneId,
          frameIndex: clamp(Math.round(segment.frameIndex ?? 0), 0, Math.max(0, normalizedFrames.frames.length - 1)),
          w: Math.max(1, Math.round(segment.w ?? 1)),
          h: Math.max(1, Math.round(segment.h ?? 1)),
          pixels: typeof segment.pixels === "string" ? segment.pixels : "",
          anchor: {
            x: Math.round(segment.anchor?.x ?? 0),
            y: Math.round(segment.anchor?.y ?? 0)
          },
          offset: {
            x: Number.isFinite(segment.offset?.x) ? segment.offset.x : 0,
            y: Number.isFinite(segment.offset?.y) ? segment.offset.y : 0
          },
          zIndex: Number.isFinite(segment.zIndex) ? segment.zIndex : 0
        }))
    : [];
  return {
    ...normalizedFrames,
    rig,
    rigPoseByFrame: normalizeRigPoseByFrame(normalizedFrames, rig),
    segments,
    boneMapping: normalizeBoneMapping((normalizedFrames as Partial<ProjectData>).boneMapping, rig.bones)
  };
}

function makeBoneName(index: number): string {
  return `Bone ${index + 1}`;
}

function findWaveTargetBone(state: EditorState, explicitBoneId?: string | null): RigBone | null {
  if (explicitBoneId) {
    return state.project.rig.bones.find((bone) => bone.id === explicitBoneId) ?? null;
  }
  if (state.selectedRigBoneId) {
    return state.project.rig.bones.find((bone) => bone.id === state.selectedRigBoneId) ?? null;
  }
  const named = state.project.rig.bones.find((bone) => (bone.name ?? "").toLowerCase().includes("arm"));
  return named ?? state.project.rig.bones[0] ?? null;
}

function buildRigFromPreset(
  presetId: string,
  gridWidth: number,
  gridHeight: number,
  centerRig: boolean
): {
  rig: RigData;
  roleMappingByBoneId: Partial<Record<BoneRole, string>>;
  firstBoneId: string | null;
} {
  const preset = getRigPresetById(presetId);
  const toGridX = (x: number): number => clamp(Math.round(x * (gridWidth - 1)), 0, Math.max(0, gridWidth - 1));
  const toGridY = (y: number): number => clamp(Math.round(y * (gridHeight - 1)), 0, Math.max(0, gridHeight - 1));
  const rawJoints = preset.joints.map((joint) => ({ ...joint, x: toGridX(joint.x), y: toGridY(joint.y) }));

  let shiftX = 0;
  let shiftY = 0;
  if (centerRig && rawJoints.length > 0) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const joint of rawJoints) {
      minX = Math.min(minX, joint.x);
      minY = Math.min(minY, joint.y);
      maxX = Math.max(maxX, joint.x);
      maxY = Math.max(maxY, joint.y);
    }
    const rigWidth = maxX - minX + 1;
    const rigHeight = maxY - minY + 1;
    const targetMinX = Math.floor((gridWidth - rigWidth) / 2);
    const targetMinY = Math.floor((gridHeight - rigHeight) / 2);
    shiftX = targetMinX - minX;
    shiftY = targetMinY - minY;
  }

  const presetJointIdToLiveId = new Map<string, string>();
  const joints = rawJoints.map((joint) => {
    const id = createId();
    presetJointIdToLiveId.set(joint.id, id);
    return {
      id,
      x: clamp(joint.x + shiftX, 0, Math.max(0, gridWidth - 1)),
      y: clamp(joint.y + shiftY, 0, Math.max(0, gridHeight - 1))
    };
  });

  for (let i = 0; i < rawJoints.length; i += 1) {
    const parentPresetId = rawJoints[i].parentId;
    if (!parentPresetId) continue;
    const parentLiveId = presetJointIdToLiveId.get(parentPresetId);
    if (!parentLiveId) continue;
    joints[i].parentId = parentLiveId;
  }

  const jointsById = new Map(joints.map((joint) => [joint.id, joint]));
  const presetBoneIdToLiveId = new Map<string, string>();
  const incomingByStartJoint = new Map<string, string>();
  const bones = preset.bones.map((bone) => {
    const aJointId = presetJointIdToLiveId.get(bone.a);
    const bJointId = presetJointIdToLiveId.get(bone.b);
    if (!aJointId || !bJointId) return null;
    const aJoint = jointsById.get(aJointId);
    const bJoint = jointsById.get(bJointId);
    if (!aJoint || !bJoint) return null;
    const id = createId();
    presetBoneIdToLiveId.set(bone.id, id);
    incomingByStartJoint.set(bJointId, id);
    return {
      id,
      aJointId,
      bJointId,
      name: bone.name,
      length: Math.hypot(bJoint.x - aJoint.x, bJoint.y - aJoint.y)
    };
  });

  const normalizedBones = bones.filter((bone): bone is NonNullable<typeof bone> => Boolean(bone)).map((bone) => ({
    ...bone,
    parentBoneId: incomingByStartJoint.get(bone.aJointId)
  }));

  const roleMappingByBoneId: Partial<Record<BoneRole, string>> = {};
  const presetBoneById = new Map(preset.bones.map((bone) => [bone.id, bone]));
  for (const [role, presetBoneId] of Object.entries(preset.defaultMapping) as Array<[BoneRole, string]>) {
    let boneId = presetBoneIdToLiveId.get(presetBoneId);
    if (!boneId) {
      const presetBone = preset.bones.find((bone) => bone.name === presetBoneId);
      if (presetBone) boneId = presetBoneIdToLiveId.get(presetBone.id);
    }
    if (!boneId) {
      for (const [sourcePresetId, liveId] of presetBoneIdToLiveId.entries()) {
        const source = presetBoneById.get(sourcePresetId);
        if (source?.name === presetBoneId) {
          boneId = liveId;
          break;
        }
      }
    }
    if (boneId) roleMappingByBoneId[role] = boneId;
  }

  return {
    rig: {
      joints,
      bones: normalizedBones,
      showOverlay: true,
      includeOverlayInExport: false
    },
    roleMappingByBoneId,
    firstBoneId: normalizedBones[0]?.id ?? null
  };
}

const bootProject = loadAutoSavedProject() ?? defaultProject();

export const initialEditorState: EditorState = {
  project: normalizeProject(bootProject),
  editorMode: "pixels",
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
  selectedRigJointId: null,
  selectedRigBoneId: null,
  rigChainJointId: null,
  selectedSegmentId: null,
  segmentSelection: null,
  segmentSelectionMode: false,
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
    case "SET_EDITOR_MODE":
      return action.mode === "bones"
        ? { ...state, editorMode: action.mode }
        : { ...state, editorMode: action.mode, segmentSelectionMode: false };
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
      const sourceFrame = state.project.frames[state.activeFrameIndex] ?? state.project.frames[0];
      const sourceKey = framePoseKey(sourceFrame, state.activeFrameIndex);
      const nextKey = framePoseKey(frame, frames.length - 1);
      const rigPoseByFrame = {
        ...state.project.rigPoseByFrame,
        [nextKey]: { ...(state.project.rigPoseByFrame[sourceKey] ?? {}) }
      };
      return pushHistory({ ...state, activeFrameIndex: frames.length - 1 }, { ...state.project, frames, rigPoseByFrame });
    }
    case "DUPLICATE_FRAME": {
      const src = state.project.frames[action.frameIndex];
      const dup: Frame = cloneFrameWithFreshLayerIds(src);
      const frames = state.project.frames.slice();
      frames.splice(action.frameIndex + 1, 0, dup);
      const srcKey = framePoseKey(src, action.frameIndex);
      const dupKey = framePoseKey(dup, action.frameIndex + 1);
      const rigPoseByFrame: ProjectData["rigPoseByFrame"] = {
        ...state.project.rigPoseByFrame,
        [dupKey]: { ...(state.project.rigPoseByFrame[srcKey] ?? {}) }
      };
      const segments = state.project.segments.map((segment) => ({
        ...segment,
        frameIndex: segment.frameIndex > action.frameIndex ? segment.frameIndex + 1 : segment.frameIndex
      }));
      return pushHistory(
        { ...state, activeFrameIndex: action.frameIndex + 1 },
        { ...state.project, frames, rigPoseByFrame, segments }
      );
    }
    case "DELETE_FRAME": {
      if (state.project.frames.length <= 1) return state;
      const removedFrame = state.project.frames[action.frameIndex];
      const removedKey = framePoseKey(removedFrame, action.frameIndex);
      const frames = state.project.frames.filter((_, i) => i !== action.frameIndex);
      const rigPoseByFrame: ProjectData["rigPoseByFrame"] = { ...state.project.rigPoseByFrame };
      delete rigPoseByFrame[removedKey];
      const activeFrameIndex = clamp(
        state.activeFrameIndex > action.frameIndex ? state.activeFrameIndex - 1 : state.activeFrameIndex,
        0,
        frames.length - 1
      );
      const segments = state.project.segments
        .filter((segment) => segment.frameIndex !== action.frameIndex)
        .map((segment) => ({
          ...segment,
          frameIndex: segment.frameIndex > action.frameIndex ? segment.frameIndex - 1 : segment.frameIndex
        }));
      return pushHistory({ ...state, activeFrameIndex }, { ...state.project, frames, rigPoseByFrame, segments });
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

      const rigPoseByFrame: ProjectData["rigPoseByFrame"] = { ...state.project.rigPoseByFrame };

      const remapFrameIndex = (index: number): number => {
        if (index === action.from) return action.to;
        if (action.from < action.to && index > action.from && index <= action.to) return index - 1;
        if (action.from > action.to && index >= action.to && index < action.from) return index + 1;
        return index;
      };
      const segments = state.project.segments.map((segment) => ({
        ...segment,
        frameIndex: remapFrameIndex(segment.frameIndex)
      }));

      return pushHistory({ ...state, activeFrameIndex: active }, { ...state.project, frames, rigPoseByFrame, segments });
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
        project: normalizeProject(action.project),
        editorMode: "pixels",
        activeFrameIndex: 0,
        selectedRigJointId: null,
        selectedRigBoneId: null,
        rigChainJointId: null,
        selectedSegmentId: null,
        segmentSelection: null,
        segmentSelectionMode: false,
        undoStack: [],
        redoStack: []
      };
    case "SET_ACTIVE_LAYER": {
      const frame = state.project.frames[state.activeFrameIndex];
      if (!frame || !frame.layers.some((layer) => layer.id === action.layerId)) return state;
      const frames = state.project.frames.map((candidate, index) =>
        index === state.activeFrameIndex ? { ...candidate, activeLayerId: action.layerId } : candidate
      );
      return { ...state, project: { ...state.project, frames } };
    }
    case "ADD_LAYER": {
      const frame = state.project.frames[state.activeFrameIndex];
      if (!frame) return state;
      const layer = createLayer(state.project.gridWidth, state.project.gridHeight, `Layer ${frame.layers.length + 1}`);
      const frames = state.project.frames.map((candidate, index) =>
        index === state.activeFrameIndex
          ? { ...candidate, layers: [...candidate.layers, layer], activeLayerId: layer.id }
          : candidate
      );
      return pushHistory(state, { ...state.project, frames });
    }
    case "DUPLICATE_LAYER": {
      const frame = state.project.frames[state.activeFrameIndex];
      if (!frame) return state;
      const sourceIndex = frame.layers.findIndex((layer) => layer.id === (action.layerId ?? frame.activeLayerId));
      if (sourceIndex < 0) return state;
      const source = frame.layers[sourceIndex];
      const copy: Layer = {
        ...source,
        id: createId(),
        name: `${source.name} Copy`,
        pixels: source.pixels.slice()
      };
      const layers = frame.layers.slice();
      layers.splice(sourceIndex + 1, 0, copy);
      const frames = state.project.frames.map((candidate, index) =>
        index === state.activeFrameIndex ? { ...candidate, layers, activeLayerId: copy.id } : candidate
      );
      return pushHistory(state, { ...state.project, frames });
    }
    case "DELETE_LAYER": {
      const frame = state.project.frames[state.activeFrameIndex];
      if (!frame || frame.layers.length <= 1) return state;
      const targetId = action.layerId ?? frame.activeLayerId;
      const targetIndex = frame.layers.findIndex((layer) => layer.id === targetId);
      if (targetIndex < 0) return state;
      const layers = frame.layers.filter((layer) => layer.id !== targetId);
      const nextActive = layers[Math.max(0, targetIndex - 1)]?.id ?? layers[0].id;
      const frames = state.project.frames.map((candidate, index) =>
        index === state.activeFrameIndex ? { ...candidate, layers, activeLayerId: nextActive } : candidate
      );
      return pushHistory(state, { ...state.project, frames });
    }
    case "SET_LAYER_VISIBLE": {
      const frame = state.project.frames[state.activeFrameIndex];
      if (!frame) return state;
      const layers = frame.layers.map((layer) =>
        layer.id === action.layerId ? { ...layer, visible: action.visible } : layer
      );
      const frames = state.project.frames.map((candidate, index) =>
        index === state.activeFrameIndex ? { ...candidate, layers } : candidate
      );
      return pushHistory(state, { ...state.project, frames });
    }
    case "SET_LAYER_OPACITY": {
      const frame = state.project.frames[state.activeFrameIndex];
      if (!frame) return state;
      const opacity = clamp(action.opacity, 0, 1);
      const layers = frame.layers.map((layer) =>
        layer.id === action.layerId ? { ...layer, opacity } : layer
      );
      const frames = state.project.frames.map((candidate, index) =>
        index === state.activeFrameIndex ? { ...candidate, layers } : candidate
      );
      return pushHistory(state, { ...state.project, frames });
    }
    case "RENAME_LAYER": {
      const frame = state.project.frames[state.activeFrameIndex];
      if (!frame) return state;
      const nextName = action.name.trim() || "Layer";
      const layers = frame.layers.map((layer) =>
        layer.id === action.layerId ? { ...layer, name: nextName } : layer
      );
      const frames = state.project.frames.map((candidate, index) =>
        index === state.activeFrameIndex ? { ...candidate, layers } : candidate
      );
      return pushHistory(state, { ...state.project, frames });
    }
    case "MOVE_LAYER": {
      const frame = state.project.frames[state.activeFrameIndex];
      if (!frame) return state;
      const from = frame.layers.findIndex((layer) => layer.id === action.layerId);
      if (from < 0) return state;
      const to = action.direction === "up" ? from + 1 : from - 1;
      if (to < 0 || to >= frame.layers.length) return state;
      const layers = frame.layers.slice();
      const [moved] = layers.splice(from, 1);
      layers.splice(to, 0, moved);
      const frames = state.project.frames.map((candidate, index) =>
        index === state.activeFrameIndex ? { ...candidate, layers } : candidate
      );
      return pushHistory(state, { ...state.project, frames });
    }
    case "MERGE_LAYER_DOWN": {
      const frame = state.project.frames[state.activeFrameIndex];
      if (!frame || frame.layers.length <= 1) return state;
      const activeId = action.layerId ?? frame.activeLayerId;
      const upperIndex = frame.layers.findIndex((layer) => layer.id === activeId);
      if (upperIndex <= 0) return state;
      const upper = frame.layers[upperIndex];
      const lowerIndex = (() => {
        for (let i = upperIndex - 1; i >= 0; i -= 1) {
          if (frame.layers[i].visible) return i;
        }
        return upperIndex - 1;
      })();
      if (lowerIndex < 0 || lowerIndex === upperIndex) return state;
      const lower = frame.layers[lowerIndex];
      const mergedLower: Layer = {
        ...lower,
        pixels: alphaCompositePixels(lower.pixels, upper.pixels, upper.opacity)
      };
      const layers = frame.layers.filter((layer) => layer.id !== upper.id).map((layer) =>
        layer.id === lower.id ? mergedLower : layer
      );
      const frames = state.project.frames.map((candidate, index) =>
        index === state.activeFrameIndex ? { ...candidate, layers, activeLayerId: lower.id } : candidate
      );
      return pushHistory(state, { ...state.project, frames });
    }
    case "FLATTEN_LAYERS": {
      const frame = state.project.frames[state.activeFrameIndex];
      if (!frame || frame.layers.length <= 1) return state;
      const merged = getCompositePixels(frame, state.project.gridWidth, state.project.gridHeight);
      const layer: Layer = {
        id: createId(),
        name: "Layer 1",
        visible: true,
        opacity: 1,
        pixels: merged
      };
      const frames = state.project.frames.map((candidate, index) =>
        index === state.activeFrameIndex ? { ...candidate, layers: [layer], activeLayerId: layer.id } : candidate
      );
      return pushHistory(state, { ...state.project, frames });
    }
    case "RIG_SELECT_JOINT":
      return {
        ...state,
        selectedRigJointId: action.jointId,
        selectedRigBoneId: null,
        selectedSegmentId: null,
        rigChainJointId: action.jointId ?? state.rigChainJointId
      };
    case "RIG_SELECT_BONE":
      return { ...state, selectedRigBoneId: action.boneId, selectedRigJointId: null, selectedSegmentId: null };
    case "SET_BONE_MAPPING": {
      const nextMapping = { ...state.project.boneMapping, [action.role]: action.boneId };
      return { ...state, project: { ...state.project, boneMapping: nextMapping } };
    }
    case "AUTO_MAP_BONES":
      return { ...state, project: { ...state.project, boneMapping: autoMapBones(state.project.rig.bones) } };
    case "RIG_INSERT_PRESET": {
      const hasExistingRig = state.project.rig.joints.length > 0 || state.project.rig.bones.length > 0;
      if (hasExistingRig && !action.replaceExisting) return state;

      const built = buildRigFromPreset(action.presetId, state.project.gridWidth, state.project.gridHeight, action.centerRig);
      const baseMapping: BoneMapping = createEmptyBoneMapping();
      const nextMapping: BoneMapping = action.autoMap
        ? { ...baseMapping, ...built.roleMappingByBoneId }
        : baseMapping;

      const rig = {
        ...built.rig,
        showOverlay: state.project.rig.showOverlay,
        includeOverlayInExport: state.project.rig.includeOverlayInExport
      };
      const project: ProjectData = {
        ...state.project,
        rig,
        rigPoseByFrame: {},
        segments: action.replaceExisting ? [] : state.project.segments,
        boneMapping: nextMapping
      };
      return pushHistory(
        {
          ...state,
          selectedRigJointId: rig.joints[0]?.id ?? null,
          selectedRigBoneId: built.firstBoneId,
          selectedSegmentId: null,
          rigChainJointId: rig.joints[0]?.id ?? null
        },
        project
      );
    }
    case "APPLY_RIG_PRESET": {
      const frameCount = clamp(Math.round(action.frameCount), 1, 240);
      const preset = getPresetById(action.presetId);
      let frames = state.project.frames;
      let rigPoseByFrame: ProjectData["rigPoseByFrame"] = { ...state.project.rigPoseByFrame };
      let segments = state.project.segments;

      if (frames.length < frameCount) {
        const sourceFrame = state.project.frames[state.activeFrameIndex] ?? state.project.frames[0];
        if (sourceFrame) {
          const generated = frames.slice();
          for (let i = frames.length; i < frameCount; i += 1) {
            generated.push(cloneFrameWithFreshLayerIds(sourceFrame));
          }
          const sourceSegments = state.project.segments.filter((segment) => segment.frameIndex === state.activeFrameIndex);
          if (sourceSegments.length > 0) {
            const generatedSegments = state.project.segments.slice();
            for (let i = frames.length; i < frameCount; i += 1) {
              for (const segment of sourceSegments) {
                generatedSegments.push({ ...segment, id: createId(), frameIndex: i });
              }
            }
            segments = generatedSegments;
          }
          frames = generated;
        }
      }

      const durationMs = state.globalFpsOverrideEnabled ? Math.max(16, Math.round(1000 / state.globalFps)) : null;
      if (durationMs) {
        frames = frames.map((frame, index) => (index < frameCount ? { ...frame, durationMs } : frame));
      }

      for (let i = 0; i < frameCount; i += 1) {
        const t = i / frameCount;
        const key = framePoseKey(frames[i], i);
        const generatedPose = preset.fn(t, state.project.rig.bones, state.project.boneMapping, state.selectedRigBoneId);
        if (action.overwrite) rigPoseByFrame[key] = generatedPose;
        else rigPoseByFrame[key] = { ...(rigPoseByFrame[key] ?? {}), ...generatedPose };
      }

      return pushHistory(state, { ...state.project, frames, rigPoseByFrame, segments });
    }
    case "SELECT_SEGMENT":
      return { ...state, selectedSegmentId: action.segmentId, selectedRigJointId: null, selectedRigBoneId: null };
    case "SET_SEGMENT_SELECTION_MODE":
      return { ...state, segmentSelectionMode: action.value };
    case "SET_SEGMENT_SELECTION":
      return { ...state, segmentSelection: action.selection };
    case "ATTACH_SEGMENT": {
      const segments = [...state.project.segments, action.segment];
      let frames = state.project.frames;
      if (action.clearedPixels) {
        frames = state.project.frames.map((frame, index) =>
          index === state.activeFrameIndex ? setEditablePixels(frame, action.clearedPixels) : frame
        );
      }
      return pushHistory(
        { ...state, selectedSegmentId: action.segment.id },
        { ...state.project, segments, frames }
      );
    }
    case "DETACH_SEGMENT": {
      const segments = state.project.segments.filter((segment) => segment.id !== action.segmentId);
      return pushHistory(
        { ...state, selectedSegmentId: state.selectedSegmentId === action.segmentId ? null : state.selectedSegmentId },
        { ...state.project, segments }
      );
    }
    case "RIG_SET_OVERLAY":
      return {
        ...state,
        project: { ...state.project, rig: { ...state.project.rig, showOverlay: action.value } }
      };
    case "RIG_SET_INCLUDE_OVERLAY_EXPORT":
      return {
        ...state,
        project: { ...state.project, rig: { ...state.project.rig, includeOverlayInExport: action.value } }
      };
    case "RIG_ADD_CHAIN_JOINT": {
      const nextJoint = {
        id: createId(),
        x: action.x,
        y: action.y,
        parentId: action.parentJointId ?? undefined
      };
      let bones = state.project.rig.bones;
      let createdBoneId: string | null = null;
      if (action.parentJointId) {
        const parentJoint = state.project.rig.joints.find((joint) => joint.id === action.parentJointId);
        if (parentJoint) {
          const dx = action.x - parentJoint.x;
          const dy = action.y - parentJoint.y;
          const parentBone =
            state.project.rig.bones.find((bone) => bone.bJointId === action.parentJointId) ??
            state.project.rig.bones.find((bone) => bone.aJointId === action.parentJointId || bone.bJointId === action.parentJointId);
          const createdBone = {
            id: createId(),
            aJointId: action.parentJointId,
            bJointId: nextJoint.id,
            parentBoneId: parentBone?.id,
            length: Math.hypot(dx, dy),
            name: makeBoneName(state.project.rig.bones.length)
          };
          createdBoneId = createdBone.id;
          bones = [...bones, createdBone];
        }
      }
      const rig = {
        ...state.project.rig,
        joints: [...state.project.rig.joints, nextJoint],
        bones
      };
      return pushHistory(
        {
          ...state,
          selectedRigJointId: nextJoint.id,
          selectedRigBoneId: createdBoneId,
          rigChainJointId: nextJoint.id
        },
        { ...state.project, rig }
      );
    }
    case "RIG_MOVE_JOINT": {
      const joints = state.project.rig.joints.map((joint) =>
        joint.id === action.jointId ? { ...joint, x: action.x, y: action.y } : joint
      );
      const jointMap = new Map(joints.map((joint) => [joint.id, joint]));
      const bones = state.project.rig.bones.map((bone) => {
        const a = jointMap.get(bone.aJointId);
        const b = jointMap.get(bone.bJointId);
        if (!a || !b) return bone;
        return { ...bone, length: Math.hypot(b.x - a.x, b.y - a.y) };
      });
      const project = { ...state.project, rig: { ...state.project.rig, joints, bones } };
      return action.pushHistory === false ? { ...state, project } : pushHistory(state, project);
    }
    case "RIG_SET_BONE_ROTATION": {
      const frameIndex = clamp(action.frameIndex ?? state.activeFrameIndex, 0, state.project.frames.length - 1);
      const key = framePoseKey(state.project.frames[frameIndex], frameIndex);
      const framePose = state.project.rigPoseByFrame[key] ?? {};
      const rigPoseByFrame = {
        ...state.project.rigPoseByFrame,
        [key]: {
          ...framePose,
          [action.boneId]: { ...(framePose[action.boneId] ?? {}), rotDeg: clamp(action.rotDeg, -180, 180) }
        }
      };
      return pushHistory(state, { ...state.project, rigPoseByFrame });
    }
    case "RIG_DELETE_SELECTED": {
      if (!state.selectedRigJointId && !state.selectedRigBoneId && !state.selectedSegmentId) return state;
      if (state.selectedSegmentId) {
        const segments = state.project.segments.filter((segment) => segment.id !== state.selectedSegmentId);
        return pushHistory({ ...state, selectedSegmentId: null }, { ...state.project, segments });
      }
      let joints = state.project.rig.joints.slice();
      let bones = state.project.rig.bones.slice();
      let segments = state.project.segments.slice();
      let selectedJointId = state.selectedRigJointId;
      let selectedBoneId = state.selectedRigBoneId;
      let rigChainJointId = state.rigChainJointId;

      if (state.selectedRigJointId) {
        const removeJointIds = new Set<string>([state.selectedRigJointId]);
        bones = bones.filter((bone) => !removeJointIds.has(bone.aJointId) && !removeJointIds.has(bone.bJointId));
        joints = joints.filter((joint) => !removeJointIds.has(joint.id));
        selectedJointId = null;
        selectedBoneId = null;
        if (rigChainJointId && removeJointIds.has(rigChainJointId)) rigChainJointId = null;
      } else if (state.selectedRigBoneId) {
        const removeBoneIds = new Set<string>([state.selectedRigBoneId]);
        bones = bones.filter((bone) => !removeBoneIds.has(bone.id));
        segments = segments.filter((segment) => !removeBoneIds.has(segment.boneId));
        selectedBoneId = null;
      }

      const jointIds = new Set(joints.map((joint) => joint.id));
      bones = bones.filter((bone) => jointIds.has(bone.aJointId) && jointIds.has(bone.bJointId));
      bones = bones.map((bone) => ({
        ...bone,
        parentBoneId: bone.parentBoneId && bones.find((candidate) => candidate.id === bone.parentBoneId) ? bone.parentBoneId : undefined
      }));
      const boneIds = new Set(bones.map((bone) => bone.id));
      const rigPoseByFrame: ProjectData["rigPoseByFrame"] = {};
      for (const [frameKey, framePose] of Object.entries(state.project.rigPoseByFrame)) {
        const filtered: Record<string, BonePose> = {};
        for (const [boneId, pose] of Object.entries(framePose)) {
          if (boneIds.has(boneId)) filtered[boneId] = pose;
        }
        rigPoseByFrame[frameKey] = filtered;
      }
      const rig = { ...state.project.rig, joints, bones };
      return pushHistory(
        {
          ...state,
          selectedRigJointId: selectedJointId,
          selectedRigBoneId: selectedBoneId,
          selectedSegmentId: state.selectedSegmentId && !segments.find((segment) => segment.id === state.selectedSegmentId) ? null : state.selectedSegmentId,
          rigChainJointId
        },
        { ...state.project, rig, rigPoseByFrame, segments }
      );
    }
    case "RIG_RENAME_BONE": {
      const bones = state.project.rig.bones.map((bone) =>
        bone.id === action.boneId ? { ...bone, name: action.name.trim() } : bone
      );
      return pushHistory(state, { ...state.project, rig: { ...state.project.rig, bones } });
    }
    case "RIG_CLEAR":
      return pushHistory(
        { ...state, selectedRigJointId: null, selectedRigBoneId: null, selectedSegmentId: null, rigChainJointId: null },
        { ...state.project, rig: createDefaultRigData(), rigPoseByFrame: {}, segments: [], boneMapping: createEmptyBoneMapping() }
      );
    case "RIG_APPLY_WAVE": {
      const targetBone = findWaveTargetBone(state, action.boneId ?? null);
      if (!targetBone) return state;
      const withSelected = { ...state, selectedRigBoneId: targetBone.id };
      return editorReducer(withSelected, {
        type: "APPLY_RIG_PRESET",
        presetId: "wave",
        frameCount: Math.max(8, state.project.frames.length),
        overwrite: true
      });
    }
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
      const brushSize = clamp(Math.round(action.brushSizeOverride ?? state.brushSize), 1, 16);
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
          ? expandPointsForBrush([action.point], brushSize)
          : [action.point];
      const pixels = applyPoints(editablePixels, points, state.project.gridWidth, state.project.gridHeight, color);
      return updateActiveFramePixels(state, pixels, shouldPush);
    }
    case "APPLY_TOOL_DRAG": {
      const frame = state.project.frames[state.activeFrameIndex];
      const editablePixels = getEditablePixels(frame);
      const color = state.activeTool === "eraser" ? 0 : hexToPacked(state.activeColorHex);
      const brushSize = clamp(Math.round(action.brushSizeOverride ?? state.brushSize), 1, 16);
      const shouldPush = action.pushHistory !== false;
      let points: Point[] = [];
      if (state.activeTool === "line") points = linePoints(action.start, action.end);
      if (state.activeTool === "rect") points = rectPoints(action.start, action.end);
      if (state.activeTool === "circle") points = circlePoints(action.start, action.end);
      if (state.activeTool === "pencil" || state.activeTool === "eraser") points = linePoints(action.start, action.end);
      if (state.activeTool === "pencil" || state.activeTool === "eraser") {
        points = expandPointsForBrush(points, brushSize);
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
