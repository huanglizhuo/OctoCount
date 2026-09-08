// Editorial notes for the first batch of curated comparison pages (SG-05).
// One entry per slug; entries beyond this batch simply have no entry and the
// pages render exactly as before. Every statement must be supported by the
// page's own counted data or by the linked source — no "better/advanced"
// verdicts, no size-to-quality or size-to-performance leaps.
//
// Fields:
//   scope      — what the two repositories contain and whether the counts are
//                comparable (dates/config live in the page's methodology line)
//   insights   — 2-3 data-supported readings of the counted numbers
//   caution    — the misreading this page is most likely to invite
//   sources    — external references for structure/architecture statements
//   verifiedAt — date the non-data statements were last checked
export const COMPARE_EDITORIAL = {
  "react-vs-vue": {
    scope:
      "facebook/react is a monorepo: the counted archive includes the React packages plus fixtures, documentation site content, and test infrastructure, not just the react package that ships to apps. vuejs/core is the Vue core repository — the runtime, compiler, and reactivity packages — with its own tests and docs. Both counts therefore measure framework source trees, not applications built with them, and the two archives were counted on the dates shown in the methodology line above.",
    insights: [
      "In the counted archives, the language mix differs in kind, not just degree: Vue core is predominantly TypeScript, while React's counted code is majority JavaScript with a substantial TypeScript share — a direct consequence of each project's chosen implementation language, visible in the per-language table of each report.",
      "Both repositories carry a large test and fixture footprint relative to their runtime code, so a meaningful share of each count exists to keep the framework correct rather than to ship to production.",
    ],
    caution:
      "Neither number predicts the size, performance, or quality of an app built with the framework: a bundled application includes a compiled subset of the framework, application code, and dependencies. Use these counts to gauge how much framework source exists to read and maintain.",
    sources: [
      { label: "facebook/react repository structure (packages/ monorepo)", url: "https://github.com/facebook/react" },
      { label: "vuejs/core repository", url: "https://github.com/vuejs/core" },
    ],
    verifiedAt: "2026-09-08",
  },
  "vite-vs-webpack": {
    scope:
      "vitejs/vite is the Vite core repository — dev server, build pipeline, and their plugin/rollup integration — while webpack/webpack is the webpack core; loaders, plugins, and the surrounding ecosystems live in separate repositories for both tools. The two counts are therefore comparable as core-tool source trees, counted on the dates in the methodology line.",
    insights: [
      "Vite core is written predominantly in TypeScript, matching how it presents its public plugin API, while webpack core remains largely JavaScript; the per-language tables make the difference measurable rather than anecdotal.",
      "Webpack's two-decade head start shows up as proportionally more comment lines and fixtures relative to its code lines in the table above — material written to explain and protect a widely-extended codebase.",
    ],
    caution:
      "These counts do not measure build speed or output size for your project: performance depends on the toolchain version, plugin set, and application shape. A smaller tool source tree does not build faster.",
    sources: [
      { label: "vitejs/vite repository", url: "https://github.com/vitejs/vite" },
      { label: "webpack/webpack repository", url: "https://github.com/webpack/webpack" },
    ],
    verifiedAt: "2026-09-08",
  },
  "nextjs-vs-vite": {
    scope:
      "vercel/next.js counts the Next.js monorepo — the framework packages, examples, documentation site, and test suites — while vitejs/vite counts the Vite core repository only. The comparison is framework-repository vs build-tool-repository: related layers of the stack, but not the same kind of software, and the counts were taken on the dates shown above.",
    insights: [
      "Next.js's count includes documentation-site content and a large examples directory as part of its monorepo, so a substantial part of what is counted exists to teach and demonstrate rather than to ship as framework code.",
      "The two counts describe different layers: Next.js is a framework that orchestrates rendering, routing, and data loading (and uses build tooling underneath), while Vite is that build tooling layer. Reading the numbers side by side is most useful as a sense of each project's reading and maintenance surface.",
    ],
    caution:
      "This is not a framework-vs-build-tool performance or popularity comparison. Source-tree size says nothing about which to choose; the decision depends on the application's rendering and build requirements.",
    sources: [
      { label: "vercel/next.js repository structure (monorepo with examples and docs)", url: "https://github.com/vercel/next.js" },
      { label: "vitejs/vite repository", url: "https://github.com/vitejs/vite" },
    ],
    verifiedAt: "2026-09-08",
  },
  "electron-vs-tauri": {
    scope:
      "electron/electron counts the Electron repository: the embedded Chromium and Node.js integration layer, native shell code, API implementation, and documentation — but not Chromium's or Node's own source, which are consumed as prebuilt binaries. tauri-apps/tauri counts the Tauri core repository: the Rust runtime, the process and IPC layer, and the CLI tooling; it equally does not count the system webview it delegates to. Both counts therefore measure the glue layer each project maintains, not the browser engines involved.",
    insights: [
      "The language tables tell the architectural story directly: Electron's counted code is dominated by C++ for the native integration layer with a sizeable TypeScript/JavaScript API surface, while Tauri core is predominantly Rust — each project's chosen systems language for the same job of connecting web content to the OS.",
      "The engine asymmetry matters when reading the totals: Electron bundles (and updates) a full Chromium with each app, while Tauri relies on the operating system's webview, so neither repository's SLOC represents what ships inside a finished desktop app.",
    ],
    caution:
      "Repository size is not install size and not memory footprint. A finished app's weight depends on the engine strategy above, not on how many source lines the framework repository contains.",
    sources: [
      { label: "electron/electron repository", url: "https://github.com/electron/electron" },
      { label: "tauri-apps/tauri repository", url: "https://github.com/tauri-apps/tauri" },
    ],
    verifiedAt: "2026-09-08",
  },
  "rust-vs-go": {
    scope:
      "rust-lang/rust counts the Rust repository: the compiler (largely Rust itself), standard library, tooling, and a very large test suite. golang/go counts the Go repository: compiler toolchain, standard library, and runtime, also with its own test suites. Both are language toolchain monorepos, counted with the same engine and configuration on the dates above, which makes this one of the more like-for-like comparisons on this site.",
    insights: [
      "Both repositories are self-hosting toolchains whose counted code is dominated by each project's own language, as the per-language tables show; the shares of C and assembly that remain mark the bootstrap and runtime boundaries each project still maintains by hand.",
      "A large fraction of both trees is test material — the rustc test suite and the Go toolchain tests — so both counts substantially measure correctness infrastructure, not just shipped compiler code.",
    ],
    caution:
      "Compiler repository size does not measure language quality, compile speed, or runtime performance — those are properties of the shipped toolchain and the programs it produces, not of the source tree's line count.",
    sources: [
      { label: "rust-lang/rust repository", url: "https://github.com/rust-lang/rust" },
      { label: "golang/go repository", url: "https://github.com/golang/go" },
    ],
    verifiedAt: "2026-09-08",
  },
};
