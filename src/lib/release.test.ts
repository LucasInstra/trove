import { describe, expect, it } from "vitest";
import { compareVersions, isNewerRelease, parseSemver, readBuild } from "./release";

describe("parseSemver", () => {
  it("reads the three numbers and ignores a build suffix", () => {
    expect(parseSemver("0.1.2")).toEqual([0, 1, 2]);
    expect(parseSemver("v0.1.2")).toEqual([0, 1, 2]);
    // The manifest announces a fix build as `0.1.2-b3`.
    expect(parseSemver("0.1.2-b3")).toEqual([0, 1, 2]);
    expect(parseSemver("nonsense")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("orders by number, not by string", () => {
    expect(compareVersions("0.1.10", "0.1.9")).toBe(1);
    expect(compareVersions("0.1.2", "0.1.2-b3")).toBe(0);
    expect(compareVersions("1.0.0", "0.9.9")).toBe(1);
  });
});

describe("readBuild", () => {
  it("takes the build field when the manifest carries one", () => {
    expect(readBuild({ build: 3 })).toBe(3);
    expect(readBuild({ build: "3" })).toBe(0);
    expect(readBuild({ build: 0 })).toBe(0);
    expect(readBuild(null)).toBe(0);
    expect(readBuild("3")).toBe(0);
  });
});

describe("isNewerRelease", () => {
  it("treats a higher build of the same version as an update", () => {
    expect(
      isNewerRelease({ version: "0.1.2", build: 2 }, { version: "0.1.2", build: 3 }),
    ).toBe(true);
    expect(
      isNewerRelease({ version: "0.1.2", build: 3 }, { version: "0.1.2", build: 3 }),
    ).toBe(false);
    expect(
      isNewerRelease({ version: "0.1.2", build: 3 }, { version: "0.1.2", build: 2 }),
    ).toBe(false);
  });

  it("still lets a real version win over any build", () => {
    expect(
      isNewerRelease({ version: "0.1.2", build: 9 }, { version: "0.1.3", build: 1 }),
    ).toBe(true);
    expect(
      isNewerRelease({ version: "0.1.3", build: 1 }, { version: "0.1.2", build: 9 }),
    ).toBe(false);
  });
});
