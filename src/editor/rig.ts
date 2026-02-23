import type { BonePose, RigBone, RigData, RigJoint } from "../types/models";

export interface LegacyProjectRigShape {
  rig?: Partial<RigData>;
  rigPoseByFrame?: Record<string, Record<string, BonePose | number>>;
  frames?: Array<{ id?: string }>;
  boneMapping?: unknown;
}

export interface PosedRig {
  jointMap: Record<string, { x: number; y: number }>;
  boneStartMap: Record<string, { x: number; y: number }>;
  boneAngleRadMap: Record<string, number>;
}

export function createDefaultRigData(): RigData {
  return {
    joints: [],
    bones: [],
    showOverlay: true,
    includeOverlayInExport: false
  };
}

function sanitizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function normalizeRigData(project: LegacyProjectRigShape): RigData {
  const base = createDefaultRigData();
  const input = project.rig ?? {};
  const joints: RigJoint[] = Array.isArray(input.joints)
    ? input.joints
        .filter((joint): joint is RigJoint => typeof joint?.id === "string")
        .map((joint) => ({
          id: joint.id,
          x: sanitizeNumber(joint.x, 0),
          y: sanitizeNumber(joint.y, 0),
          parentId: sanitizeString(joint.parentId)
        }))
    : [];
  const jointIds = new Set(joints.map((joint) => joint.id));
  const bones: RigBone[] = Array.isArray(input.bones)
    ? input.bones
        .filter((bone): bone is RigBone => {
          return (
            typeof bone?.id === "string" &&
            typeof bone.aJointId === "string" &&
            typeof bone.bJointId === "string" &&
            jointIds.has(bone.aJointId) &&
            jointIds.has(bone.bJointId)
          );
        })
        .map((bone) => ({
          id: bone.id,
          aJointId: bone.aJointId,
          bJointId: bone.bJointId,
          name: sanitizeString(bone.name),
          parentBoneId: sanitizeString(bone.parentBoneId),
          length: sanitizeNumber(bone.length, 0)
        }))
    : [];
  return {
    ...base,
    joints,
    bones,
    showOverlay: typeof input.showOverlay === "boolean" ? input.showOverlay : base.showOverlay,
    includeOverlayInExport:
      typeof input.includeOverlayInExport === "boolean" ? input.includeOverlayInExport : base.includeOverlayInExport
  };
}

export function normalizeRigPoseByFrame(project: LegacyProjectRigShape, rig: RigData): Record<string, Record<string, BonePose>> {
  const frames = project.frames ?? [];
  const frameIdByIndex = new Map<number, string>();
  const validFrameIds = new Set<string>();
  frames.forEach((frame, index) => {
    const id = typeof frame.id === "string" && frame.id.length > 0 ? frame.id : String(index);
    frameIdByIndex.set(index, id);
    validFrameIds.add(id);
  });
  const validBoneIds = new Set(rig.bones.map((bone) => bone.id));
  const output: Record<string, Record<string, BonePose>> = {};

  const directInput = project.rigPoseByFrame;
  if (directInput && typeof directInput === "object") {
    for (const [frameKey, framePose] of Object.entries(directInput)) {
      if (!framePose || typeof framePose !== "object") continue;
      let normalizedFrameId: string | undefined;
      if (validFrameIds.has(frameKey)) normalizedFrameId = frameKey;
      else {
        const asIndex = Number(frameKey);
        if (Number.isFinite(asIndex)) normalizedFrameId = frameIdByIndex.get(asIndex);
      }
      if (!normalizedFrameId) continue;
      const normalizedPose: Record<string, BonePose> = {};
      for (const [boneId, pose] of Object.entries(framePose)) {
        if (!validBoneIds.has(boneId)) continue;
        if (typeof pose === "number") {
          normalizedPose[boneId] = { rotDeg: sanitizeNumber(pose, 0) };
          continue;
        }
        if (!pose || typeof pose !== "object") continue;
        normalizedPose[boneId] = {
          rotDeg: sanitizeNumber((pose as { rotDeg?: unknown }).rotDeg, 0),
          dx: sanitizeNumber((pose as { dx?: unknown }).dx, 0),
          dy: sanitizeNumber((pose as { dy?: unknown }).dy, 0)
        };
      }
      output[normalizedFrameId] = normalizedPose;
    }
    return output;
  }

  // Backward compatibility with legacy rig.poseByFrame keyed by frame id.
  const legacyPose = (project.rig as { poseByFrame?: Record<string, Record<string, { rotDeg?: unknown }>> } | undefined)?.poseByFrame;
  if (legacyPose && typeof legacyPose === "object") {
    for (const [frameId, framePose] of Object.entries(legacyPose)) {
      if (!validFrameIds.has(frameId) || !framePose || typeof framePose !== "object") continue;
      const normalizedPose: Record<string, BonePose> = {};
      for (const [boneId, pose] of Object.entries(framePose)) {
        if (!validBoneIds.has(boneId)) continue;
        if (!pose || typeof pose !== "object") continue;
        normalizedPose[boneId] = {
          rotDeg: sanitizeNumber((pose as { rotDeg?: unknown }).rotDeg, 0),
          dx: sanitizeNumber((pose as { dx?: unknown }).dx, 0),
          dy: sanitizeNumber((pose as { dy?: unknown }).dy, 0)
        };
      }
      output[frameId] = normalizedPose;
    }
  }
  return output;
}

