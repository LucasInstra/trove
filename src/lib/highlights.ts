/**
 * The short list a person reads about a release: the bold lead-in of each bullet of the notes
 * ("**Salary in the summary.** The long explanation..." becomes "Salary in the summary").
 * A bullet with no bold lead-in gives its first sentence. At most `limit` items.
 */
export function highlights(markdown: string, limit = 5): string[] {
  const items: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (!bullet) continue;
    const text = bullet[1].trim();
    const bold = /^\*\*(.+?)\*\*/.exec(text);
    const lead = bold ? bold[1] : text.split(/(?<=[.!?])\s/)[0];
    const clean = lead.replace(/[.:]\s*$/, "").replace(/[`*_]/g, "").trim();
    if (clean) items.push(clean);
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
