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
