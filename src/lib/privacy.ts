import { useSyncExternalStore } from "react";

/** Money shown as dots while the eye is closed. A module flag, so every formatter obeys it. */
export const MASK = "R$ ••••";
const KEY = "trove.privacy";

let hidden = (() => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

export const isPrivate = (): boolean => hidden;

export function setPrivate(next: boolean): void {
  hidden = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // Private windows can refuse storage; the toggle still works for the session.
  }
  listeners.forEach((listener) => listener());
}

/** Subscribes the caller so it re-renders when the eye is toggled. */
export function usePrivacy(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isPrivate,
  );
}
