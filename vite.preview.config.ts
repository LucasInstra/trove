// Renders the app in a plain browser with a mocked backend, for design work and
// screenshots: `npx vite --config vite.preview.config.ts`, then open
// http://localhost:1421/?route=<route>&theme=<light|dark>.
import { defineConfig, mergeConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import base from "./vite.config";

const stub = fileURLToPath(new URL("./preview/mock-stubs.ts", import.meta.url));

export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      alias: {
        "@tauri-apps/api/core": fileURLToPath(new URL("./preview/mock-core.ts", import.meta.url)),
        "@tauri-apps/api/window": stub,
        "@tauri-apps/api/app": stub,
        "@tauri-apps/api/event": stub,
        "@tauri-apps/plugin-dialog": stub,
        "@tauri-apps/plugin-process": stub,
        "@tauri-apps/plugin-updater": stub,
      },
    },
    server: { port: 1421, strictPort: true },
  }),
);
