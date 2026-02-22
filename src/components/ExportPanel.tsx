import { useRef } from "react";
import { exportGif, exportFrameImage } from "../export/imageExport";
import { exportProjectJson, importProjectJson, loadProjectsFromStore, saveProjectToStore } from "../state/storage";
import type { EditorState } from "../types/models";
import type { EditorAction } from "../state/editorReducer";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportPanel({ state, dispatch }: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeFrame = state.project.frames[state.activeFrameIndex];

  const exportImage = (format: "png" | "jpeg"): void => {
    const url = exportFrameImage(
      activeFrame,
      state.project.gridWidth,
      state.project.gridHeight,
      state.project.exportScale,
      format,
      {
        rig: state.project.rig,
        rigPoseByFrame: state.project.rigPoseByFrame,
        includeOverlay: state.project.rig.includeOverlayInExport
      },
      state.activeFrameIndex
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.project.name || "spritesmith"}.${format === "png" ? "png" : "jpg"}`;
    a.click();
  };

  const exportAnimatedGif = async (): Promise<void> => {
    const blob = await exportGif(
      state.project.frames,
      state.project.gridWidth,
      state.project.gridHeight,
      state.project.exportScale,
      state.globalFpsOverrideEnabled,
      state.globalFps,
      {
        rig: state.project.rig,
        rigPoseByFrame: state.project.rigPoseByFrame,
        includeOverlay: state.project.rig.includeOverlayInExport
      }
    );
    downloadBlob(blob, `${state.project.name || "spritesmith"}.gif`);
  };

  return (
    <section className="panel">
      <h3>Project + Export</h3>
      <label>
        Project Name
        <input value={state.project.name} onChange={(e) => dispatch({ type: "SET_PROJECT_NAME", name: e.target.value })} />
      </label>
      <div className="inline-buttons">
        <button onClick={() => saveProjectToStore(state.project)}>Save Local</button>
        <button onClick={() => { const projects = loadProjectsFromStore(); const chosen = projects.find((project) => project.name === state.project.name) ?? projects[0]; if (chosen) dispatch({ type: "LOAD_PROJECT", project: chosen }); }}>Load Local</button>
      </div>
      <div className="inline-buttons">
        <button onClick={() => downloadBlob(exportProjectJson(state.project), `${state.project.name || "project"}.json`)}>Export JSON</button>
        <button onClick={() => inputRef.current?.click()}>Import JSON</button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const project = await importProjectJson(file);
            dispatch({ type: "LOAD_PROJECT", project });
          }}
        />
      </div>
      <label>
        Export Scale
        <select value={state.project.exportScale} onChange={(e) => dispatch({ type: "SET_EXPORT_SCALE", scale: Number(e.target.value) as 1 | 2 | 4 | 8 })}>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
          <option value={8}>8x</option>
        </select>
      </label>
      <div className="inline-buttons">
        <button onClick={() => exportImage("png")}>Export PNG</button>
        <button onClick={() => exportImage("jpeg")}>Export JPEG</button>
        <button onClick={exportAnimatedGif}>Export GIF</button>
      </div>
    </section>
  );
}
