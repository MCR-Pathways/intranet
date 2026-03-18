"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";

// ─── localStorage persistence (same pattern as resource-tree.tsx) ────────────

const EDITOR_MODE_KEY = "resources-editor-mode";
const EDITOR_EVENT = "mcr-resources-editor";

function subscribe(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === EDITOR_MODE_KEY || event.key === null) callback();
  };
  window.addEventListener(EDITOR_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(EDITOR_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): string {
  try {
    return localStorage.getItem(EDITOR_MODE_KEY) === "true" ? "true" : "false";
  } catch {
    return "false";
  }
}

const SERVER_SNAPSHOT = "false";

function dispatch() {
  window.dispatchEvent(new CustomEvent(EDITOR_EVENT));
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface EditorModeContextValue {
  editorMode: boolean;
  canEdit: boolean;
  toggleEditorMode: () => void;
}

const EditorModeContext = createContext<EditorModeContextValue>({
  editorMode: false,
  canEdit: false,
  toggleEditorMode: () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

interface EditorModeProviderProps {
  canEdit: boolean;
  children: React.ReactNode;
}

export function EditorModeProvider({
  canEdit,
  children,
}: EditorModeProviderProps) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
  const editorMode = canEdit && raw === "true";

  const toggleEditorMode = useCallback(() => {
    try {
      const next = localStorage.getItem(EDITOR_MODE_KEY) !== "true";
      localStorage.setItem(EDITOR_MODE_KEY, String(next));
      dispatch();
    } catch {
      // localStorage unavailable
    }
  }, []);

  return (
    <EditorModeContext.Provider value={{ editorMode, canEdit, toggleEditorMode }}>
      {children}
    </EditorModeContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useEditorMode() {
  return useContext(EditorModeContext);
}
