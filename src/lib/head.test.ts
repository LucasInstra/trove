import { describe, expect, it } from "vitest";
import {
  featureDepth,
  PITCH_MAX,
  pitchFor,
  pitchScale,
  projectFeature,
  YAW_MAX,
  yawFor,
} from "./head";

describe("yawFor", () => {
  it("is zero at the center and clamps the extremes", () => {
    expect(yawFor(0)).toBe(0);
    expect(yawFor(1)).toBeCloseTo(YAW_MAX);
    expect(yawFor(-1)).toBeCloseTo(-YAW_MAX);
    expect(yawFor(4)).toBeCloseTo(YAW_MAX);
    expect(yawFor(-4)).toBeCloseTo(-YAW_MAX);
  });

  it("is monotonic", () => {
    const values = [-1, -0.5, 0, 0.5, 1].map(yawFor);
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]).toBeGreaterThan(values[index - 1]);
    }
  });
});

describe("projectFeature", () => {
  const radius = 30;

  it("is the identity at yaw zero", () => {
    const point = projectFeature(12, -4, radius, 0);
    expect(point.x).toBeCloseTo(12);
    expect(point.depth).toBeCloseTo(Math.sqrt(radius ** 2 - 12 ** 2 - (0.6 * -4) ** 2) / radius);
  });

  it("moves the center of the face towards the look direction", () => {
    expect(projectFeature(0, 0, radius, 0.2).x).toBeGreaterThan(0);
    expect(projectFeature(0, 0, radius, -0.2).x).toBeLessThan(0);
    expect(projectFeature(0, 0, radius, 0.2).x).toBeGreaterThan(
      projectFeature(0, 0, radius, 0.1).x,
    );
  });

  it("keeps the profile edge inside the sphere and compresses it", () => {
    const edge = projectFeature(radius * 0.99, 0, radius, YAW_MAX);
    expect(Math.abs(edge.x)).toBeLessThanOrEqual(radius);
    expect(edge.x).toBeLessThan(radius * 0.99);
  });

  it("survives invalid input", () => {
    expect(Number.isFinite(projectFeature(Number.NaN, 0, radius, 0.2).x)).toBe(true);
    expect(Number.isFinite(projectFeature(10, 0, 0, 0.2).x)).toBe(true);
  });
});

describe("featureDepth", () => {
  it("is one when the feature faces the viewer", () => {
    expect(featureDepth(0, 0)).toBeCloseTo(1);
  });

  it("drops as the head turns away", () => {
    const values = [0, 0.2, 0.4, 0.8, 1.4].map((yaw) => featureDepth(0, yaw));
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]).toBeLessThan(values[index - 1]);
    }
    expect(featureDepth(0, Math.PI / 2)).toBeCloseTo(0);
  });

  it("never goes negative", () => {
    expect(featureDepth(0, Math.PI)).toBe(0);
  });
});

describe("pitch", () => {
  it("maps the gaze and squashes the body", () => {
    expect(pitchFor(0)).toBe(0);
    expect(pitchFor(1)).toBeCloseTo(PITCH_MAX);
    expect(pitchScale(0)).toBe(1);
    expect(pitchScale(pitchFor(1))).toBeCloseTo(0.95);
    expect(pitchScale(pitchFor(-1))).toBeCloseTo(0.95);
  });
});
