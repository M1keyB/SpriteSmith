import { useEffect, useMemo, useRef } from "react";
import { clamp, hexToRgba, hsvToRgb, rgbToHsv, rgbaToHex } from "../editor/color";

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

function drawHueWheel(ctx: CanvasRenderingContext2D, size: number): void {
  const radius = size / 2;
  const inner = radius * 0.62;
  ctx.clearRect(0, 0, size, size);

  for (let angle = 0; angle < 360; angle += 1) {
    const start = ((angle - 1) * Math.PI) / 180;
    const end = (angle * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(radius, radius);
    ctx.arc(radius, radius, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
    ctx.fill();
  }

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(radius, radius, inner, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

function drawSVSquare(ctx: CanvasRenderingContext2D, size: number, hue: number): void {
  const [hr, hg, hb] = hsvToRgb(hue, 1, 1);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = `rgb(${hr}, ${hg}, ${hb})`;
  ctx.fillRect(0, 0, size, size);

  const white = ctx.createLinearGradient(0, 0, size, 0);
  white.addColorStop(0, "rgba(255,255,255,1)");
  white.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = white;
  ctx.fillRect(0, 0, size, size);

  const black = ctx.createLinearGradient(0, 0, 0, size);
  black.addColorStop(0, "rgba(0,0,0,0)");
  black.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = black;
  ctx.fillRect(0, 0, size, size);
}

export function ColorPickerPanel({ value, onChange }: Props): JSX.Element {
  const wheelRef = useRef<HTMLCanvasElement | null>(null);
  const svRef = useRef<HTMLCanvasElement | null>(null);

  const [r, g, b] = hexToRgba(value);
  const [h, s, v] = rgbToHsv(r, g, b);

  useEffect(() => {
    const canvas = wheelRef.current;
    if (!canvas) return;
    const size = 160;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawHueWheel(ctx, size);

    const angle = (h * Math.PI) / 180;
    const radius = size / 2;
    const indicatorRadius = radius * 0.81;
    const x = radius + Math.cos(angle) * indicatorRadius;
    const y = radius + Math.sin(angle) * indicatorRadius;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }, [h]);

  useEffect(() => {
    const canvas = svRef.current;
    if (!canvas) return;
    const size = 160;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawSVSquare(ctx, size, h);

    const x = s * size;
    const y = (1 - v) * size;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }, [h, s, v]);

  const applyHsv = (nextH: number, nextS: number, nextV: number): void => {
    const [nr, ng, nb] = hsvToRgb(clamp(nextH, 0, 360), clamp(nextS, 0, 1), clamp(nextV, 0, 1));
    onChange(rgbaToHex(nr, ng, nb));
  };

  const hueBackground = useMemo(
    () => "linear-gradient(90deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
    []
  );

  const setHueFromEvent = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const angle = Math.atan2(dy, dx);
    const degrees = ((angle * 180) / Math.PI + 360) % 360;
    applyHsv(degrees, s, v);
  };

  const setSvFromEvent = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    applyHsv(h, x, 1 - y);
  };

  return (
    <section className="panel">
      <h3>Color</h3>
      <div className="color-preview" style={{ background: value }} />
      <div className="hsv-row">
        <canvas className="hsv-canvas" ref={wheelRef} onMouseDown={setHueFromEvent} onMouseMove={(e) => e.buttons === 1 && setHueFromEvent(e)} />
        <canvas className="hsv-canvas" ref={svRef} onMouseDown={setSvFromEvent} onMouseMove={(e) => e.buttons === 1 && setSvFromEvent(e)} />
      </div>
      <label>
        Hue
        <input type="range" min={0} max={360} value={Math.round(h)} style={{ background: hueBackground }} onChange={(e) => applyHsv(Number(e.target.value), s, v)} />
      </label>
      <label>
        Saturation
        <input type="range" min={0} max={100} value={Math.round(s * 100)} onChange={(e) => applyHsv(h, Number(e.target.value) / 100, v)} />
      </label>
      <label>
        Value
        <input type="range" min={0} max={100} value={Math.round(v * 100)} onChange={(e) => applyHsv(h, s, Number(e.target.value) / 100)} />
      </label>
      <label>
        HEX
        <input
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(next) && next.length > 1) onChange(next);
          }}
        />
      </label>
      <label>
        R
        <input type="number" min={0} max={255} value={r} onChange={(e) => onChange(rgbaToHex(clamp(Number(e.target.value), 0, 255), g, b))} />
      </label>
      <label>
        G
        <input type="number" min={0} max={255} value={g} onChange={(e) => onChange(rgbaToHex(r, clamp(Number(e.target.value), 0, 255), b))} />
      </label>
      <label>
        B
        <input type="number" min={0} max={255} value={b} onChange={(e) => onChange(rgbaToHex(r, g, clamp(Number(e.target.value), 0, 255)))} />
      </label>
    </section>
  );
}
