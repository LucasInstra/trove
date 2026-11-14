import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const EXIT_MS = 140;

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Small modal dialog: focus moves in, Tab is trapped, Escape closes and
 * focus goes back where it came from.
 */
export function Dialog({ title, onClose, children }: DialogProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  // Leaves the way it came in: the exit plays, then the parent unmounts us.
  // Reduced motion and tests close straight away.
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const instant =
      import.meta.env.MODE === "test" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (instant) {
      closeRef.current();
      return;
    }
    setClosing(true);
    window.setTimeout(() => closeRef.current(), EXIT_MS);
  }, []);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    sheet?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !sheet) return;
      const focusable = sheet.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [requestClose]);

  return (
    <div
      className="dialog-backdrop"
      data-closing={closing || undefined}
      onClick={requestClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        className="dialog-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={requestClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
