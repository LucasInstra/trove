import { getCurrentWindow } from "@tauri-apps/api/window";

function appWindow() {
  try {
    return getCurrentWindow();
  } catch {
    // the browser preview has no Tauri runtime
    return null;
  }
}

export function TitleBar({ title }: { title: string }) {
  return (
    <header className="titlebar">
      <div
        className="titlebar-drag"
        data-tauri-drag-region
        onDoubleClick={() => void appWindow()?.toggleMaximize()}
      >
        <span className="titlebar-mark" data-tauri-drag-region>
          t
        </span>
        <span className="titlebar-name" data-tauri-drag-region>
          {title}
        </span>
      </div>

      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-button"
          aria-label="Minimize"
          onClick={() => void appWindow()?.minimize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 5h8" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          type="button"
          className="titlebar-button"
          aria-label="Maximize"
          onClick={() => void appWindow()?.toggleMaximize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          type="button"
          className="titlebar-button close"
          aria-label="Close"
          onClick={() => void appWindow()?.close()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="m1.5 1.5 7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
