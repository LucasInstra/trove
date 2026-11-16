import type { CSSProperties } from "react";
import { Icon3D, type Icon3DName } from "./Icon3D";
import { Icon3DSet } from "./Icon3DSet";

/**
 * The pictures a goal can wear. The key is what gets stored with the goal, so
 * the first 17 are the keys goals already carry; the rest are new. A key shows
 * either one of the core renders (`CORE`) or a file from the second batch
 * (`ALIAS` when the file has another name, otherwise the key is the file name).
 */
const CORE: Record<string, Icon3DName> = {
  target: "target",
  piggy: "piggy",
  plane: "plane",
};

const ALIAS: Record<string, string> = {
  house: "goal-house",
  car: "more-car",
  ring: "goal-wedding",
  cap: "cat-education",
  laptop: "goal-laptop",
  beach: "goal-vacation",
  heart: "cat-health",
  baby: "goal-baby",
  paw: "cat-pets",
  tool: "more-wrench",
  gift: "cat-gift",
  chart: "an-chart-up",
  shield: "sec-shield-check",
  phone: "goal-phone",
};

const LEGACY = [
  "target", "piggy", "house", "plane", "car", "ring", "cap", "laptop", "beach",
  "heart", "baby", "paw", "tool", "gift", "chart", "shield", "phone",
];

const NEW_GOALS = [
  "goal-car-key", "goal-scooter", "goal-bike", "goal-camera", "goal-headphones", "goal-console",
  "goal-rainy-day", "goal-emergency", "goal-debt-free", "goal-retirement", "goal-health",
  "goal-business", "goal-holiday", "goal-events", "goal-renovation", "goal-degree",
  "goal-world-trip", "goal-savings-jar",
  "more-sneakers", "more-dumbbell", "more-guitar", "more-tent", "more-sailboat", "more-garden",
  "more-sofa", "more-fridge", "more-tv", "more-smartwatch", "more-glasses", "more-dentist",
  "more-medication", "more-solar", "more-ev-charge", "more-land", "more-apartment", "more-moving",
  "more-passport", "more-backpack", "more-soccer", "more-surf",
];

const GOAL_ICONS = [...LEGACY, ...NEW_GOALS];

export function GoalIcon({ name, size = 30 }: { name: string | undefined; size?: number }) {
  const key = name ?? "";
  if (key in CORE) return <Icon3D name={CORE[key]} size={size} />;
  const file = ALIAS[key] ?? (NEW_GOALS.includes(key) ? key : "");
  return file ? <Icon3DSet name={file} size={size} /> : <Icon3D name="target" size={size} />;
}

/** The grid of pictures in the goal dialog: one radio group, ringed with the goal's colour. */
export function GoalIconPicker({
  value,
  color,
  label,
  onChange,
  nameOf,
}: {
  value: string;
  color: string;
  label: string;
  onChange: (name: string) => void;
  nameOf: (name: string) => string;
}) {
  return (
    <div className="icon-picker" role="radiogroup" aria-label={label}>
      {GOAL_ICONS.map((name) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === name}
          aria-label={nameOf(name)}
          title={nameOf(name)}
          className="icon-picker-item"
          data-selected={value === name || undefined}
          style={{ "--goal-color": color } as CSSProperties}
          onClick={() => onChange(name)}
        >
          <GoalIcon name={name} size={32} />
        </button>
      ))}
    </div>
  );
}
