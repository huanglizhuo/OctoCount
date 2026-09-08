import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const extensionPackage = JSON.parse(
  readFileSync(new URL("../extension/package.json", import.meta.url), "utf8"),
) as { version: string };

function redirectLegacyLaunchKit(server: { middlewares: { use: (handler: (req: { url?: string }, res: { statusCode: number; setHeader: (name: string, value: string) => void; end: () => void }, next: () => void) => void) => void } }) {
  server.middlewares.use((req, res, next) => {
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    if (!["/launch-kit", "/launch-kit/", "/launch-kit.html"].includes(requestUrl.pathname)) {
      next();
      return;
    }
    res.statusCode = 308;
    res.setHeader("Location", `/${requestUrl.search}#extension`);
    res.end();
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "legacy-launch-kit-redirect",
      configureServer(server) {
        redirectLegacyLaunchKit(server);
      },
      configurePreviewServer(server) {
        redirectLegacyLaunchKit(server);
      },
    },
    {
      name: "inject-extension-version",
      transformIndexHtml(html) {
        return html.replaceAll("__EXTENSION_VERSION__", extensionPackage.version);
      },
    },
  ],
  build: {
    modulePreload: { polyfill: false },
  },
  server: {
    // Dev-only: lets the browser talk to the Rust backend through this same
    // origin (matching how production serves both from octocounts.com), so
    // things like the OAuth callback's redirect land back on a page this
    // server actually renders instead of the bare API's own port.
    proxy: {
      "/api": "http://127.0.0.1:8095",
      "/og": "http://127.0.0.1:8095",
      "^/badge/": "http://127.0.0.1:8095",
    },
  },
});
