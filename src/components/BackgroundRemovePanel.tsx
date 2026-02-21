import { useState } from "react";
import { packedToRgba, rgbaToHex } from "../editor/color";
import { getEditablePixels } from "../editor/layers";
import type { EditorAction } from "../state/editorReducer";
import type { EditorState } from "../types/models";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export function BackgroundRemovePanel({ state, dispatch }: Props): JSX.Element {
  const [tolerance, setTolerance] = useState(64);
  const [connectedOnly, setConnectedOnly] = useState(true);
  const [scope, setScope] = useState<"active" | "all">("active");

  return (
    <section className="panel">
      <h3>Background Remover</h3>
      <small>Safer mode: edge-connected removal + border color pick to avoid deleting subject pixels.</small>
      <button
        onClick={() => {
          const frame = state.project.frames[state.activeFrameIndex];
          const pixels = getEditablePixels(frame);
          const w = state.project.gridWidth;
          const h = state.project.gridHeight;
          const counts = new Map<number, number>();

          const add = (idx: number): void => {
            const packed = pixels[idx] ?? 0;
            if ((packed & 255) === 0) return;
            counts.set(packed, (counts.get(packed) ?? 0) + 1);
          };

          for (let x = 0; x < w; x += 1) {
            add(x);
            add((h - 1) * w + x);
          }
          for (let y = 0; y < h; y += 1) {
            add(y * w);
            add(y * w + (w - 1));
          }

          if (counts.size === 0) return;
          let bestPacked = 0;
          let bestCount = -1;
          for (const [packed, count] of counts.entries()) {
            if (count > bestCount) {
              bestPacked = packed;
              bestCount = count;
            }
          }

          const [r, g, b] = packedToRgba(bestPacked);
          dispatch({ type: "SET_ACTIVE_COLOR", hex: rgbaToHex(r, g, b) });
        }}
      >
        Auto Pick Border Color
      </button>
      <label>
        Tolerance ({tolerance})
        <input
          type="range"
          min={0}
          max={441}
          value={tolerance}
          onChange={(e) => setTolerance(Number(e.target.value))}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={connectedOnly}
          onChange={(e) => setConnectedOnly(e.target.checked)}
        />
        Connected Only (edge-connected background)
      </label>
      <label>
        Scope
        <select value={scope} onChange={(e) => setScope(e.target.value as "active" | "all")}>
          <option value="active">Active Frame</option>
          <option value="all">All Frames</option>
        </select>
      </label>
      <button
        onClick={() =>
          dispatch({
            type: scope === "active" ? "REMOVE_BG_ACTIVE" : "REMOVE_BG_ALL",
            tolerance,
            connectedOnly
          })
        }
      >
        Remove Background
      </button>
    </section>
  );
}
