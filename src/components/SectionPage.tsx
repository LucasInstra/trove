import { createContext, useContext, type ReactNode } from "react";

/**
 * A sidebar entry can hold several related screens behind tabs. The screen
 * inside keeps rendering its own header; this frame lends that header the
 * section name and the tab bar, so every page reads the same way.
 */
const ScreenFrame = createContext<{ eyebrow: string; tabs: ReactNode } | null>(null);

export function useScreenFrame() {
  return useContext(ScreenFrame);
}

export function SectionPage<T extends string>({
  eyebrow,
  tabs,
  active,
  onTab,
  children,
}: {
  eyebrow: string;
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onTab: (id: T) => void;
  children: ReactNode;
}) {
  const bar =
    tabs.length > 1 ? (
      <div className="screen-tabs" role="tablist" aria-label={eyebrow}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            className={tab.id === active ? "is-active" : undefined}
            onClick={() => onTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    ) : null;
  return <ScreenFrame.Provider value={{ eyebrow, tabs: bar }}>{children}</ScreenFrame.Provider>;
}
