export type Theme = "light" | "dark";

const KEY = "trove.theme";

export function loadTheme(): Theme {
  try {
    return window.localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function saveTheme(theme: Theme) {
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    // a private window keeps the choice for this session only
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}
