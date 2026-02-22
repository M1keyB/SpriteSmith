import { useEffect, useReducer, useState } from "react";
import { BackgroundRemovePanel } from "./components/BackgroundRemovePanel";
import { CanvasStage } from "./components/CanvasStage";
import { AnvilIcon } from "./components/AnvilIcon";
import { ColorPickerPanel } from "./components/ColorPickerPanel";
import { ExportPanel } from "./components/ExportPanel";
import { LayersPanel } from "./components/LayersPanel";
import { PalettePanel } from "./components/PalettePanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { ReferencePanel } from "./components/ReferencePanel";
import { RigPanel } from "./components/RigPanel";
import { SpriteGeneratorPanel } from "./components/SpriteGeneratorPanel";
import { TimelinePanel } from "./components/TimelinePanel";
import { ToolPanel } from "./components/ToolPanel";
import { GRID_SIZES } from "./editor/constants";
import { resizePixels } from "./editor/render";
import { editorReducer, initialEditorState } from "./state/editorReducer";
import { autoSaveProject } from "./state/storage";
import { useKeyboardShortcuts } from "./state/useKeyboardShortcuts";

const TIMELINE_MIN_HEIGHT = 80;
const TIMELINE_MAX_HEIGHT = 280;
const TIMELINE_DEFAULT_HEIGHT = 170;
const TIMELINE_HEIGHT_KEY = "timelineHeight";
const TIMELINE_COLLAPSED_KEY = "timelineCollapsed";

function clampTimelineHeight(value: number): number {
  return Math.min(TIMELINE_MAX_HEIGHT, Math.max(TIMELINE_MIN_HEIGHT, value));
}

function App(): JSX.Element {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const [timelineHeight, setTimelineHeight] = useState<number>(() => {
    const saved = window.localStorage.getItem(TIMELINE_HEIGHT_KEY);
    const parsed = saved ? Number(saved) : Number.NaN;
    return Number.isFinite(parsed) ? clampTimelineHeight(parsed) : TIMELINE_DEFAULT_HEIGHT;
  });
  const [timelineCollapsed, setTimelineCollapsed] = useState<boolean>(() => {
    const saved = window.localStorage.getItem(TIMELINE_COLLAPSED_KEY);
    if (saved === "true") return true;
    if (saved === "false") return false;
    return window.innerWidth <= 1100;
  });

  useKeyboardShortcuts(dispatch, state);

  useEffect(() => {
    autoSaveProject(state.project);
  }, [state.project]);

  useEffect(() => {
    window.localStorage.setItem(TIMELINE_HEIGHT_KEY, String(clampTimelineHeight(timelineHeight)));
  }, [timelineHeight]);

  useEffect(() => {
    window.localStorage.setItem(TIMELINE_COLLAPSED_KEY, String(timelineCollapsed));
  }, [timelineCollapsed]);

  const startTimelineResize = (startY: number): void => {
    if (timelineCollapsed) {
      setTimelineCollapsed(false);
    }
    const startHeight = timelineHeight;
    const onPointerMove = (event: PointerEvent): void => {
      const delta = startY - event.clientY;
      setTimelineHeight(clampTimelineHeight(startHeight + delta));
    };
    const onPointerUp = (): void => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1 className="brand"><span>SpriteSmith</span><AnvilIcon /></h1>
        <div className="tabs">
          <button className={state.tab === "editor" ? "active" : ""} onClick={() => dispatch({ type: "SET_TAB", tab: "editor" })}>Editor</button>
          <button className={state.tab === "sprite" ? "active" : ""} onClick={() => dispatch({ type: "SET_TAB", tab: "sprite" })}>Sprite Generator</button>
        </div>
      </header>

      {state.tab === "sprite" ? (
        <SpriteGeneratorPanel
          onCommitFrame={(pixels, size) => {
            const fitted = resizePixels(pixels, size, size, state.project.gridWidth, state.project.gridHeight, "scale");
            dispatch({ type: "ADD_FRAME" });
            dispatch({ type: "UPDATE_FRAME_PIXELS", frameIndex: state.project.frames.length, pixels: fitted, pushHistory: true });
            dispatch({ type: "SET_TAB", tab: "editor" });
          }}
        />
      ) : (
        <main className="layout">
          <aside className="left">
            <ToolPanel
              editorMode={state.editorMode}
              onEditorModeChange={(mode) => dispatch({ type: "SET_EDITOR_MODE", mode })}
              activeTool={state.activeTool}
              onToolChange={(tool) => dispatch({ type: "SET_TOOL", tool })}
              brushSize={state.brushSize}
              onBrushSizeChange={(size) => dispatch({ type: "SET_BRUSH_SIZE", size })}
              showGrid={state.showGrid}
              showChecker={state.showChecker}
              onToggleGrid={() => dispatch({ type: "TOGGLE_GRID" })}
              onToggleChecker={() => dispatch({ type: "TOGGLE_CHECKER" })}
              zoom={state.zoom}
              onZoom={(zoom) => dispatch({ type: "SET_ZOOM", zoom })}
            />
            <ReferencePanel state={state} dispatch={dispatch} />
            <BackgroundRemovePanel state={state} dispatch={dispatch} />
            <ColorPickerPanel value={state.activeColorHex} onChange={(hex) => dispatch({ type: "SET_ACTIVE_COLOR", hex })} />
            <PalettePanel
              colors={state.project.palette}
              activeColor={state.activeColorHex}
              onColorSelect={(hex) => dispatch({ type: "SET_ACTIVE_COLOR", hex })}
              onAddColor={(hex) => dispatch({ type: "ADD_PALETTE_COLOR", color: hex })}
              onRemoveColor={(index) => dispatch({ type: "REMOVE_PALETTE_COLOR", index })}
              onReorderColor={(from, to) => dispatch({ type: "REORDER_PALETTE_COLOR", from, to })}
              onLoadPalette={(palette) => dispatch({ type: "SET_PALETTE", palette })}
            />
          </aside>

          <section className="center">
            <section className="canvas-area">
              <CanvasStage
                state={state}
                dispatch={dispatch}
                canvasGroup={
                  <>
                    <span>Grid:</span>
                    {GRID_SIZES.map((size) => (
                      <button
                        key={size}
                        className={`toolbarBtn ${size === state.project.gridWidth ? "active" : ""}`}
                        onClick={() => {
                          if (size === state.project.gridWidth) return;
                          const choice = window.prompt("Resize mode: type scale, crop, or clear", "scale") as "scale" | "crop" | "clear" | null;
                          if (!choice || !["scale", "crop", "clear"].includes(choice)) return;
                          dispatch({ type: "SET_GRID_SIZE", width: size, height: size, mode: choice });
                        }}
                      >
                        {size}x{size}
                      </button>
                    ))}
                  </>
                }
              />
            </section>

            <TimelinePanel
              state={state}
              dispatch={dispatch}
              collapsed={timelineCollapsed}
              height={timelineHeight}
              onToggleCollapse={() => setTimelineCollapsed((current) => !current)}
              onResizeStart={startTimelineResize}
            />
          </section>

          <aside className="right">
            {state.editorMode === "bones" ? (
              <RigPanel state={state} dispatch={dispatch} />
            ) : (
              <LayersPanel state={state} dispatch={dispatch} />
            )}
            <PreviewPanel state={state} dispatch={dispatch} />
            <ExportPanel state={state} dispatch={dispatch} />
          </aside>
        </main>
      )}
    </div>
  );
}

export default App;
