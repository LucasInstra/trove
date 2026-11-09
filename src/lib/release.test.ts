import { describe, expect, it } from "vitest";
import { compareVersions, isNewerRelease, readBuild } from "./release";

describe("compareVersions", () => {
  it("orders numerically, not alphabetically", () => {
    expect(compareVersions("0.10.0", "0.9.0")).toBe(1);
    expect(compareVersions("0.9.0", "0.10.0")).toBe(-1);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  it("tolerates a leading v and ignores pre-release noise", () => {
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("1.2.4-beta", "1.2.3")).toBe(1);
  });
});

describe("readBuild", () => {
  it("reads a positive integer build from the manifest", () => {
    expect(readBuild({ build: 2 })).toBe(2);
    expect(readBuild({ build: "3" })).toBe(0);
    expect(readBuild({ build: -1 })).toBe(0);
    expect(readBuild(null)).toBe(0);
    expect(readBuild("nope")).toBe(0);
  });
});

describe("isNewerRelease", () => {
  it("accepts a higher version", () => {
    expect(
      isNewerRelease({ version: "0.1.0", build: 1 }, { version: "0.2.0", build: 1 }),
    ).toBe(true);
  });

  it("rejects the same version with the same build", () => {
    expect(
      isNewerRelease({ version: "0.1.0", build: 1 }, { version: "0.1.0", build: 1 }),
    ).toBe(false);
  });

  it("accepts the same version with a higher build", () => {
    expect(
      isNewerRelease({ version: "0.1.0", build: 1 }, { version: "0.1.0", build: 2 }),
    ).toBe(true);
  });

  it("rejects an older version even when the build is higher", () => {
    expect(
      isNewerRelease({ version: "0.2.0", build: 1 }, { version: "0.1.0", build: 9 }),
    ).toBe(false);
  });
});
