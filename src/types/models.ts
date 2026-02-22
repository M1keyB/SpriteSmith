export type Tool =
  | "pencil"
  | "eraser"
  | "fill"
  | "picker"
  | "line"
  | "rect"
  | "circle"
  | "select"
  | "rotate"
  | "manual-remove"
  | "auto-remove"
  | "grab";

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  pixels: number[];
}

export interface Frame {
  id: string;
  layers: Layer[];
  activeLayerId: string;
  durationMs: number;
}

export interface StoredPalette {
  id: string;
  name: string;
  colors: string[];
}

export interface ProjectData {
  name: string;
  gridWidth: number;
  gridHeight: number;
  frames: Frame[];
  palette: string[];
  exportScale: 1 | 2 | 4 | 8;
  rig: RigData;
  rigPoseByFrame: Record<string, Record<string, BonePose>>;
  segments: Segment[];
  boneMapping: BoneMapping;
}

export interface OnionSkin {
  showPrev: boolean;
  showNext: boolean;
  opacityPrev: number;
  opacityNext: number;
}

export interface ReferenceImage {
  dataUrl: string;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  scale: number;
  x: number;
  y: number;
}

export interface EditorState {
  project: ProjectData;
  editorMode: "pixels" | "bones";
  activeFrameIndex: number;
  activeTool: Tool;
  brushSize: number;
  activeColorHex: string;
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  showChecker: boolean;
  onionSkin: OnionSkin;
  globalFpsOverrideEnabled: boolean;
  globalFps: number;
  isPlaying: boolean;
  loopPreview: boolean;
  tab: "editor" | "sprite";
  selectedRigJointId: string | null;
  selectedRigBoneId: string | null;
  rigChainJointId: string | null;
  selectedSegmentId: string | null;
  segmentSelection: RectSelection | null;
  segmentSelectionMode: boolean;
  referenceImage: ReferenceImage | null;
  undoStack: ProjectData[];
  redoStack: ProjectData[];
}

export interface Point {
  x: number;
  y: number;
}

export interface SpriteGeneratorParams {
  size: 8 | 16 | 32;
  seed: number;
  bodyType: number;
  headSize: number;
  primaryColor: string;
  secondaryColor: string;
  accessoryHat: boolean;
  accessoryBelt: boolean;
  symmetry: boolean;
}

export interface RigJoint {
  id: string;
  x: number;
  y: number;
  parentId?: string;
}

export interface RigBone {
  id: string;
  aJointId: string;
  bJointId: string;
  name?: string;
  length?: number;
  parentBoneId?: string;
}

export interface BonePose {
  rotDeg: number;
  dx?: number;
  dy?: number;
}

export interface RigData {
  joints: RigJoint[];
  bones: RigBone[];
  showOverlay: boolean;
  includeOverlayInExport: boolean;
}

export interface RectSelection {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Segment {
  id: string;
  boneId: string;
  frameIndex: number;
  w: number;
  h: number;
  pixels: string;
  anchor: { x: number; y: number };
  offset: { x: number; y: number };
  zIndex: number;
}

export type BoneRole =
  | "Hip"
  | "Spine"
  | "Head"
  | "LeftUpperLeg"
  | "LeftLowerLeg"
  | "RightUpperLeg"
  | "RightLowerLeg"
  | "LeftUpperArm"
  | "LeftLowerArm"
  | "RightUpperArm"
  | "RightLowerArm";

export type BoneMapping = Record<BoneRole, string | null>;
