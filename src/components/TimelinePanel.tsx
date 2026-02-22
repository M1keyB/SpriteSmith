import { useEffect, useRef } from "react";
import { useState } from "react";
import { getCompositePixels } from "../editor/layers";
import { drawPixels } from "../editor/render";
import type { EditorState, Frame } from "../types/models";
import type { EditorAction } from "../state/editorReducer";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  collapsed: boolean;
  height: number;
  onToggleCollapse: () => void;
  onResizeStart: (startY: number) => void;
}

function FrameThumb({ frame, width, height }: { frame: Frame; width: number; height: number }): JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, 64, 64);
    const scale = Math.max(1, Math.floor(60 / Math.max(width, height)));
    drawPixels(ctx, getCompositePixels(frame, width, height), width, height, scale, 2, 2, 1);
  }, [frame, height, width]);

  return <canvas ref={ref} className="thumb" />;
}

export function TimelinePanel({
  state,
  dispatch,
  collapsed,
  height,
  onToggleCollapse,
  onResizeStart
}: Props): JSX.Element {
  const [dragFrameIndex, setDragFrameIndex] = useState<number | null>(null);

  return (
    <section
      className={`panel timeline-dock ${collapsed ? "collapsed" : ""}`}
      style={{ height: collapsed ? undefined : `${height}px` }}
    >
      <div
        className="timeline-resize-handle"
        onPointerDown={(event) => {
          event.preventDefault();
          onResizeStart(event.clientY);
        }}
      />
      <div className="timeline-dock-header">
        <h3>Timeline</h3>
        <div className="inline-buttons">
          <span className="timeline-meta">
            {state.activeFrameIndex + 1} / {state.project.frames.length}
          </span>
          <button onClick={onToggleCollapse}>{collapsed ? "Expand" : "Collapse"}</button>
        </div>
      </div>

      {!collapsed && (
        <div className="timeline-dock-body">
          <div className="timeline-controls">
            <div className="frame-actions">
              <button onClick={() => dispatch({ type: "ADD_FRAME" })}>Add</button>
              <button onClick={() => dispatch({ type: "DUPLICATE_FRAME", frameIndex: state.activeFrameIndex })}>Duplicate</button>
              <button onClick={() => dispatch({ type: "DELETE_FRAME", frameIndex: state.activeFrameIndex })}>Delete</button>
            </div>
            <div className="inline-buttons">
              <button
                onClick={() => {
                  if (!state.isPlaying && !state.loopPreview && state.activeFrameIndex >= state.project.frames.length - 1) {
                    dispatch({ type: "SET_ACTIVE_FRAME", frameIndex: 0 });
                  }
                  dispatch({ type: "SET_PLAYING", value: !state.isPlaying });
                }}
              >
                {state.isPlaying ? "Stop" : "Play"}
              </button>
              <label className="inline-check">
                <input type="checkbox" checked={state.loopPreview} onChange={(e) => dispatch({ type: "SET_LOOP", value: e.target.checked })} />
                Loop
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={state.globalFpsOverrideEnabled}
                  onChange={(e) => dispatch({ type: "SET_GLOBAL_FPS_OVERRIDE", value: e.target.checked })}
                />
                Global FPS
              </label>
              <label className="inline-fps">
                FPS
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={state.globalFps}
                  onChange={(e) => dispatch({ type: "SET_GLOBAL_FPS", value: Number(e.target.value) })}
                />
              </label>
            </div>
            <div className="timeline-onion">
              <label className="inline-check">
                <input type="checkbox" checked={state.onionSkin.showPrev} onChange={(e) => dispatch({ type: "SET_ONION_PREV", value: e.target.checked })} />
                Show Previous
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(state.onionSkin.opacityPrev * 100)}
                onChange={(e) => dispatch({ type: "SET_ONION_PREV_OPACITY", value: Number(e.target.value) / 100 })}
              />
              <label className="inline-check">
                <input type="checkbox" checked={state.onionSkin.showNext} onChange={(e) => dispatch({ type: "SET_ONION_NEXT", value: e.target.checked })} />
                Show Next
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(state.onionSkin.opacityNext * 100)}
                onChange={(e) => dispatch({ type: "SET_ONION_NEXT_OPACITY", value: Number(e.target.value) / 100 })}
              />
            </div>
          </div>

          <div className="frame-list">
            {state.project.frames.map((frame, index) => (
              <div
                key={frame.id}
                className={`frame-item ${index === state.activeFrameIndex ? "active" : ""}`}
                draggable
                onDragStart={() => setDragFrameIndex(index)}
                onDragEnd={() => setDragFrameIndex(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragFrameIndex === null || dragFrameIndex === index) return;
                  dispatch({ type: "REORDER_FRAMES", from: dragFrameIndex, to: index });
                  setDragFrameIndex(null);
                }}
                onClick={() => dispatch({ type: "SET_ACTIVE_FRAME", frameIndex: index })}
              >
                <FrameThumb frame={frame} width={state.project.gridWidth} height={state.project.gridHeight} />
                <div className="frame-meta">
                  <strong>#{index + 1}</strong>
                  <label>
                    Duration
                    <input
                      type="number"
                      min={16}
                      max={5000}
                      value={frame.durationMs}
                      onChange={(e) => dispatch({ type: "SET_FRAME_DURATION", frameIndex: index, durationMs: Number(e.target.value) })}
                    />
                  </label>
                  <div className="inline-buttons">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: "REORDER_FRAMES", from: index, to: Math.max(0, index - 1) });
                      }}
                    >
                      Left
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: "REORDER_FRAMES", from: index, to: Math.min(state.project.frames.length - 1, index + 1) });
                      }}
                    >
                      Right
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
