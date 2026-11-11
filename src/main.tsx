import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LanguageProvider } from "./lib/language";
import "./styles.css";
import "./styles/tailwind.css";
import "./design.css";

const container = document.getElementById("root");
if (!container) throw new Error("root element is missing");

createRoot(container).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
