import { useState } from "react";
import { generateSprite } from "../generator/spriteGenerator";
import type { SpriteGeneratorParams } from "../types/models";

interface Props {
  onCommitFrame: (pixels: number[], size: number) => void;
}

export function SpriteGeneratorPanel({ onCommitFrame }: Props): JSX.Element {
  const [params, setParams] = useState<SpriteGeneratorParams>({
    size: 16,
    seed: 42,
    bodyType: 0.5,
    headSize: 0.4,
    primaryColor: "#4ecdc4",
    secondaryColor: "#ffe66d",
    accessoryHat: true,
    accessoryBelt: false,
    symmetry: true
  });

  const pixels = generateSprite(params);

  return (
    <section className="sprite-panel">
      <h2>Sprite Generator (Phase 2 Stub)</h2>
      <p>Deterministic generator now, clean contract for future AI plugin later.</p>
      <div className="sprite-controls">
        <label>Size<select value={params.size} onChange={(e) => setParams({ ...params, size: Number(e.target.value) as 8 | 16 | 32 })}><option value={8}>8x8</option><option value={16}>16x16</option><option value={32}>32x32</option></select></label>
        <label>Seed<input type="number" value={params.seed} onChange={(e) => setParams({ ...params, seed: Number(e.target.value) })} /></label>
        <label>Body Type<input type="range" min={0} max={1} step={0.01} value={params.bodyType} onChange={(e) => setParams({ ...params, bodyType: Number(e.target.value) })} /></label>
        <label>Head Size<input type="range" min={0} max={1} step={0.01} value={params.headSize} onChange={(e) => setParams({ ...params, headSize: Number(e.target.value) })} /></label>
        <label>Primary<input type="color" value={params.primaryColor} onChange={(e) => setParams({ ...params, primaryColor: e.target.value })} /></label>
        <label>Secondary<input type="color" value={params.secondaryColor} onChange={(e) => setParams({ ...params, secondaryColor: e.target.value })} /></label>
        <label><input type="checkbox" checked={params.accessoryHat} onChange={(e) => setParams({ ...params, accessoryHat: e.target.checked })} />Hat</label>
        <label><input type="checkbox" checked={params.accessoryBelt} onChange={(e) => setParams({ ...params, accessoryBelt: e.target.checked })} />Belt</label>
        <label><input type="checkbox" checked={params.symmetry} onChange={(e) => setParams({ ...params, symmetry: e.target.checked })} />Symmetry</label>
      </div>
      <button onClick={() => onCommitFrame(pixels, params.size)}>Insert Into New Frame</button>
      <div className="sprite-mini-grid" style={{ gridTemplateColumns: `repeat(${params.size}, 8px)` }}>
        {pixels.map((color, idx) => (
          <span key={idx} style={{ background: color === 0 ? "transparent" : `#${((color >>> 8) & 0xffffff).toString(16).padStart(6, "0")}` }} />
        ))}
      </div>
    </section>
  );
}
