// Read at build time only: the site ships no script that talks to GitHub.
// Every call degrades to null, so a rate limit or an offline build still produces a page.
const REPO = "LucasInstra/trove";
const ASSETS = ["trove-setup.msi", "trove-setup.exe", "trove-portable-x64.zip"] as const;

export interface ReleaseFile {
  file: (typeof ASSETS)[number];
  url: string;
  size: number;
}
export interface Release {
  version: string;
  date: string;
  files: ReleaseFile[];
}

async function gh(path: string): Promise<any | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function latestRelease(): Promise<Release | null> {
  const data = await gh("/releases/latest");
  if (!data?.tag_name || !Array.isArray(data.assets)) return null;
  const files: ReleaseFile[] = [];
  for (const file of ASSETS) {
    const a = data.assets.find((x: any) => x.name === file);
    if (a) files.push({ file, url: a.browser_download_url, size: a.size });
  }
  if (files.length === 0) return null;
  return { version: String(data.tag_name).replace(/^v/, ""), date: data.published_at, files };
}

export async function stars(): Promise<number | null> {
  const data = await gh("");
  return typeof data?.stargazers_count === "number" ? data.stargazers_count : null;
}

export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_URL = `${REPO_URL}/releases`;
