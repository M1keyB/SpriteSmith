import { useMemo, useState } from "react";
import { createId } from "../editor/id";
import { loadPalettesFromStore, savePaletteToStore } from "../state/storage";

interface Props {
  colors: string[];
  activeColor: string;
  onColorSelect: (hex: string) => void;
  onAddColor: (hex: string) => void;
  onRemoveColor: (index: number) => void;
  onReorderColor: (from: number, to: number) => void;
  onLoadPalette: (colors: string[]) => void;
}

export function PalettePanel({ colors, activeColor, onColorSelect, onAddColor, onRemoveColor, onReorderColor, onLoadPalette }: Props): JSX.Element {
  const [paletteName, setPaletteName] = useState("My Palette");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const savedPalettes = useMemo(() => loadPalettesFromStore(), [colors.length]);

  return (
    <section className="panel">
      <h3>Palette</h3>
      <div className="palette-grid">
        {colors.map((color, index) => (
          <div key={`${color}-${index}`} className="palette-row">
            <button
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex === null || dragIndex === index) return;
                onReorderColor(dragIndex, index);
                setDragIndex(null);
              }}
              className={`swatch ${activeColor.toLowerCase() === color.toLowerCase() ? "active" : ""}`}
              style={{ background: color }}
              onClick={() => onColorSelect(color)}
              title={color}
            />
            <button onClick={() => onReorderColor(index, Math.max(0, index - 1))}>Up</button>
            <button onClick={() => onReorderColor(index, Math.min(colors.length - 1, index + 1))}>Down</button>
            <button onClick={() => onRemoveColor(index)}>x</button>
          </div>
        ))}
      </div>
      <button onClick={() => onAddColor(activeColor)}>Add Current</button>
      <label>
        Palette Name
        <input value={paletteName} onChange={(e) => setPaletteName(e.target.value)} />
      </label>
      <button onClick={() => savePaletteToStore({ id: createId(), name: paletteName || "Palette", colors })}>Save Palette</button>
      <div className="saved-list">
        {savedPalettes.map((palette) => (
          <button key={palette.id} onClick={() => onLoadPalette(palette.colors)}>Load: {palette.name}</button>
        ))}
      </div>
    </section>
  );
}
