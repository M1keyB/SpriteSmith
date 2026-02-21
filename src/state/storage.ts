import type { ProjectData, StoredPalette } from "../types/models";
import { normalizeProjectFrames } from "../editor/layers";

const PROJECTS_KEY = "spritesmith_projects";
const PALETTES_KEY = "spritesmith_saved_palettes";
const AUTOSAVE_KEY = "spritesmith_autosave";
const LEGACY_SPRITELAB_PROJECTS_KEY = "spritelab_projects";
const LEGACY_SPRITELAB_PALETTES_KEY = "spritelab_saved_palettes";
const LEGACY_SPRITELAB_AUTOSAVE_KEY = "spritelab_autosave";
const LEGACY_PROJECTS_KEY = "pixelforge_projects";
const LEGACY_PALETTES_KEY = "pixelforge_saved_palettes";
const LEGACY_AUTOSAVE_KEY = "pixelforge_autosave";

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveProjectToStore(project: ProjectData): void {
  const all = safeJsonParse<ProjectData[]>(localStorage.getItem(PROJECTS_KEY)) ?? [];
  const without = all.filter((p) => p.name !== project.name);
  without.push(project);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(without));
}

export function loadProjectsFromStore(): ProjectData[] {
  const projects =
    safeJsonParse<ProjectData[]>(localStorage.getItem(PROJECTS_KEY)) ??
    safeJsonParse<ProjectData[]>(localStorage.getItem(LEGACY_SPRITELAB_PROJECTS_KEY)) ??
    safeJsonParse<ProjectData[]>(localStorage.getItem(LEGACY_PROJECTS_KEY)) ??
    [];
  return projects.map((project) => normalizeProjectFrames(project));
}

export function savePaletteToStore(palette: StoredPalette): void {
  const all = safeJsonParse<StoredPalette[]>(localStorage.getItem(PALETTES_KEY)) ?? [];
  const without = all.filter((p) => p.id !== palette.id);
  without.push(palette);
  localStorage.setItem(PALETTES_KEY, JSON.stringify(without));
}

export function loadPalettesFromStore(): StoredPalette[] {
  return (
    safeJsonParse<StoredPalette[]>(localStorage.getItem(PALETTES_KEY)) ??
    safeJsonParse<StoredPalette[]>(localStorage.getItem(LEGACY_SPRITELAB_PALETTES_KEY)) ??
    safeJsonParse<StoredPalette[]>(localStorage.getItem(LEGACY_PALETTES_KEY)) ??
    []
  );
}

export function autoSaveProject(project: ProjectData): void {
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
}

export function loadAutoSavedProject(): ProjectData | null {
  const project =
    safeJsonParse<ProjectData>(localStorage.getItem(AUTOSAVE_KEY)) ??
    safeJsonParse<ProjectData>(localStorage.getItem(LEGACY_SPRITELAB_AUTOSAVE_KEY)) ??
    safeJsonParse<ProjectData>(localStorage.getItem(LEGACY_AUTOSAVE_KEY));
  return project ? normalizeProjectFrames(project) : null;
}

export function exportProjectJson(project: ProjectData): Blob {
  return new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
}

export async function importProjectJson(file: File): Promise<ProjectData> {
  const text = await file.text();
  const project = JSON.parse(text) as ProjectData;
  if (!project.frames || !project.gridWidth || !project.gridHeight) {
    throw new Error("Invalid project file");
  }
  return normalizeProjectFrames(project);
}
