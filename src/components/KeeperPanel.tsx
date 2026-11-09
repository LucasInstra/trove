import { useEffect } from "react";
import {
  EYE_LABELS,
  KEEPER_COLORS,
  KEEPER_DEFAULT,
  KEEPER_EYE_COLORS,
  KEEPER_EYES,
  KEEPER_EYE_SIZES,
  KEEPER_EYE_SPACINGS,
  KEEPER_EYE_TILTS,
  KEEPER_SHAPES,
  SHAPE_LABELS,
  SIZE_LABELS,
  SPACING_LABELS,
  TILT_LABELS,
  type KeeperLook,
} from "../lib/keeper";
import { Mascot } from "./Mascot";

interface KeeperPanelProps {
  look: KeeperLook;
  onChange: (look: KeeperLook) => void;
  onClose: () => void;
}

const TOGGLES: Array<{ key: keyof KeeperLook; label: string }> = [
  { key: "snout", label: "Snout" },
  { key: "ears", label: "Ears" },
  { key: "slot", label: "Coin slot" },
  { key: "tail", label: "Curly tail" },
  { key: "blush", label: "Blush" },
];

export function KeeperPanel({ look, onChange, onClose }: KeeperPanelProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof KeeperLook>(key: K, value: KeeperLook[K]) =>
    onChange({ ...look, [key]: value });

  return (
    <div className="keeper-backdrop" onClick={onClose} role="presentation">
      <aside
        className="keeper-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Customize the keeper"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="keeper-sheet-head">
          <div>
            <h2>Your keeper</h2>
            <p className="muted">He guards the trove. Make him yours.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="keeper-preview">
          <Mascot look={look} size={148} mood="idle" />
        </div>

        <section className="keeper-section">
          <h3>Body</h3>
          <div className="chips">
            {KEEPER_SHAPES.map((shape) => (
              <button
                key={shape}
                type="button"
                className={look.shape === shape ? "chip active" : "chip"}
                onClick={() => set("shape", shape)}
              >
                {SHAPE_LABELS[shape]}
              </button>
            ))}
          </div>

          <div className="swatches">
            {KEEPER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={look.color.toLowerCase() === color ? "swatch active" : "swatch"}
                style={{ background: color }}
                onClick={() => set("color", color)}
                aria-label={`Colour ${color}`}
              />
            ))}
            <label className="swatch custom" title="Custom colour">
              <input
                type="color"
                value={look.color}
                onChange={(event) => set("color", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="keeper-section">
          <h3>Eyes</h3>
          <div className="chips">
            {KEEPER_EYES.map((eye) => (
              <button
                key={eye}
                type="button"
                className={look.eyeStyle === eye ? "chip active" : "chip"}
                onClick={() => set("eyeStyle", eye)}
              >
                {EYE_LABELS[eye]}
              </button>
            ))}
          </div>

          <div className="keeper-rows">
            <div className="keeper-row">
              <span className="keeper-row-label">Size</span>
              <div className="segmented">
                {KEEPER_EYE_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={look.eyeSize === size ? "active" : ""}
                    onClick={() => set("eyeSize", size)}
                  >
                    {SIZE_LABELS[size]}
                  </button>
                ))}
              </div>
            </div>
            <div className="keeper-row">
              <span className="keeper-row-label">Spacing</span>
              <div className="segmented">
                {KEEPER_EYE_SPACINGS.map((spacing) => (
                  <button
                    key={spacing}
                    type="button"
                    className={look.eyeSpacing === spacing ? "active" : ""}
                    onClick={() => set("eyeSpacing", spacing)}
                  >
                    {SPACING_LABELS[spacing]}
                  </button>
                ))}
              </div>
            </div>
            <div className="keeper-row">
              <span className="keeper-row-label">Tilt</span>
              <div className="segmented">
                {KEEPER_EYE_TILTS.map((tilt) => (
                  <button
                    key={tilt}
                    type="button"
                    className={look.eyeTilt === tilt ? "active" : ""}
                    onClick={() => set("eyeTilt", tilt)}
                  >
                    {TILT_LABELS[tilt]}
                  </button>
                ))}
              </div>
            </div>
            <div className="keeper-row">
              <span className="keeper-row-label">Ink</span>
              <div className="swatches small">
                {KEEPER_EYE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={look.eyeColor === color ? "swatch active" : "swatch"}
                    style={
                      color === "auto"
                        ? { background: "linear-gradient(135deg, #241d33 50%, #fff6dd 50%)" }
                        : { background: color }
                    }
                    onClick={() => set("eyeColor", color)}
                    aria-label={color === "auto" ? "Automatic eye colour" : `Eye colour ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="keeper-section">
          <h3>Details</h3>
          <div className="toggles">
            {TOGGLES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={Boolean(look[key])}
                className={look[key] ? "toggle on" : "toggle"}
                onClick={() => set(key, !look[key] as KeeperLook[typeof key])}
              >
                <span>{label}</span>
                <span className="toggle-track">
                  <span className="toggle-knob" />
                </span>
              </button>
            ))}
          </div>
        </section>

        <footer className="keeper-sheet-foot">
          <button type="button" onClick={() => onChange(KEEPER_DEFAULT)}>
            Reset look
          </button>
          <button type="button" className="primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </aside>
    </div>
  );
}
