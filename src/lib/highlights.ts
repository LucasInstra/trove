export interface Highlight {
  title: string;
  /** The first sentences that follow the title, so the item explains itself. Empty when there are none. */
  detail: string;
}

const strip = (text: string) => text.replace(/[`*_]/g, "").trim();

/**
 * The list a person reads about a release: each bullet of the notes as its bold lead-in
 * ("**Salary in the summary.** The long explanation..." gives the title "Salary in the summary")
 * and the first two sentences after it. A bullet with no bold lead-in gives its first sentence
 * as the title. At most `limit` items.
 */
export function highlights(markdown: string, limit = 9): Highlight[] {
  const items: Highlight[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (!bullet) continue;
    const text = bullet[1].trim();
    const bold = /^\*\*(.+?)\*\*\s*(.*)$/.exec(text);
    const sentences = (value: string) => value.split(/(?<=[.!?])\s+/).filter(Boolean);
    const title = bold ? strip(bold[1]).replace(/[.:]\s*$/, "") : strip(sentences(text)[0] ?? "").replace(/[.:]\s*$/, "");
    const detail = bold ? strip(sentences(bold[2]).slice(0, 2).join(" ")) : strip(sentences(text).slice(1, 3).join(" "));
    if (title) items.push({ title, detail });
    if (items.length >= limit) break;
  }
  return items;
}

/** The first paragraph after the title: what the release is about, in one line. */
export function summary(markdown: string): string {
  for (const line of markdown.split(/\r?\n/)) {
    const text = line.trim();
    if (text && !text.startsWith("#") && !/^[-*]\s/.test(text)) return text;
  }
  return "";
}
