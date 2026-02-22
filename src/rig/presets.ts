import type { BoneMapping, BonePose, BoneRole, RigBone } from "../types/models";

export type PresetId = "idle" | "walk" | "run" | "jump" | "wave" | "punch";
export type PoseForAllBones = Record<string, BonePose>;
export type PresetFn = (t: number, bones: RigBone[], mapping: BoneMapping, selectedBoneId: string | null) => PoseForAllBones;

export interface RigPreset {
  id: PresetId;
  name: string;
  defaultFrames: number;
  fn: PresetFn;
}

export const PRESET_ROLES: BoneRole[] = [
  "Hip",
  "Spine",
  "Head",
  "LeftUpperLeg",
  "LeftLowerLeg",
  "RightUpperLeg",
  "RightLowerLeg",
  "LeftUpperArm",
  "LeftLowerArm",
  "RightUpperArm",
  "RightLowerArm"
];

function cleanName(name: string | undefined): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function setRot(target: PoseForAllBones, boneId: string | null, rotDeg: number): void {
  if (!boneId) return;
  target[boneId] = { ...(target[boneId] ?? {}), rotDeg };
}

function setOffset(target: PoseForAllBones, boneId: string | null, dx: number, dy: number): void {
  if (!boneId) return;
  target[boneId] = { ...(target[boneId] ?? {}), dx, dy };
}

export function createEmptyBoneMapping(): BoneMapping {
  return {
    Hip: null,
    Spine: null,
    Head: null,
    LeftUpperLeg: null,
    LeftLowerLeg: null,
    RightUpperLeg: null,
    RightLowerLeg: null,
    LeftUpperArm: null,
    LeftLowerArm: null,
    RightUpperArm: null,
    RightLowerArm: null
  };
}

function findByPatterns(bones: RigBone[], patterns: string[]): string | null {
  for (const pattern of patterns) {
    const found = bones.find((bone) => cleanName(bone.name).includes(pattern));
    if (found) return found.id;
  }
  return null;
}

export function autoMapBones(bones: RigBone[]): BoneMapping {
  const mapping = createEmptyBoneMapping();
  mapping.Hip = findByPatterns(bones, ["hip", "pelvis", "root"]);
  mapping.Spine = findByPatterns(bones, ["spine", "torso", "chest"]);
  mapping.Head = findByPatterns(bones, ["head", "neck"]);
  mapping.LeftUpperLeg = findByPatterns(bones, ["leftupperleg", "uplegleft", "thighleft", "lupperleg", "legl"]);
  mapping.LeftLowerLeg = findByPatterns(bones, ["leftlowerleg", "calfleft", "shinleft", "llowerleg", "kneeleft"]);
  mapping.RightUpperLeg = findByPatterns(bones, ["rightupperleg", "uplegright", "thighright", "rupperleg", "legr"]);
  mapping.RightLowerLeg = findByPatterns(bones, ["rightlowerleg", "calfright", "shinright", "rlowerleg", "kneeright"]);
  mapping.LeftUpperArm = findByPatterns(bones, ["leftupperarm", "uparmleft", "bicepleft", "lupperarm", "arml"]);
  mapping.LeftLowerArm = findByPatterns(bones, ["leftlowerarm", "forearmleft", "elbowleft", "llowerarm"]);
  mapping.RightUpperArm = findByPatterns(bones, ["rightupperarm", "uparmright", "bicepright", "rupperarm", "armr"]);
  mapping.RightLowerArm = findByPatterns(bones, ["rightlowerarm", "forearmright", "elbowright", "rlowerarm"]);
  return mapping;
}

export function normalizeBoneMapping(mapping: Partial<BoneMapping> | undefined, bones: RigBone[]): BoneMapping {
  const auto = autoMapBones(bones);
  const out = createEmptyBoneMapping();
  for (const role of PRESET_ROLES) {
    const requested = mapping?.[role] ?? null;
    out[role] = requested && bones.some((bone) => bone.id === requested) ? requested : auto[role];
  }
  return out;
}

function waveLikePreset(amplitude: number): PresetFn {
  return (t, bones, mapping, selectedBoneId) => {
    const pose: PoseForAllBones = {};
    const target = selectedBoneId ?? mapping.RightLowerArm ?? bones[0]?.id ?? null;
    setRot(pose, target, Math.sin(t * Math.PI * 2) * amplitude);
    return pose;
  };
}

const idlePreset: PresetFn = (t, _bones, mapping) => {
  const pose: PoseForAllBones = {};
  const sway = Math.sin(t * Math.PI * 2) * 3;
  setRot(pose, mapping.Hip, sway);
  setRot(pose, mapping.Spine, -sway * 0.8);
  setRot(pose, mapping.Head, sway * 0.45);
  return pose;
};

