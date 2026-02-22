import type { BoneRole } from "../types/models";

export interface RigPresetJoint {
  id: string;
  x: number;
  y: number;
  parentId?: string;
}

export interface RigPresetBone {
  id: string;
  a: string;
  b: string;
  name: string;
}

export interface RigPreset {
  id: string;
  name: string;
  joints: RigPresetJoint[];
  bones: RigPresetBone[];
  defaultMapping: Partial<Record<BoneRole, string>>;
}

export const RIG_PRESETS: RigPreset[] = [
  {
    id: "humanoid-simple",
    name: "Humanoid (Simple)",
    joints: [
      { id: "hip", x: 0.5, y: 0.58 },
      { id: "spine_mid", x: 0.5, y: 0.44, parentId: "hip" },
      { id: "neck", x: 0.5, y: 0.34, parentId: "spine_mid" },
      { id: "head", x: 0.5, y: 0.24, parentId: "neck" },
      { id: "l_shoulder", x: 0.38, y: 0.42, parentId: "spine_mid" },
      { id: "l_elbow", x: 0.30, y: 0.52, parentId: "l_shoulder" },
      { id: "r_shoulder", x: 0.62, y: 0.42, parentId: "spine_mid" },
      { id: "r_elbow", x: 0.70, y: 0.52, parentId: "r_shoulder" },
      { id: "l_knee", x: 0.44, y: 0.76, parentId: "hip" },
      { id: "l_ankle", x: 0.42, y: 0.93, parentId: "l_knee" },
      { id: "r_knee", x: 0.56, y: 0.76, parentId: "hip" },
      { id: "r_ankle", x: 0.58, y: 0.93, parentId: "r_knee" }
    ],
    bones: [
      { id: "Hip", a: "hip", b: "spine_mid", name: "Hip" },
      { id: "Spine", a: "spine_mid", b: "neck", name: "Spine" },
      { id: "Head", a: "neck", b: "head", name: "Head" },
      { id: "LeftUpperArm", a: "spine_mid", b: "l_shoulder", name: "LeftUpperArm" },
      { id: "LeftLowerArm", a: "l_shoulder", b: "l_elbow", name: "LeftLowerArm" },
      { id: "RightUpperArm", a: "spine_mid", b: "r_shoulder", name: "RightUpperArm" },
      { id: "RightLowerArm", a: "r_shoulder", b: "r_elbow", name: "RightLowerArm" },
      { id: "LeftUpperLeg", a: "hip", b: "l_knee", name: "LeftUpperLeg" },
      { id: "LeftLowerLeg", a: "l_knee", b: "l_ankle", name: "LeftLowerLeg" },
      { id: "RightUpperLeg", a: "hip", b: "r_knee", name: "RightUpperLeg" },
      { id: "RightLowerLeg", a: "r_knee", b: "r_ankle", name: "RightLowerLeg" }
    ],
    defaultMapping: {
      Hip: "Hip",
      Spine: "Spine",
      Head: "Head",
      LeftUpperArm: "LeftUpperArm",
      LeftLowerArm: "LeftLowerArm",
      RightUpperArm: "RightUpperArm",
      RightLowerArm: "RightLowerArm",
      LeftUpperLeg: "LeftUpperLeg",
      LeftLowerLeg: "LeftLowerLeg",
      RightUpperLeg: "RightUpperLeg",
      RightLowerLeg: "RightLowerLeg"
    }
  },
  {
    id: "humanoid_advanced",
    name: "Humanoid Advanced",
    joints: [
      { id: "pelvis", x: 0.5, y: 0.58 },
      { id: "spine", x: 0.5, y: 0.44, parentId: "pelvis" },
      { id: "chest", x: 0.5, y: 0.39, parentId: "spine" },
      { id: "neck", x: 0.5, y: 0.34, parentId: "chest" },
      { id: "head", x: 0.5, y: 0.24, parentId: "neck" },
      { id: "clavicleL", x: 0.44, y: 0.405, parentId: "chest" },
      { id: "shoulderL", x: 0.38, y: 0.42, parentId: "clavicleL" },
      { id: "elbowL", x: 0.3, y: 0.52, parentId: "shoulderL" },
      { id: "wristL", x: 0.27, y: 0.56, parentId: "elbowL" },
      { id: "handL", x: 0.24, y: 0.6, parentId: "wristL" },
      { id: "clavicleR", x: 0.56, y: 0.405, parentId: "chest" },
      { id: "shoulderR", x: 0.62, y: 0.42, parentId: "clavicleR" },
      { id: "elbowR", x: 0.7, y: 0.52, parentId: "shoulderR" },
      { id: "wristR", x: 0.73, y: 0.56, parentId: "elbowR" },
      { id: "handR", x: 0.76, y: 0.6, parentId: "wristR" },
      { id: "kneeL", x: 0.44, y: 0.76, parentId: "pelvis" },
      { id: "ankleL", x: 0.42, y: 0.93, parentId: "kneeL" },
      { id: "footBallL", x: 0.44, y: 0.96, parentId: "ankleL" },
      { id: "toeL", x: 0.48, y: 0.97, parentId: "footBallL" },
      { id: "kneeR", x: 0.56, y: 0.76, parentId: "pelvis" },
      { id: "ankleR", x: 0.58, y: 0.93, parentId: "kneeR" },
      { id: "footBallR", x: 0.56, y: 0.96, parentId: "ankleR" },
      { id: "toeR", x: 0.52, y: 0.97, parentId: "footBallR" }
    ],
    bones: [
      { id: "Hip", a: "pelvis", b: "spine", name: "Hip" },
      { id: "Spine", a: "spine", b: "chest", name: "Spine" },
      { id: "Chest", a: "chest", b: "neck", name: "Chest" },
      { id: "Head", a: "neck", b: "head", name: "Head" },
      { id: "ClavicleL", a: "chest", b: "clavicleL", name: "ClavicleL" },
      { id: "LeftUpperArm", a: "clavicleL", b: "shoulderL", name: "LeftUpperArm" },
      { id: "LeftLowerArm", a: "shoulderL", b: "elbowL", name: "LeftLowerArm" },
      { id: "LeftWrist", a: "elbowL", b: "wristL", name: "LeftWrist" },
      { id: "LeftHand", a: "wristL", b: "handL", name: "LeftHand" },
      { id: "ClavicleR", a: "chest", b: "clavicleR", name: "ClavicleR" },
      { id: "RightUpperArm", a: "clavicleR", b: "shoulderR", name: "RightUpperArm" },
      { id: "RightLowerArm", a: "shoulderR", b: "elbowR", name: "RightLowerArm" },
      { id: "RightWrist", a: "elbowR", b: "wristR", name: "RightWrist" },
      { id: "RightHand", a: "wristR", b: "handR", name: "RightHand" },
      { id: "LeftUpperLeg", a: "pelvis", b: "kneeL", name: "LeftUpperLeg" },
      { id: "LeftLowerLeg", a: "kneeL", b: "ankleL", name: "LeftLowerLeg" },
      { id: "LeftFootBall", a: "ankleL", b: "footBallL", name: "LeftFootBall" },
      { id: "LeftToe", a: "footBallL", b: "toeL", name: "LeftToe" },
      { id: "RightUpperLeg", a: "pelvis", b: "kneeR", name: "RightUpperLeg" },
      { id: "RightLowerLeg", a: "kneeR", b: "ankleR", name: "RightLowerLeg" },
      { id: "RightFootBall", a: "ankleR", b: "footBallR", name: "RightFootBall" },
      { id: "RightToe", a: "footBallR", b: "toeR", name: "RightToe" }
    ],
    defaultMapping: {
      Hip: "Hip",
      Spine: "Spine",
      Head: "Head",
      LeftUpperArm: "LeftUpperArm",
      LeftLowerArm: "LeftLowerArm",
      RightUpperArm: "RightUpperArm",
      RightLowerArm: "RightLowerArm",
      LeftUpperLeg: "LeftUpperLeg",
      LeftLowerLeg: "LeftLowerLeg",
      RightUpperLeg: "RightUpperLeg",
      RightLowerLeg: "RightLowerLeg"
    }
  },
  {
    id: "humanoid_full",
    name: "Humanoid (Full)",
    joints: [
      { id: "root", x: 0.5, y: 0.6 },
      { id: "pelvis", x: 0.5, y: 0.62, parentId: "root" },
      { id: "spine1", x: 0.5, y: 0.52, parentId: "pelvis" },
      { id: "spine2", x: 0.5, y: 0.42, parentId: "spine1" },
      { id: "spine3", x: 0.5, y: 0.42, parentId: "spine2" },
      { id: "neck", x: 0.5, y: 0.34, parentId: "spine3" },
      { id: "head", x: 0.5, y: 0.24, parentId: "neck" },
      { id: "jaw", x: 0.5, y: 0.27, parentId: "head" },
      { id: "clavicleL", x: 0.47, y: 0.4, parentId: "spine3" },
      { id: "shoulderL", x: 0.38, y: 0.4, parentId: "clavicleL" },
      { id: "elbowL", x: 0.3, y: 0.45, parentId: "shoulderL" },
      { id: "wristL", x: 0.24, y: 0.5, parentId: "elbowL" },
      { id: "handL", x: 0.21, y: 0.52, parentId: "wristL" },
      { id: "thumb1L", x: 0.2, y: 0.54, parentId: "handL" },
      { id: "thumb2L", x: 0.18, y: 0.56, parentId: "thumb1L" },
      { id: "thumb3L", x: 0.16, y: 0.58, parentId: "thumb2L" },
      { id: "index1L", x: 0.2, y: 0.51, parentId: "handL" },
      { id: "index2L", x: 0.18, y: 0.5, parentId: "index1L" },
      { id: "index3L", x: 0.16, y: 0.49, parentId: "index2L" },
      { id: "middle1L", x: 0.2, y: 0.5, parentId: "handL" },
      { id: "middle2L", x: 0.18, y: 0.48, parentId: "middle1L" },
      { id: "middle3L", x: 0.16, y: 0.46, parentId: "middle2L" },
      { id: "ring1L", x: 0.2, y: 0.49, parentId: "handL" },
      { id: "ring2L", x: 0.18, y: 0.46, parentId: "ring1L" },
      { id: "ring3L", x: 0.16, y: 0.43, parentId: "ring2L" },
      { id: "pinky1L", x: 0.2, y: 0.48, parentId: "handL" },
      { id: "pinky2L", x: 0.18, y: 0.44, parentId: "pinky1L" },
      { id: "pinky3L", x: 0.16, y: 0.4, parentId: "pinky2L" },
      { id: "clavicleR", x: 0.53, y: 0.4, parentId: "spine3" },
      { id: "shoulderR", x: 0.62, y: 0.4, parentId: "clavicleR" },
      { id: "elbowR", x: 0.7, y: 0.45, parentId: "shoulderR" },
      { id: "wristR", x: 0.76, y: 0.5, parentId: "elbowR" },
      { id: "handR", x: 0.79, y: 0.52, parentId: "wristR" },
      { id: "thumb1R", x: 0.8, y: 0.54, parentId: "handR" },
      { id: "thumb2R", x: 0.82, y: 0.56, parentId: "thumb1R" },
      { id: "thumb3R", x: 0.84, y: 0.58, parentId: "thumb2R" },
      { id: "index1R", x: 0.8, y: 0.51, parentId: "handR" },
      { id: "index2R", x: 0.82, y: 0.5, parentId: "index1R" },
      { id: "index3R", x: 0.84, y: 0.49, parentId: "index2R" },
      { id: "middle1R", x: 0.8, y: 0.5, parentId: "handR" },
      { id: "middle2R", x: 0.82, y: 0.48, parentId: "middle1R" },
      { id: "middle3R", x: 0.84, y: 0.46, parentId: "middle2R" },
      { id: "ring1R", x: 0.8, y: 0.49, parentId: "handR" },
      { id: "ring2R", x: 0.82, y: 0.46, parentId: "ring1R" },
      { id: "ring3R", x: 0.84, y: 0.43, parentId: "ring2R" },
      { id: "pinky1R", x: 0.8, y: 0.48, parentId: "handR" },
      { id: "pinky2R", x: 0.82, y: 0.44, parentId: "pinky1R" },
      { id: "pinky3R", x: 0.84, y: 0.4, parentId: "pinky2R" },
      { id: "hipL", x: 0.47, y: 0.62, parentId: "pelvis" },
      { id: "kneeL", x: 0.46, y: 0.8, parentId: "hipL" },
      { id: "ankleL", x: 0.46, y: 0.92, parentId: "kneeL" },
      { id: "ballL", x: 0.48, y: 0.96, parentId: "ankleL" },
      { id: "toeL", x: 0.52, y: 0.98, parentId: "ballL" },
      { id: "hipR", x: 0.53, y: 0.62, parentId: "pelvis" },
      { id: "kneeR", x: 0.54, y: 0.8, parentId: "hipR" },
      { id: "ankleR", x: 0.54, y: 0.92, parentId: "kneeR" },
      { id: "ballR", x: 0.52, y: 0.96, parentId: "ankleR" },
      { id: "toeR", x: 0.48, y: 0.98, parentId: "ballR" }
    ],
    bones: [
      { id: "Pelvis", a: "root", b: "pelvis", name: "Pelvis" },
      { id: "Spine1", a: "pelvis", b: "spine1", name: "Spine1" },
      { id: "Spine2", a: "spine1", b: "spine2", name: "Spine2" },
      { id: "Spine3", a: "spine2", b: "spine3", name: "Spine3" },
      { id: "Neck", a: "spine3", b: "neck", name: "Neck" },
      { id: "Head", a: "neck", b: "head", name: "Head" },
      { id: "Jaw", a: "head", b: "jaw", name: "Jaw" },
      { id: "ClavicleL", a: "spine3", b: "clavicleL", name: "ClavicleL" },
      { id: "UpperArmL", a: "clavicleL", b: "shoulderL", name: "UpperArmL" },
      { id: "LowerArmL", a: "shoulderL", b: "elbowL", name: "LowerArmL" },
      { id: "WristL", a: "elbowL", b: "wristL", name: "WristL" },
      { id: "HandL", a: "wristL", b: "handL", name: "HandL" },
      { id: "Thumb1L", a: "handL", b: "thumb1L", name: "Thumb1L" },
      { id: "Thumb2L", a: "thumb1L", b: "thumb2L", name: "Thumb2L" },
      { id: "Thumb3L", a: "thumb2L", b: "thumb3L", name: "Thumb3L" },
      { id: "Index1L", a: "handL", b: "index1L", name: "Index1L" },
      { id: "Index2L", a: "index1L", b: "index2L", name: "Index2L" },
      { id: "Index3L", a: "index2L", b: "index3L", name: "Index3L" },
      { id: "Middle1L", a: "handL", b: "middle1L", name: "Middle1L" },
      { id: "Middle2L", a: "middle1L", b: "middle2L", name: "Middle2L" },
      { id: "Middle3L", a: "middle2L", b: "middle3L", name: "Middle3L" },
      { id: "Ring1L", a: "handL", b: "ring1L", name: "Ring1L" },
      { id: "Ring2L", a: "ring1L", b: "ring2L", name: "Ring2L" },
      { id: "Ring3L", a: "ring2L", b: "ring3L", name: "Ring3L" },
      { id: "Pinky1L", a: "handL", b: "pinky1L", name: "Pinky1L" },
      { id: "Pinky2L", a: "pinky1L", b: "pinky2L", name: "Pinky2L" },
      { id: "Pinky3L", a: "pinky2L", b: "pinky3L", name: "Pinky3L" },
      { id: "ClavicleR", a: "spine3", b: "clavicleR", name: "ClavicleR" },
      { id: "UpperArmR", a: "clavicleR", b: "shoulderR", name: "UpperArmR" },
      { id: "LowerArmR", a: "shoulderR", b: "elbowR", name: "LowerArmR" },
      { id: "WristR", a: "elbowR", b: "wristR", name: "WristR" },
      { id: "HandR", a: "wristR", b: "handR", name: "HandR" },
      { id: "Thumb1R", a: "handR", b: "thumb1R", name: "Thumb1R" },
      { id: "Thumb2R", a: "thumb1R", b: "thumb2R", name: "Thumb2R" },
      { id: "Thumb3R", a: "thumb2R", b: "thumb3R", name: "Thumb3R" },
      { id: "Index1R", a: "handR", b: "index1R", name: "Index1R" },
      { id: "Index2R", a: "index1R", b: "index2R", name: "Index2R" },
      { id: "Index3R", a: "index2R", b: "index3R", name: "Index3R" },
      { id: "Middle1R", a: "handR", b: "middle1R", name: "Middle1R" },
      { id: "Middle2R", a: "middle1R", b: "middle2R", name: "Middle2R" },
      { id: "Middle3R", a: "middle2R", b: "middle3R", name: "Middle3R" },
      { id: "Ring1R", a: "handR", b: "ring1R", name: "Ring1R" },
      { id: "Ring2R", a: "ring1R", b: "ring2R", name: "Ring2R" },
      { id: "Ring3R", a: "ring2R", b: "ring3R", name: "Ring3R" },
      { id: "Pinky1R", a: "handR", b: "pinky1R", name: "Pinky1R" },
      { id: "Pinky2R", a: "pinky1R", b: "pinky2R", name: "Pinky2R" },
      { id: "Pinky3R", a: "pinky2R", b: "pinky3R", name: "Pinky3R" },
      { id: "UpperLegL", a: "pelvis", b: "hipL", name: "UpperLegL" },
      { id: "LowerLegL", a: "hipL", b: "kneeL", name: "LowerLegL" },
      { id: "FootL", a: "kneeL", b: "ankleL", name: "FootL" },
      { id: "BallL", a: "ankleL", b: "ballL", name: "BallL" },
      { id: "ToeL", a: "ballL", b: "toeL", name: "ToeL" },
      { id: "UpperLegR", a: "pelvis", b: "hipR", name: "UpperLegR" },
      { id: "LowerLegR", a: "hipR", b: "kneeR", name: "LowerLegR" },
      { id: "FootR", a: "kneeR", b: "ankleR", name: "FootR" },
      { id: "BallR", a: "ankleR", b: "ballR", name: "BallR" },
      { id: "ToeR", a: "ballR", b: "toeR", name: "ToeR" }
    ],
    defaultMapping: {
      Hip: "Pelvis",
      Spine: "Spine2",
      Head: "Head",
      LeftUpperArm: "UpperArmL",
      LeftLowerArm: "LowerArmL",
      RightUpperArm: "UpperArmR",
      RightLowerArm: "LowerArmR",
      LeftUpperLeg: "UpperLegL",
      LeftLowerLeg: "LowerLegL",
      RightUpperLeg: "UpperLegR",
      RightLowerLeg: "LowerLegR"
    }
  }
];

export function getRigPresetById(id: string): RigPreset {
  return RIG_PRESETS.find((preset) => preset.id === id) ?? RIG_PRESETS[0];
}
