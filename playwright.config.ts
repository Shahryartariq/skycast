import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/** End-to-end tests run the production build against the built-in sample data. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // In CI, also write the HTML report the workflow uploads when a test fails.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // The lookup limit is tested in unit tests; here it would only make parallel runs flaky.
    env: { WEATHER_SAMPLE_DATA: "1", SITE_URL: "https://getskycast.vercel.app", SKYCAST_LOOKUPS_PER_MINUTE: "100000" },
  },
});
