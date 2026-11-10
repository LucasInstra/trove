import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useLanguage } from "../lib/language";

function appWindow() {
  try {
    return getCurrentWindow();
  } catch {
    // the browser preview has no Tauri runtime
    return null;
  }
}

/**
 * Own title bar: no brand (the sidebar already has it), colours from the theme
 * so the bar melts into the page, and the window buttons the platform expects.
 */
export function TitleBar() {
  const { t } = useLanguage();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = appWindow();
    if (!win) return;
    let cancelled = false;
    void win.isMaximized().then((value) => {
      if (!cancelled) setMaximized(value);
    });
    const unlisten = win.onResized(() => {
      void win.isMaximized().then((value) => setMaximized(value));
    });
    return () => {
      cancelled = true;
      void unlisten.then((stop) => stop());
    };
  }, []);

  return (
    <header className="titlebar">
      <div
        className="titlebar-drag"
        data-tauri-drag-region
        onDoubleClick={() => void appWindow()?.toggleMaximize()}
      />

      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-button"
          aria-label={t("common.minimize")}
          onClick={() => void appWindow()?.minimize()}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
            <path d="M1.5 5.5h8" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          type="button"
          className="titlebar-button"
          aria-label={maximized ? t("common.restore") : t("common.maximize")}
          onClick={() => void appWindow()?.toggleMaximize()}
        >
          {maximized ? (
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" fill="none">
              <rect x="1.5" y="3" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="1" />
              <path d="M4 3V2.2A1.2 1.2 0 0 1 5.2 1H9a1 1 0 0 1 1 1v3.8A1.2 1.2 0 0 1 8.8 7H8" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" fill="none">
              <rect x="1.5" y="1.5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="titlebar-button close"
          aria-label={t("common.close")}
          onClick={() => void appWindow()?.close()}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
            <path d="m1.8 1.8 7.4 7.4M9.2 1.8 1.8 9.2" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
