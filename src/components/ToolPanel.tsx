import type { Tool } from "../types/models";

interface Props {
  editorMode: "pixels" | "bones";
  onEditorModeChange: (mode: "pixels" | "bones") => void;
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  showGrid: boolean;
  showChecker: boolean;
  onToggleGrid: () => void;
  onToggleChecker: () => void;
  zoom: number;
  onZoom: (zoom: number) => void;
}

const toolOptions: Array<{ id: Tool; label: string; key: string; group: "Draw" | "Shapes" | "Edit" }> = [
  { id: "pencil", label: "Pencil", key: "B", group: "Draw" },
  { id: "eraser", label: "Eraser", key: "E", group: "Draw" },
  { id: "fill", label: "Fill", key: "G", group: "Draw" },
  { id: "picker", label: "Picker", key: "I", group: "Draw" },
  { id: "line", label: "Line", key: "", group: "Shapes" },
  { id: "rect", label: "Rectangle", key: "", group: "Shapes" },
  { id: "circle", label: "Circle", key: "", group: "Shapes" },
  { id: "select", label: "Select (Lasso)", key: "M", group: "Edit" },
  { id: "manual-remove", label: "Manual Remove (Lasso)", key: "", group: "Edit" },
  { id: "auto-remove", label: "Auto Remove (Click)", key: "V", group: "Edit" },
  { id: "grab", label: "Grab (Move Image)", key: "H", group: "Edit" },
  { id: "rotate", label: "Rotate", key: "R", group: "Edit" }
];

export function ToolPanel({
  editorMode,
  onEditorModeChange,
  activeTool,
  onToolChange,
  brushSize,
  onBrushSizeChange,
  showGrid,
  showChecker,
  onToggleGrid,
  onToggleChecker,
  zoom,
  onZoom
}: Props): JSX.Element {
  const grouped = {
    Draw: toolOptions.filter((tool) => tool.group === "Draw"),
    Shapes: toolOptions.filter((tool) => tool.group === "Shapes"),
    Edit: toolOptions.filter((tool) => tool.group === "Edit")
  };

  return (
    <section className="panel">
      <h3>Tools</h3>
      <div className="inline-buttons">
        <button className={editorMode === "pixels" ? "active" : ""} onClick={() => onEditorModeChange("pixels")}>
          Pixels
        </button>
        <button className={editorMode === "bones" ? "active" : ""} onClick={() => onEditorModeChange("bones")}>
          Bones
        </button>
      </div>
      <label>
        Tool
        <select
          className="tool-select"
          value={activeTool}
          onChange={(e) => onToolChange(e.target.value as Tool)}
          disabled={editorMode === "bones"}
        >
          <optgroup label="Draw">
            {grouped.Draw.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.label} {tool.key ? `(${tool.key})` : ""}
              </option>
            ))}
          </optgroup>
          <optgroup label="Shapes">
            {grouped.Shapes.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Edit">
            {grouped.Edit.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.label} {tool.key ? `(${tool.key})` : ""}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label>
        Brush Size ({brushSize})
        <input
          type="range"
          min={1}
          max={16}
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          disabled={editorMode === "bones"}
        />
      </label>
      <label>
        Zoom
        <input type="range" min={4} max={80} value={zoom} onChange={(e) => onZoom(Number(e.target.value))} />
      </label>
      <div className="toggles">
        <label><input type="checkbox" checked={showGrid} onChange={onToggleGrid} /> Grid</label>
        <label><input type="checkbox" checked={showChecker} onChange={onToggleChecker} /> Checker</label>
      </div>
    </section>
  );
}
