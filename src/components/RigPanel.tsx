import { useEffect, useState } from "react";
import { createId } from "../editor/id";
import { getEditablePixels } from "../editor/layers";
import { buildPosedRig } from "../editor/rig";
import { PRESETS, PRESET_ROLES, getPresetById, type PresetId } from "../rig/presets";
import { RIG_PRESETS } from "../rig/rigPresets";
import type { EditorAction } from "../state/editorReducer";
import type { EditorState } from "../types/models";

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export function RigPanel({ state, dispatch }: Props): JSX.Element {
  const [rigCollapsed, setRigCollapsed] = useState<boolean>(() => window.localStorage.getItem("spritesmith.ui.rigCollapsed") === "true");
  const [mappingCollapsed, setMappingCollapsed] = useState<boolean>(
    () => window.localStorage.getItem("spritesmith.ui.mappingCollapsed") !== "false"
  );
  const [segmentsCollapsed, setSegmentsCollapsed] = useState<boolean>(
    () => window.localStorage.getItem("spritesmith.ui.segmentsCollapsed") === "true"
  );
  const [clearAfterAttach, setClearAfterAttach] = useState(true);
  const [rigPresetId, setRigPresetId] = useState<string>(RIG_PRESETS[0]?.id ?? "");
  const [replaceExistingRig, setReplaceExistingRig] = useState(false);
  const [autoMapOnInsert, setAutoMapOnInsert] = useState(true);
  const [centerRigOnInsert, setCenterRigOnInsert] = useState(true);
  const [presetId, setPresetId] = useState<PresetId>("walk");
  const [presetFrames, setPresetFrames] = useState<number>(getPresetById("walk").defaultFrames);
  const [overwritePoses, setOverwritePoses] = useState(true);
  const selectedBone = state.project.rig.bones.find((bone) => bone.id === state.selectedRigBoneId) ?? null;
  const selectedSegment = state.project.segments.find((segment) => segment.id === state.selectedSegmentId) ?? null;
  const frameSegments = state.project.segments
    .filter((segment) => segment.frameIndex === state.activeFrameIndex)
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex);
  const activeFrame = state.project.frames[state.activeFrameIndex];
  const activeFramePoseKey = activeFrame?.id ?? String(state.activeFrameIndex);
  const selectedBoneRotation =
    selectedBone ? state.project.rigPoseByFrame[activeFramePoseKey]?.[selectedBone.id]?.rotDeg ?? 0 : 0;
  const selection = state.segmentSelection;
  const mappingAssignedCount = PRESET_ROLES.filter((role) => Boolean(state.project.boneMapping[role])).length;
  const segmentsAttachedLabel = `${frameSegments.length} attached`;
  const hasExistingRig = state.project.rig.joints.length > 0 || state.project.rig.bones.length > 0;

  useEffect(() => {
    window.localStorage.setItem("spritesmith.ui.rigCollapsed", String(rigCollapsed));
  }, [rigCollapsed]);

  useEffect(() => {
    window.localStorage.setItem("spritesmith.ui.mappingCollapsed", String(mappingCollapsed));
  }, [mappingCollapsed]);

  useEffect(() => {
    window.localStorage.setItem("spritesmith.ui.segmentsCollapsed", String(segmentsCollapsed));
  }, [segmentsCollapsed]);

  const attachSelectionToBone = (): void => {
    if (!selectedBone || !selection || selection.w <= 0 || selection.h <= 0) return;
    const frame = state.project.frames[state.activeFrameIndex];
    const editable = getEditablePixels(frame);
    const width = state.project.gridWidth;
    const height = state.project.gridHeight;
    const w = Math.min(selection.w, Math.max(0, width - selection.x));
    const h = Math.min(selection.h, Math.max(0, height - selection.y));
    if (w <= 0 || h <= 0) return;

    const rgba = new Uint8ClampedArray(w * h * 4);
    const cleared = editable.slice();
    let hasPixel = false;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const srcX = selection.x + x;
        const srcY = selection.y + y;
        const srcIndex = srcY * width + srcX;
        const packed = editable[srcIndex] ?? 0;
        const r = (packed >> 24) & 255;
        const g = (packed >> 16) & 255;
        const b = (packed >> 8) & 255;
        const a = packed & 255;
        const offset = (y * w + x) * 4;
        rgba[offset] = r;
        rgba[offset + 1] = g;
        rgba[offset + 2] = b;
        rgba[offset + 3] = a;
        if (a > 0) hasPixel = true;
        if (clearAfterAttach) cleared[srcIndex] = 0;
      }
    }
    if (!hasPixel) return;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
    const pixels = canvas.toDataURL("image/png");
    const anchor = { x: Math.floor(w / 2), y: Math.floor(h / 2) };
    const posed = buildPosedRig(activeFramePoseKey, state.project.rig, state.project.rigPoseByFrame);
    const startJoint = posed.boneStartMap[selectedBone.id] ?? posed.jointMap[selectedBone.aJointId];
    if (!startJoint) return;
    const originalAnchorWorld = { x: selection.x + anchor.x, y: selection.y + anchor.y };
    const offset = {
      x: originalAnchorWorld.x - startJoint.x,
      y: originalAnchorWorld.y - startJoint.y
    };
    const maxZ = frameSegments.reduce((max, segment) => Math.max(max, segment.zIndex), -1);
    dispatch({
      type: "ATTACH_SEGMENT",
      segment: {
        id: createId(),
        boneId: selectedBone.id,
        frameIndex: state.activeFrameIndex,
        w,
        h,
        pixels,
        anchor,
        offset,
        zIndex: maxZ + 1
      },
      clearedPixels: clearAfterAttach ? cleared : undefined
    });
  };

  const insertPresetRig = (): void => {
    if (!rigPresetId) return;
    if (hasExistingRig && !replaceExistingRig) {
      window.alert("Enable Replace existing rig to insert preset rig.");
      return;
    }
    if (replaceExistingRig && state.project.segments.length > 0) {
      const confirmed = window.confirm(
        `Replacing rig will remove ${state.project.segments.length} attached segment(s). Continue?`
      );
      if (!confirmed) return;
    }
    dispatch({
      type: "RIG_INSERT_PRESET",
      presetId: rigPresetId,
      replaceExisting: replaceExistingRig,
      autoMap: autoMapOnInsert,
      centerRig: centerRigOnInsert
    });
  };

  return (
    <section className="panel">
      <h3>Rig</h3>
      <div className="inline-buttons rig-top-actions">
        <button
          onClick={() => {
            if (!window.confirm("Clear all joints, bones, and rig poses?")) return;
            dispatch({ type: "RIG_CLEAR" });
          }}
          disabled={state.project.rig.joints.length === 0 && state.project.rig.bones.length === 0}
        >
          Clear Rig
        </button>
      </div>
      <label>
        Preset Rig
        <select value={rigPresetId} onChange={(event) => setRigPresetId(event.target.value)}>
          {RIG_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-check">
        <input type="checkbox" checked={replaceExistingRig} onChange={(event) => setReplaceExistingRig(event.target.checked)} />
        Replace existing rig
      </label>
      <label className="inline-check">
        <input type="checkbox" checked={autoMapOnInsert} onChange={(event) => setAutoMapOnInsert(event.target.checked)} />
        Auto-map bones
      </label>
      <label className="inline-check">
        <input type="checkbox" checked={centerRigOnInsert} onChange={(event) => setCenterRigOnInsert(event.target.checked)} />
        Center rig
      </label>
      <button onClick={insertPresetRig}>Add Rig to Canvas</button>
      <div className="rig-preset-divider" aria-hidden />
      <label>
        Preset
        <select
          value={presetId}
          onChange={(event) => {
            const nextId = event.target.value as PresetId;
            setPresetId(nextId);
            setPresetFrames(getPresetById(nextId).defaultFrames);
          }}
        >
          {PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Frames
        <input
          type="number"
          min={1}
          max={240}
          value={presetFrames}
          onChange={(event) => setPresetFrames(Number(event.target.value))}
        />
      </label>
      <label className="inline-check">
        <input type="checkbox" checked={overwritePoses} onChange={(event) => setOverwritePoses(event.target.checked)} />
        Overwrite existing poses
      </label>
      <div className="inline-buttons">
        <button
          onClick={() => dispatch({ type: "APPLY_RIG_PRESET", presetId, frameCount: presetFrames, overwrite: overwritePoses })}
          disabled={state.project.rig.bones.length === 0}
        >
          Apply Preset
        </button>
        <button disabled>Bake to Frames</button>
      </div>
      <div className="rig-preset-divider" aria-hidden />

      <div className="rig-accordion">
        <div className="rig-accordion-card">
          <button className="rig-accordion-header" onClick={() => setRigCollapsed((value) => !value)}>
            <span>Rig</span>
            <span className={`rig-chevron ${rigCollapsed ? "collapsed" : ""}`}>v</span>
          </button>
          {!rigCollapsed && (
            <div className="rig-accordion-body">
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={state.project.rig.showOverlay}
                  onChange={(event) => dispatch({ type: "RIG_SET_OVERLAY", value: event.target.checked })}
                />
                Show Rig Overlay
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={state.project.rig.includeOverlayInExport}
                  onChange={(event) => dispatch({ type: "RIG_SET_INCLUDE_OVERLAY_EXPORT", value: event.target.checked })}
                />
                Include Rig Overlay in Export
              </label>
              <label>
                Selected
                <input value={selectedBone?.name ?? "None"} disabled />
              </label>
              <label>
                Rename Bone
                <input
                  value={selectedBone?.name ?? ""}
                  placeholder="Select a bone"
                  disabled={!selectedBone}
                  onChange={(event) =>
                    selectedBone && dispatch({ type: "RIG_RENAME_BONE", boneId: selectedBone.id, name: event.target.value })
                  }
                />
              </label>
              <label>
                Bone Rotation ({Math.round(selectedBoneRotation)}deg)
                <input
                  type="range"
                  min={-90}
                  max={90}
                  step={1}
                  value={selectedBoneRotation}
                  disabled={!selectedBone}
                  onChange={(event) =>
                    selectedBone &&
                    dispatch({
                      type: "RIG_SET_BONE_ROTATION",
                      boneId: selectedBone.id,
                      rotDeg: Number(event.target.value)
                    })
                  }
                />
              </label>
              <button
                className="danger-button"
                onClick={() => {
                  if (!window.confirm("Delete selected rig element?")) return;
                  dispatch({ type: "RIG_DELETE_SELECTED" });
                }}
                disabled={!state.selectedRigJointId && !state.selectedRigBoneId && !state.selectedSegmentId}
              >
                Delete Selected
              </button>
            </div>
          )}
        </div>

        <div className="rig-accordion-card">
          <div className="rig-accordion-header rig-accordion-header-static">
            <button className="rig-accordion-title-button" onClick={() => setMappingCollapsed((value) => !value)}>
              <span>Mapping</span>
              <span className={`rig-chevron ${mappingCollapsed ? "collapsed" : ""}`}>v</span>
            </button>
            <span className="rig-header-summary">Assigned {mappingAssignedCount}/{PRESET_ROLES.length}</span>
            <button onClick={() => dispatch({ type: "AUTO_MAP_BONES" })} disabled={state.project.rig.bones.length === 0}>
              Auto Map
            </button>
          </div>
          {!mappingCollapsed && (
            <div className="rig-accordion-body">
              <div className="saved-list">
                {PRESET_ROLES.map((role) => (
                  <label key={role}>
                    {role}
                    <select
                      value={state.project.boneMapping[role] ?? ""}
                      onChange={(event) =>
                        dispatch({ type: "SET_BONE_MAPPING", role, boneId: event.target.value || null })
                      }
                    >
                      <option value="">Unassigned</option>
                      {state.project.rig.bones.map((bone) => (
                        <option key={bone.id} value={bone.id}>
                          {bone.name || bone.id}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rig-accordion-card">
          <button className="rig-accordion-header" onClick={() => setSegmentsCollapsed((value) => !value)}>
            <span>Segments</span>
            <span className="rig-header-summary">{segmentsAttachedLabel}</span>
            <span className={`rig-chevron ${segmentsCollapsed ? "collapsed" : ""}`}>v</span>
          </button>
          {!segmentsCollapsed && (
            <div className="rig-accordion-body">
              <div className="inline-buttons">
                <button
                  onClick={() => dispatch({ type: "SET_SEGMENT_SELECTION_MODE", value: !state.segmentSelectionMode })}
                  className={state.segmentSelectionMode ? "active" : ""}
                >
                  {state.segmentSelectionMode ? "Selecting..." : "Rect Select"}
                </button>
                <button onClick={() => dispatch({ type: "SET_SEGMENT_SELECTION", selection: null })} disabled={!selection}>
                  Clear Selection
                </button>
              </div>
              <label className="inline-check">
                <input type="checkbox" checked={clearAfterAttach} onChange={(event) => setClearAfterAttach(event.target.checked)} />
                Clear pixels from base after attach
              </label>
              <button onClick={attachSelectionToBone} disabled={!selectedBone || !selection}>
                Attach Selection to Bone
              </button>
              {selection && (
                <p className="hint">
                  Selection: {selection.x},{selection.y} {selection.w}x{selection.h}
                </p>
              )}
              <label>
                Segments attached to this rig
                <select
                  value={selectedSegment?.id ?? ""}
                  onChange={(event) => dispatch({ type: "SELECT_SEGMENT", segmentId: event.target.value || null })}
                >
                  <option value="">None</option>
                  {frameSegments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.boneId} ({segment.w}x{segment.h}) z{segment.zIndex}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => selectedSegment && dispatch({ type: "DETACH_SEGMENT", segmentId: selectedSegment.id })}
                disabled={!selectedSegment}
              >
                Detach Segment
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="hint">
        Bones mode: click joint to select/drag. Click empty space to add a chained joint and bone. Use Rect Select to attach a rigid segment.
      </p>
    </section>
  );
}
