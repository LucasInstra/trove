/**
 * Head yaw and pitch for a flat mascot.
 *
 * The body is a silhouette, not a mesh, so the turn is built from one angle:
 * widths shrink with cos(yaw), face features are projected from a sphere of
 * radius R, and the far side loses depth. Every signal comes from the same
 * yaw, so they cannot disagree.
 */

/** ~22 degrees. Enough to read as a turn without exposing the flat side. */
export const YAW_MAX = 0.38;

/** ~15 degrees. */
export const PITCH_MAX = 0.26;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function yawFor(turn: number): number {
  return clamp(turn, -1, 1) * YAW_MAX;
}

export function pitchFor(tilt: number): number {
  return clamp(tilt, -1, 1) * PITCH_MAX;
}

export interface Projected {
  x: number;
  y: number;
  /** 0 at the silhouette edge, 1 at the center of the face. */
  depth: number;
}

/**
 * Rotates a flat point of the face around the vertical axis of a sphere of
 * radius `radius`. The z of the point is recovered from the sphere equation,
 * with `y` compressed so the face is an ellipsoid rather than a ball.
 */
export function projectFeature(x: number, y: number, radius: number, yaw: number): Projected {
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1;
  const ax = Number.isFinite(x) ? x : 0;
  const ay = Number.isFinite(y) ? y : 0;
  const inside = safeRadius ** 2 - ax ** 2 - (0.6 * ay) ** 2;
  const z = Math.sqrt(Math.max(inside, 0));
  return {
    x: ax * Math.cos(yaw) + z * Math.sin(yaw),
    y: ay,
    depth: z / safeRadius,
  };
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
