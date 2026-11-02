"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createDemoState, demoStateSchema, readStoredState, STORAGE_KEY, type DemoState } from "./data";

type Change = (state: DemoState) => DemoState;
type DemoContextValue = {
  state: DemoState;
  ready: boolean;
  storageWarning: string | null;
  update: (change: Change) => void;
  reset: () => void;
};
const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(createDemoState);
  const current = useRef(state);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const saved = readStoredState(raw);
        current.current = saved;
        setState(saved);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current.current));
      }
    } catch {
      setStorageWarning("Saved data could not be loaded. This tab is using a temporary sample copy. Reset demo to save a fresh copy.");
    }
    setReady(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        const next = event.newValue === null ? createDemoState() : readStoredState(event.newValue);
        current.current = next;
        setState(next);
      } catch {
        setStorageWarning("Another tab saved invalid data. This tab kept its last valid copy.");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((change: Change) => {
    // Validate before changing either the UI or the persisted copy. The ref also
    // prevents back-to-back actions from writing over a more recent update.
    const next = demoStateSchema.parse(change(current.current));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageWarning(null);
    } catch {
      setStorageWarning("Browser storage is unavailable or full. Changes work in this tab but will not survive a reload.");
    }
    current.current = next;
    setState(next);
  }, []);

  const reset = useCallback(() => update(() => createDemoState()), [update]);

  return <DemoContext.Provider value={{ state, ready, storageWarning, update, reset }}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("DemoProvider is required.");
  return value;
}
