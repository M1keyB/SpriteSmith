import { useEffect } from "react";
import type { Dispatch } from "react";
import type { EditorState } from "../types/models";
import type { EditorAction } from "./editorReducer";

export function useKeyboardShortcuts(dispatch: Dispatch<EditorAction>, state: EditorState): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? event.metaKey : event.ctrlKey;

      if (mod && key === "z" && event.shiftKey) {
        event.preventDefault();
        dispatch({ type: "REDO" });
        return;
      }
      if (!isMac && mod && key === "y") {
        event.preventDefault();
        dispatch({ type: "REDO" });
        return;
      }
      if (mod && key === "z") {
        event.preventDefault();
        dispatch({ type: "UNDO" });
        return;
      }
      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        dispatch({
          type: "SET_ACTIVE_FRAME",
          frameIndex: Math.min(state.project.frames.length - 1, state.activeFrameIndex + 1)
        });
        return;
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        dispatch({ type: "SET_ACTIVE_FRAME", frameIndex: Math.max(0, state.activeFrameIndex - 1) });
        return;
      }
      if (key === "b") dispatch({ type: "SET_TOOL", tool: "pencil" });
      if (key === "e") dispatch({ type: "SET_TOOL", tool: "eraser" });
      if (key === "g") dispatch({ type: "SET_TOOL", tool: "fill" });
      if (key === "i") dispatch({ type: "SET_TOOL", tool: "picker" });
      if (key === "m") dispatch({ type: "SET_TOOL", tool: "select" });
      if (key === "v") dispatch({ type: "SET_TOOL", tool: "auto-remove" });
      if (key === "h") dispatch({ type: "SET_TOOL", tool: "grab" });
      if (key === "r") dispatch({ type: "SET_TOOL", tool: "rotate" });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, state.activeFrameIndex, state.project.frames.length]);
}
