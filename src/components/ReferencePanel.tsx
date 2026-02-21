import { useRef, useState } from "react";
import { getEditablePixels } from "../editor/layers";
import { extractPaletteFromImageData, smartFillFromReference } from "../editor/smartFill";
import type { EditorAction } from "../state/editorReducer";
import type { EditorState, ReferenceImage } from "../types/models";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export function ReferencePanel({ state, dispatch }: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [alphaThreshold, setAlphaThreshold] = useState(20);
  const [preserveExisting, setPreserveExisting] = useState(true);
  const [usePaletteRemap, setUsePaletteRemap] = useState(false);
  const reference = state.referenceImage;

  const onPickFile = async (file: File): Promise<void> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = dataUrl;
    });

    const fitScale = Math.min(state.project.gridWidth / img.width, state.project.gridHeight / img.height) || 1;
    const scale = Math.max(0.05, fitScale);
    const x = (state.project.gridWidth - img.width * scale) / 2;
    const y = (state.project.gridHeight - img.height * scale) / 2;

    const nextRef: ReferenceImage = {
      dataUrl,
      width: img.width,
      height: img.height,
      visible: true,
      opacity: 0.45,
      scale,
      x,
      y
    };
    dispatch({ type: "SET_REFERENCE_IMAGE", reference: nextRef });
  };

  return (
    <section className="panel">
      <h3>Reference</h3>
      <div className="inline-buttons">
        <button onClick={() => inputRef.current?.click()}>Load Image</button>
        <button
          onClick={() => {
            dispatch({ type: "CLEAR_REFERENCE_IMAGE" });
            if (inputRef.current) inputRef.current.value = "";
          }}
          disabled={!reference}
        >
          Clear
        </button>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            input.value = "";
            if (!file) return;
            try {
              await onPickFile(file);
            } catch (error) {
              console.error("Failed to load reference image", error);
            }
          }}
        />
      </div>
      {reference ? (
        <>
          <label>
            <input
              type="checkbox"
              checked={reference.visible}
              onChange={(e) => dispatch({ type: "SET_REFERENCE_VISIBLE", value: e.target.checked })}
            />
            Show Overlay
          </label>
          <label>
            Opacity
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(reference.opacity * 100)}
              onChange={(e) => dispatch({ type: "SET_REFERENCE_OPACITY", value: Number(e.target.value) / 100 })}
            />
          </label>
          <label>
            Scale
            <input
              type="number"
              min={0.05}
              max={20}
              step={0.05}
              value={Number(reference.scale.toFixed(2))}
              onChange={(e) => dispatch({ type: "SET_REFERENCE_SCALE", value: Number(e.target.value) })}
            />
          </label>
          <label>
            Offset X
            <input
              type="number"
              step={0.5}
              value={Number(reference.x.toFixed(2))}
              onChange={(e) =>
                dispatch({ type: "SET_REFERENCE_POSITION", x: Number(e.target.value), y: reference.y })
              }
            />
          </label>
          <label>
            Offset Y
            <input
              type="number"
              step={0.5}
              value={Number(reference.y.toFixed(2))}
              onChange={(e) =>
                dispatch({ type: "SET_REFERENCE_POSITION", x: reference.x, y: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Smart Fill Alpha Threshold
            <input
              type="range"
              min={0}
              max={255}
              value={alphaThreshold}
              onChange={(e) => setAlphaThreshold(Number(e.target.value))}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={preserveExisting}
              onChange={(e) => setPreserveExisting(e.target.checked)}
            />
            Smart Fill Preserve Existing Pixels
          </label>
          <label>
            <input
              type="checkbox"
              checked={usePaletteRemap}
              onChange={(e) => setUsePaletteRemap(e.target.checked)}
            />
            Smart Fill Use Palette Remap
          </label>
          <small>
            {usePaletteRemap
              ? "Mode: Palette Remap (limited to project palette)"
              : "Mode: Exact Color (directly sampled from reference)"}
          </small>
          <div className="inline-buttons">
            <button
              onClick={async () => {
                const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                  const image = new Image();
                  image.onload = () => resolve(image);
                  image.onerror = () => reject(new Error("Failed to load image"));
                  image.src = reference.dataUrl;
                });
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0);
                const data = ctx.getImageData(0, 0, img.width, img.height);
                const extracted = extractPaletteFromImageData(data, 16);
                if (extracted.length > 0) dispatch({ type: "SET_PALETTE", palette: extracted });
              }}
            >
              Extract Palette
            </button>
            <button
              onClick={async () => {
                const frame = state.project.frames[state.activeFrameIndex];
                const basePixels = getEditablePixels(frame);
                const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                  const image = new Image();
                  image.onload = () => resolve(image);
                  image.onerror = () => reject(new Error("Failed to load image"));
                  image.src = reference.dataUrl;
                });
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const pixels = smartFillFromReference({
                  gridWidth: state.project.gridWidth,
                  gridHeight: state.project.gridHeight,
                  reference,
                  imageData,
                  paletteHex: state.project.palette,
                  basePixels,
                  alphaThreshold,
                  preserveExisting,
                  usePaletteRemap
                });
                dispatch({
                  type: "UPDATE_FRAME_PIXELS",
                  frameIndex: state.activeFrameIndex,
                  pixels,
                  pushHistory: true
                });
              }}
            >
              Smart Fill Active Frame
            </button>
          </div>
          <small>
            {reference.width}x{reference.height}px source
          </small>
        </>
      ) : (
        <small>Import an image to trace over. Overlay is editor-only and not exported.</small>
      )}
    </section>
  );
}
