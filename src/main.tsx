import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LanguageProvider } from "./lib/language";
// Global CSS. The cascade order below is intentional; do not reorder.
//   1. fonts, tokens        design tokens (:root variables) and bundled fonts
//   2. base                 resets and the original app styles
//   3. tailwind             layered utilities, above the base reset
//   4. charts, ledger       feature styles
//   5. design, theme        warm-frame overrides on top of base
//   6. controls, redesign   latest layer, wins over everything above
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/tailwind.css";
import "./styles/charts.css";
import "./styles/charts-hover.css";
import "./styles/ledger.css";
import "./styles/design.css";
import "./styles/theme.css";
import "./styles/controls.css";
import "./styles/redesign.css";

const container = document.getElementById("root");
if (!container) throw new Error("root element is missing");

createRoot(container).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
