export interface Release {
  version: string;
  build: number;
}

export function parseSemver(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(left: string, right: string): number {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

/** Reads the `build` field the updater manifest carries next to the version. */
export function readBuild(rawJson: unknown): number {
  if (rawJson && typeof rawJson === "object" && "build" in rawJson) {
    const value = (rawJson as { build?: unknown }).build;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.trunc(value);
    }
  }
  return 0;
}

/**
 * The plugin only compares semver, so a fix build of the same version would look
 * like "no update". Comparing the build number too is what makes 0.1.0 build 2
 * reach a machine that already runs 0.1.0 build 1.
 */
export function isNewerRelease(current: Release, offered: Release): boolean {
  const order = compareVersions(offered.version, current.version);
  if (order !== 0) return order > 0;
  return offered.build > current.build;
}
