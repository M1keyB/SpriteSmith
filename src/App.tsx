import { useEffect, useReducer } from "react";
import { BackgroundRemovePanel } from "./components/BackgroundRemovePanel";
import { CanvasStage } from "./components/CanvasStage";
import { AnvilIcon } from "./components/AnvilIcon";
import { ColorPickerPanel } from "./components/ColorPickerPanel";
import { ExportPanel } from "./components/ExportPanel";
import { PalettePanel } from "./components/PalettePanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { ReferencePanel } from "./components/ReferencePanel";
import { SpriteGeneratorPanel } from "./components/SpriteGeneratorPanel";
import { TimelinePanel } from "./components/TimelinePanel";
import { ToolPanel } from "./components/ToolPanel";
import { GRID_SIZES } from "./editor/constants";
import { resizePixels } from "./editor/render";
import { editorReducer, initialEditorState } from "./state/editorReducer";
import { autoSaveProject } from "./state/storage";
import { useKeyboardShortcuts } from "./state/useKeyboardShortcuts";

function App(): JSX.Element {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);

  useKeyboardShortcuts(dispatch, state);

  useEffect(() => {
    autoSaveProject(state.project);
  }, [state.project]);

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
            <div className="grid-size-row">
              <span>Grid:</span>
              {GRID_SIZES.map((size) => (
                <button
                  key={size}
                  className={size === state.project.gridWidth ? "active" : ""}
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
            </div>
            <CanvasStage state={state} dispatch={dispatch} />
          </section>

          <aside className="right">
            <TimelinePanel state={state} dispatch={dispatch} />
            <PreviewPanel state={state} dispatch={dispatch} />
            <ExportPanel state={state} dispatch={dispatch} />
          </aside>
        </main>
      )}
    </div>
  );
}

export default App;
