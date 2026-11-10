import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { translate, type Lang, type Translate } from "./i18n";

interface LanguageValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
}

const STORAGE_KEY = "trove.lang";

function loadLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "pt" ? "pt" : "en";
  } catch {
    return "en";
  }
}

const LanguageContext = createContext<LanguageValue>({
  lang: "en",
  setLang: () => {},
  t: (key, vars) => translate("en", key, vars),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => loadLang());

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // a private window without storage should keep the in-memory choice
    }
  }, []);

  const value = useMemo<LanguageValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  return useContext(LanguageContext);
}