const walkPreset: PresetFn = (t, _bones, mapping) => {
  const pose: PoseForAllBones = {};
  const cycle = t * Math.PI * 2;
  const leg = Math.sin(cycle) * 18;
  const legLag = Math.sin(cycle + Math.PI / 3) * 22;
  const arm = Math.sin(cycle + Math.PI) * 12;
  setRot(pose, mapping.Hip, Math.sin(cycle) * 3);
  setRot(pose, mapping.Spine, Math.sin(cycle + Math.PI) * 2);
  setRot(pose, mapping.Head, Math.sin(cycle + Math.PI) * 1.5);
  setRot(pose, mapping.LeftUpperLeg, leg);
  setRot(pose, mapping.RightUpperLeg, -leg);
  setRot(pose, mapping.LeftLowerLeg, Math.max(0, legLag));
  setRot(pose, mapping.RightLowerLeg, Math.max(0, -legLag));
  setRot(pose, mapping.LeftUpperArm, arm);
  setRot(pose, mapping.RightUpperArm, -arm);
  return pose;
};

const runPreset: PresetFn = (t, _bones, mapping) => {
  const pose: PoseForAllBones = {};
  const cycle = t * Math.PI * 2;
  const leg = Math.sin(cycle) * 28;
  const arm = Math.sin(cycle + Math.PI) * 18;
  setRot(pose, mapping.Spine, -8 + Math.sin(cycle) * 2);
  setRot(pose, mapping.Hip, Math.sin(cycle) * 4);
  setRot(pose, mapping.LeftUpperLeg, leg);
  setRot(pose, mapping.RightUpperLeg, -leg);
  setRot(pose, mapping.LeftLowerLeg, Math.max(0, Math.sin(cycle + Math.PI / 3) * 28));
  setRot(pose, mapping.RightLowerLeg, Math.max(0, Math.sin(cycle + Math.PI + Math.PI / 3) * 28));
  setRot(pose, mapping.LeftUpperArm, arm);
  setRot(pose, mapping.RightUpperArm, -arm);
  setRot(pose, mapping.Head, 4);
  return pose;
};

const jumpPreset: PresetFn = (t, _bones, mapping) => {
  const pose: PoseForAllBones = {};
  if (t < 0.3) {
    const p = t / 0.3;
    const knee = p * 28;
    setRot(pose, mapping.LeftLowerLeg, knee);
    setRot(pose, mapping.RightLowerLeg, knee);
    setOffset(pose, mapping.Hip, 0, p * 2.5);
  } else if (t < 0.7) {
    const p = (t - 0.3) / 0.4;
    setRot(pose, mapping.LeftLowerLeg, 10 - p * 8);
    setRot(pose, mapping.RightLowerLeg, 10 - p * 8);
    setRot(pose, mapping.LeftUpperArm, -12);
    setRot(pose, mapping.RightUpperArm, 12);
    setOffset(pose, mapping.Hip, 0, -2 + Math.sin(p * Math.PI) * -1);
  } else {
    const p = (t - 0.7) / 0.3;
    const knee = (1 - p) * 22;
    setRot(pose, mapping.LeftLowerLeg, knee);
    setRot(pose, mapping.RightLowerLeg, knee);
    setOffset(pose, mapping.Hip, 0, (1 - p) * 1.8);
  }
  return pose;
};

const punchPreset: PresetFn = (t, bones, mapping, selectedBoneId) => {
  const pose: PoseForAllBones = {};
  const target = selectedBoneId ?? mapping.RightLowerArm ?? bones[0]?.id ?? null;
  let rot = 0;
  if (t < 0.4) rot = -10 + (t / 0.4) * 45;
  else rot = 35 * (1 - (t - 0.4) / 0.6);
  setRot(pose, target, rot);
  return pose;
};

export const PRESETS: RigPreset[] = [
  { id: "idle", name: "Idle", defaultFrames: 8, fn: idlePreset },
  { id: "walk", name: "Walk", defaultFrames: 12, fn: walkPreset },
  { id: "run", name: "Run", defaultFrames: 12, fn: runPreset },
  { id: "jump", name: "Jump", defaultFrames: 10, fn: jumpPreset },
  { id: "wave", name: "Wave", defaultFrames: 8, fn: waveLikePreset(25) },
  { id: "punch", name: "Punch", defaultFrames: 8, fn: punchPreset }
];

export function getPresetById(id: PresetId): RigPreset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}
