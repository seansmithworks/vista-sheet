import { defineConfig, devices } from "@playwright/test";

// Opt-in cross-browser run: `npm run test:browsers` sets VISTA_BROWSERS=all.
// Default (`npm run test:geometry`) stays chromium + webkit-squircle.
const ALL = process.env.VISTA_BROWSERS === "all";
const PORT = Number(process.env.PW_PORT ?? 4873);

/**
 * geometry.spec.ts and a11y.spec.ts run against the Vite dev server for the
 * example app — real rendered geometry and real ARIA state, not a JSDOM
 * approximation. See docs/PACKAGE-DESIGN.md and REVIEW-FINDINGS.md
 * ("WHAT THE GATES ARE NOT MEASURING" — tsc/vitest cannot see any of the
 * package's actual defects, all of which are CSS and rendered geometry).
 */
export default defineConfig({
  testDir: ".",
  // Default testMatch also picks up "*.test.ts", which is vitest's suffix
  // (see example/play/codegen.test.ts, a pure-codegen vitest suite with no
  // browser) — restrict to Playwright's own specs so it doesn't try to run
  // vitest-only files through the Playwright test runner.
  testMatch: /.*\.spec\.ts$/,
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  webServer: {
    // vite.config.ts lives inside example/ with root: "./example" (so its
    // own root resolves relative to itself); "example" as the CLI root
    // argument is what the npm "dev"/"build" scripts already rely on, run
    // from the package root, one level up from this config file.
    // --host 127.0.0.1: Vite's default bind is IPv6 loopback ([::1]) only,
    // which a plain IPv4 http://127.0.0.1 client (Playwright's default,
    // curl, etc.) cannot reach — force IPv4 explicitly.
    command: `node_modules/.bin/vite example --port ${PORT} --strictPort --host 127.0.0.1`,
    cwd: "..",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
      testIgnore: /squircle-webkit\.spec\.ts$/,
    },
    // Default run: WebKit runs only the squircle fallback spec so suite runtime doesn't double.
    // Under VISTA_BROWSERS=all the full-suite "webkit" project below replaces it.
    ...(ALL
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
            testIgnore: /squircle-webkit\.spec\.ts$/,
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
          },
          {
            name: "mobile-safari",
            use: { ...devices["iPhone 15"] },
          },
          {
            name: "mobile-chrome",
            use: { ...devices["Pixel 7"] },
            testIgnore: /squircle-webkit\.spec\.ts$/,
          },
        ]
      : [
          {
            name: "webkit-squircle",
            use: { browserName: "webkit" as const },
            testMatch: /squircle-webkit\.spec\.ts$/,
          },
        ]),
  ],
});
