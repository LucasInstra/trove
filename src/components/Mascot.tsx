import { useEffect, useRef, useState } from "react";

export type Mood = "idle" | "happy" | "worried" | "sleepy" | "celebrate";

interface MascotProps {
  mood?: Mood;
  size?: number;
  title?: string;
}

/**
 * The keeper: a coin with a face. It follows the pointer with its pupils,
 * blinks on its own and changes posture with the mood of the month.
 */
export function Mascot({ mood = "idle", size = 56, title }: MascotProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const node = ref.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1.6, distance / 120);
        setGaze({
          x: Math.round((dx / distance) * reach * 10) / 10,
          y: Math.round((dy / distance) * reach * 10) / 10,
        });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    let close = 0;
    let next = 0;
    const tick = () => {
      setBlinking(true);
      close = window.setTimeout(() => setBlinking(false), 120);
      next = window.setTimeout(tick, 2600 + Math.random() * 3600);
    };
    next = window.setTimeout(tick, 2000 + Math.random() * 2400);
    return () => {
      window.clearTimeout(close);
      window.clearTimeout(next);
    };
  }, []);

  const asleep = mood === "sleepy";
  const cheerful = mood === "happy" || mood === "celebrate";
  const pupil = asleep ? { x: 0, y: 0 } : gaze;

  return (
    <svg
      ref={ref}
      className={`mascot mascot-${mood}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <radialGradient id="keeper-face" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#ffd978" />
          <stop offset="58%" stopColor="#f0b93f" />
          <stop offset="100%" stopColor="#d9971f" />
        </radialGradient>
      </defs>

      <ellipse className="mascot-shadow" cx="50" cy="92" rx="19" ry="4" />

      <g className="mascot-body">
        <ellipse cx="40" cy="85" rx="7" ry="4" fill="#c98a1c" />
        <ellipse cx="60" cy="85" rx="7" ry="4" fill="#c98a1c" />

        <g className="mascot-arm mascot-arm-left">
          <path
            d="M22 52c-7 2-11 7-11 12"
            stroke="#d9971f"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />
        </g>
        <g className="mascot-arm mascot-arm-right">
          <path
            d="M78 52c7 2 11 7 11 12"
            stroke="#d9971f"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        <circle cx="50" cy="50" r="34" fill="url(#keeper-face)" />
        <circle
          cx="50"
          cy="50"
          r="27"
          fill="none"
          stroke="#c98a1c"
          strokeWidth="2"
          opacity="0.5"
        />
        <path
          d="M29 36a28 28 0 0 1 14-10"
          stroke="#fff6dd"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          opacity="0.55"
        />

        <ellipse cx="36" cy="60" rx="5" ry="3" fill="#e08b3d" opacity="0.22" />
        <ellipse cx="64" cy="60" rx="5" ry="3" fill="#e08b3d" opacity="0.22" />

        {asleep ? (
          <g stroke="#3a2a10" strokeWidth="2.2" strokeLinecap="round" fill="none">
            <path d="M33 48q5 4 10 0" />
            <path d="M57 48q5 4 10 0" />
          </g>
        ) : cheerful ? (
          <g stroke="#3a2a10" strokeWidth="2.6" strokeLinecap="round" fill="none">
            <path d="M33 49q5-6 10 0" />
            <path d="M57 49q5-6 10 0" />
          </g>
        ) : (
          <g fill="#3a2a10">
            <g transform="translate(38 47)">
              <ellipse cx="0" cy="0" rx="4.5" ry={blinking ? 0.9 : 5.4} />
              {!blinking ? (
                <circle cx={pupil.x - 1.1} cy={pupil.y - 1.6} r="1.35" fill="#fff8e6" opacity="0.8" />
              ) : null}
            </g>
            <g transform="translate(62 47)">
              <ellipse cx="0" cy="0" rx="4.5" ry={blinking ? 0.9 : 5.4} />
              {!blinking ? (
                <circle cx={pupil.x - 1.1} cy={pupil.y - 1.6} r="1.35" fill="#fff8e6" opacity="0.8" />
              ) : null}
            </g>
          </g>
        )}

        {mood === "worried" ? (
          <g stroke="#3a2a10" strokeWidth="2" strokeLinecap="round">
            <path d="M31 39l8 3" />
            <path d="M69 39l-8 3" />
          </g>
        ) : null}

        {mood === "worried" ? (
          <path
            d="M43 64q7-5 14 0"
            stroke="#3a2a10"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        ) : mood === "sleepy" ? (
          <path
            d="M47 62q3 2 6 0"
            stroke="#3a2a10"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M42 59q8 7 16 0"
            stroke="#3a2a10"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {mood === "celebrate" ? (
          <g className="mascot-sparkles" fill="#f0b93f">
            <path d="M18 30l1.6 3.4L23 35l-3.4 1.6L18 40l-1.6-3.4L13 35l3.4-1.6z" />
            <path d="M83 26l1.3 2.7 2.7 1.3-2.7 1.3L83 34l-1.3-2.7-2.7-1.3 2.7-1.3z" />
            <path d="M80 62l1.1 2.3 2.3 1.1-2.3 1.1L80 69l-1.1-2.3-2.3-1.1 2.3-1.1z" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
