/**
 * Head yaw and pitch for a flat mascot.
 *
 * The head is a silhouette with a face plate on the front, not a mesh, so the
 * turn is built from one angle: the body and the plate both squash with
 * cos(yaw), a feature loses width with featureDepth, and a tilt squashes the
 * height. Every signal comes from the same yaw, so they cannot disagree.
 */

/** ~34 degrees. Enough to read as a turn while the plate stays legible. */
export const YAW_MAX = 0.6;

/** ~15 degrees. */
export const PITCH_MAX = 0.26;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function yawFor(turn: number): number {
  return clamp(turn, -1, 1) * YAW_MAX;
}

export function pitchFor(tilt: number): number {
  return clamp(tilt, -1, 1) * PITCH_MAX;
}

/**
 * How much a point at `azimuth` (0 = facing the viewer) still faces the viewer
 * after the head turns by `yaw`. 1 is square on, 0 is the profile.
 */
export function featureDepth(azimuth: number, yaw: number): number {
  return Math.max(0, Math.cos(azimuth + yaw));
}

/** Vertical squash for a head tilting up or down. */
export function pitchScale(pitch: number): number {
  return 1 - 0.05 * Math.abs(pitch) / PITCH_MAX;
}