function rotateVector(x: number, y: number, angleRad: number): { x: number; y: number } {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos
  };
}

function poseByBone(frameId: string, rigPoseByFrame: Record<string, Record<string, BonePose>>, boneId: string): BonePose {
  const pose = rigPoseByFrame[frameId]?.[boneId];
  return pose ?? { rotDeg: 0 };
}

export function buildPosedRig(frameId: string, rig: RigData, rigPoseByFrame: Record<string, Record<string, BonePose>>): PosedRig {
  const baseJointMap: Record<string, { x: number; y: number }> = {};
  for (const joint of rig.joints) {
    baseJointMap[joint.id] = { x: joint.x, y: joint.y };
  }

  const boneChildren = new Map<string, RigBone[]>();
  const rootBones: RigBone[] = [];
  for (const bone of rig.bones) {
    if (!bone.parentBoneId || !rig.bones.find((candidate) => candidate.id === bone.parentBoneId)) {
      rootBones.push(bone);
      continue;
    }
    const list = boneChildren.get(bone.parentBoneId) ?? [];
    list.push(bone);
    boneChildren.set(bone.parentBoneId, list);
  }

  const jointMap: Record<string, { x: number; y: number }> = { ...baseJointMap };
  const boneStartMap: Record<string, { x: number; y: number }> = {};
  const boneAngleRadMap: Record<string, number> = {};

  const visit = (bone: RigBone, inheritedDeltaRad: number): void => {
    const baseA = baseJointMap[bone.aJointId];
    const baseB = baseJointMap[bone.bJointId];
    if (!baseA || !baseB) return;
    const baseStart = jointMap[bone.aJointId] ?? baseA;
    const pose = poseByBone(frameId, rigPoseByFrame, bone.id);
    const start = { x: baseStart.x + (pose.dx ?? 0), y: baseStart.y + (pose.dy ?? 0) };
    const restVector = { x: baseB.x - baseA.x, y: baseB.y - baseA.y };
    const deltaRad = inheritedDeltaRad + (pose.rotDeg * Math.PI) / 180;
    boneStartMap[bone.id] = start;
    boneAngleRadMap[bone.id] = deltaRad;
    const posedVector = rotateVector(restVector.x, restVector.y, deltaRad);
    jointMap[bone.bJointId] = { x: start.x + posedVector.x, y: start.y + posedVector.y };
    const children = boneChildren.get(bone.id) ?? [];
    for (const child of children) visit(child, deltaRad);
  };

  for (const root of rootBones) {
    visit(root, 0);
  }
  return { jointMap, boneStartMap, boneAngleRadMap };
}

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawRigOverlay(
  ctx: CanvasRenderingContext2D,
  rig: RigData,
  frameId: string,
  rigPoseByFrame: Record<string, Record<string, BonePose>>,
  zoom: number,
  panX: number,
  panY: number,
  selectedJointId: string | null,
  selectedBoneId: string | null
): void {
  if (rig.joints.length === 0) return;
  const posed = buildPosedRig(frameId, rig, rigPoseByFrame);

  for (const bone of rig.bones) {
    const a = posed.boneStartMap[bone.id] ?? posed.jointMap[bone.aJointId];
    const b = posed.jointMap[bone.bJointId];
    if (!a || !b) continue;
    ctx.strokeStyle = bone.id === selectedBoneId ? "#ffd86d" : "#6ed6ff";
    ctx.lineWidth = bone.id === selectedBoneId ? 2.5 : 2;
    ctx.beginPath();
    ctx.moveTo(panX + a.x * zoom + zoom / 2, panY + a.y * zoom + zoom / 2);
    ctx.lineTo(panX + b.x * zoom + zoom / 2, panY + b.y * zoom + zoom / 2);
    ctx.stroke();
  }

  for (const joint of rig.joints) {
    const posedJoint = posed.jointMap[joint.id];
    if (!posedJoint) continue;
    ctx.fillStyle = joint.id === selectedJointId ? "#fff18c" : "#ffffff";
    drawCircle(ctx, panX + posedJoint.x * zoom + zoom / 2, panY + posedJoint.y * zoom + zoom / 2, Math.max(3, zoom * 0.18));
  }
}
