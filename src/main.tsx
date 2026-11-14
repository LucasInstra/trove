import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LanguageProvider } from "./lib/language";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles.css";
import "./styles/tailwind.css";
import "./styles/charts.css";
import "./styles/charts-hover.css";
import "./styles/ledger.css";
import "./design.css";
import "./theme.css";
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
