import { useLayoutEffect, useRef, useState } from "react";

/** dd/mm/yyyy or yyyy-mm-dd to ISO; "" for an empty field, null when it is not a real date. */
export function parseDate(raw: string): string | null {
  const text = raw.trim();
  if (text === "") return "";
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text) ?? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [y, m, d] = match[3].length === 4 && match[1].length <= 2 ? [match[3], match[2], match[1]] : [match[1], match[2], match[3]];
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const check = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso ? null : iso;
}

/**
 * Keeps only the digits and puts the separators in as they are typed
 * (dd/mm/yyyy, or yyyy-mm-dd in English). A separator appears once a digit
 * follows it, so backspace never gets stuck on it.
 */
export function maskDate(raw: string, lang: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const cuts = lang === "pt" ? [2, 4] : [4, 6];
  const sep = lang === "pt" ? "/" : "-";
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (cuts.includes(i)) out += sep;
    out += digits[i];
  }
  return out;
}

/** A date typed as text, so the format and the placeholder follow the app language, not the browser's. */
export function DateCell({
  value,
  onCommit,
  label,
  lang,
  className = "sheet-input date",
}: {
  value: string;
  onCommit: (iso: string) => void;
  label: string;
  lang: string;
  className?: string;
}) {
  const shown = lang === "pt" ? brDate(value) : value;
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // Where the caret goes once the mask has rewritten the text; React would otherwise park it at the end.
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current !== null && input.current) input.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });
  const commit = () => {
    if (draft !== null && draft !== shown) {
      const iso = parseDate(draft);
      if (iso !== null && iso !== value) onCommit(iso);
    }
    setDraft(null);
  };
  return (
    <input
      ref={input}
      className={className}
      type="text"
      inputMode="numeric"
      value={draft ?? shown}
      placeholder={lang === "pt" ? "dd/mm/aaaa" : "yyyy-mm-dd"}
      maxLength={10}
      aria-label={label}
      onChange={(event) => {
        const raw = event.target.value;
        const masked = maskDate(raw, lang);
        // Keep the caret after the same number of digits it had before the mask added its separators.
        const digitsBefore = raw.slice(0, event.target.selectionStart ?? raw.length).replace(/\D/g, "").length;
        let at = 0;
        let seen = 0;
        while (at < masked.length && seen < digitsBefore) {
          if (/\d/.test(masked[at])) seen += 1;
          at += 1;
        }
        if (seen === digitsBefore && /\D/.test(masked[at] ?? "")) at += 1;
        caret.current = at;
        setDraft(masked);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setDraft(null);
      }}
    />
  );
}

export function brDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}
