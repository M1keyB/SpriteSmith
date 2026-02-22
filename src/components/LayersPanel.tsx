import type { EditorAction } from "../state/editorReducer";
import type { EditorState } from "../types/models";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

function IconPlus(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconCopy(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="8" width="10" height="10" rx="2" />
      <rect x="5" y="4" width="10" height="10" rx="2" />
    </svg>
  );
}

function IconTrash(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12M10 10v6M14 10v6" />
    </svg>
  );
}

function IconMergeDown(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="8" height="5" rx="1" />
      <rect x="12" y="15" width="8" height="5" rx="1" />
      <path d="M12 9v5m0 0-2-2m2 2 2-2" />
    </svg>
  );
}

function IconFlatten(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8h14M6 12h12M7 16h10" />
      <rect x="4" y="5" width="16" height="14" rx="2" />
    </svg>
  );
}

function IconEyeOpen(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeClosed(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M4 12s3.5-6 8-6c2 0 3.7.6 5.2 1.5M20 12s-3.5 6-8 6c-2 0-3.7-.6-5.2-1.5" />
    </svg>
  );
}

function IconArrowUp(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 14 5-5 5 5" />
    </svg>
  );
}

function IconArrowDown(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

export function LayersPanel({ state, dispatch }: Props): JSX.Element {
  const frame = state.project.frames[state.activeFrameIndex];
  const activeLayer = frame.layers.find((layer) => layer.id === frame.activeLayerId) ?? frame.layers[frame.layers.length - 1];
  const displayLayers = frame.layers.slice().reverse();
  const activeLayerIndex = activeLayer ? frame.layers.findIndex((layer) => layer.id === activeLayer.id) : -1;

  return (
    <section className="panel layersPanel">
      <h3>Layers</h3>

      <div className="layersToolbar">
        <button className="iconBtn" title="Add Layer" aria-label="Add Layer" onClick={() => dispatch({ type: "ADD_LAYER" })}>
          <IconPlus />
        </button>
        <button
          className="iconBtn"
          title="Duplicate Layer"
          aria-label="Duplicate Layer"
          onClick={() => dispatch({ type: "DUPLICATE_LAYER" })}
          disabled={!activeLayer}
        >
          <IconCopy />
        </button>
        <button
          className="iconBtn"
          title="Delete Layer"
          aria-label="Delete Layer"
          onClick={() => dispatch({ type: "DELETE_LAYER" })}
          disabled={frame.layers.length <= 1}
        >
          <IconTrash />
        </button>
        <button
          className="iconBtn"
          title="Merge Down"
          aria-label="Merge Down"
          onClick={() => dispatch({ type: "MERGE_LAYER_DOWN" })}
          disabled={!activeLayer || activeLayerIndex <= 0}
        >
          <IconMergeDown />
        </button>
        <button
          className="iconBtn"
          title="Flatten"
          aria-label="Flatten"
          onClick={() => dispatch({ type: "FLATTEN_LAYERS" })}
          disabled={frame.layers.length <= 1}
        >
          <IconFlatten />
        </button>
      </div>

      <div className="layerList">
        {displayLayers.map((layer) => {
          const actualIndex = frame.layers.findIndex((candidate) => candidate.id === layer.id);
          const isActive = layer.id === frame.activeLayerId;
          return (
            <div
              key={layer.id}
              className={`layerRow ${isActive ? "layerRowActive" : ""}`}
              onClick={() => dispatch({ type: "SET_ACTIVE_LAYER", layerId: layer.id })}
            >
              <button
                className="iconBtn layerVisBtn"
                title={layer.visible ? "Hide Layer" : "Show Layer"}
                aria-label={layer.visible ? "Hide Layer" : "Show Layer"}
                onClick={(event) => {
                  event.stopPropagation();
                  dispatch({ type: "SET_LAYER_VISIBLE", layerId: layer.id, visible: !layer.visible });
                }}
              >
                {layer.visible ? <IconEyeOpen /> : <IconEyeClosed />}
              </button>

              <input
                className="layerName"
                value={layer.name}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => dispatch({ type: "RENAME_LAYER", layerId: layer.id, name: event.target.value })}
              />

              <span className="layerOpacityText">{Math.round(layer.opacity * 100)}%</span>

              <div className="layerRowRightActions" onClick={(event) => event.stopPropagation()}>
                <button
                  className="iconBtn iconBtnSm"
                  title="Move Layer Up"
                  aria-label="Move Layer Up"
                  onClick={() => dispatch({ type: "MOVE_LAYER", layerId: layer.id, direction: "up" })}
                  disabled={actualIndex >= frame.layers.length - 1}
                >
                  <IconArrowUp />
                </button>
                <button
                  className="iconBtn iconBtnSm"
                  title="Move Layer Down"
                  aria-label="Move Layer Down"
                  onClick={() => dispatch({ type: "MOVE_LAYER", layerId: layer.id, direction: "down" })}
                  disabled={actualIndex <= 0}
                >
                  <IconArrowDown />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activeLayer && (
        <div className="layerSettings">
          <h4>Layer Settings</h4>
          <label>
            Opacity
            <div className="layerSettingsOpacity">
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(activeLayer.opacity * 100)}
                onChange={(event) =>
                  dispatch({ type: "SET_LAYER_OPACITY", layerId: activeLayer.id, opacity: Number(event.target.value) / 100 })
                }
              />
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(activeLayer.opacity * 100)}
                onChange={(event) =>
                  dispatch({ type: "SET_LAYER_OPACITY", layerId: activeLayer.id, opacity: Number(event.target.value) / 100 })
                }
              />
            </div>
          </label>
        </div>
      )}
    </section>
  );
}
