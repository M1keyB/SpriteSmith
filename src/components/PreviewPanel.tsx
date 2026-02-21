import { useEffect, useMemo, useRef } from "react";
import { getCompositePixels } from "../editor/layers";
import { drawPixels } from "../editor/render";
import type { EditorState } from "../types/models";
import type { EditorAction } from "../state/editorReducer";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export function PreviewPanel({ state, dispatch }: Props): JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null);

  const frameDelayMs = useMemo(() => {
    const frame = state.project.frames[state.activeFrameIndex] ?? state.project.frames[0];
    return state.globalFpsOverrideEnabled ? Math.round(1000 / state.globalFps) : frame.durationMs;
  }, [state.activeFrameIndex, state.globalFps, state.globalFpsOverrideEnabled, state.project.frames]);

  useEffect(() => {
    if (!state.isPlaying) return;
    const timer = window.setTimeout(() => {
      const next = state.activeFrameIndex + 1;
      if (next >= state.project.frames.length) {
        if (state.loopPreview) {
          dispatch({ type: "SET_ACTIVE_FRAME", frameIndex: 0 });
        } else {
          dispatch({ type: "SET_PLAYING", value: false });
        }
        return;
      }
      dispatch({ type: "SET_ACTIVE_FRAME", frameIndex: next });
    }, frameDelayMs);
    return () => window.clearTimeout(timer);
  }, [
    dispatch,
    frameDelayMs,
    state.activeFrameIndex,
    state.isPlaying,
    state.loopPreview,
    state.project.frames.length
  ]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = 220;
    canvas.height = 220;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const frame = state.project.frames[state.activeFrameIndex];
    if (!frame) return;
    const scale = Math.max(1, Math.floor(200 / Math.max(state.project.gridWidth, state.project.gridHeight)));
    const offsetX = Math.floor((220 - state.project.gridWidth * scale) / 2);
    const offsetY = Math.floor((220 - state.project.gridHeight * scale) / 2);
    drawPixels(
      ctx,
      getCompositePixels(frame, state.project.gridWidth, state.project.gridHeight),
      state.project.gridWidth,
      state.project.gridHeight,
      scale,
      offsetX,
      offsetY,
      1
    );
  }, [state]);

  return (
    <section className="panel">
      <h3>Preview</h3>
      <canvas ref={ref} className="preview-canvas" />
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
        <label><input type="checkbox" checked={state.loopPreview} onChange={(e) => dispatch({ type: "SET_LOOP", value: e.target.checked })} />Loop</label>
      </div>
      <label><input type="checkbox" checked={state.globalFpsOverrideEnabled} onChange={(e) => dispatch({ type: "SET_GLOBAL_FPS_OVERRIDE", value: e.target.checked })} />Global FPS</label>
      <input type="number" min={1} max={60} value={state.globalFps} onChange={(e) => dispatch({ type: "SET_GLOBAL_FPS", value: Number(e.target.value) })} />
    </section>
  );
}
