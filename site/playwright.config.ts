import { defineConfig, devices } from '@playwright/test';

// The site as Pages serves it: a production build under /overlapmark/.
export default defineConfig({
    testDir: 'e2e',
    retries: 0,
    forbidOnly: !!process.env.CI,
    reporter: process.env.CI ? 'list' : 'line',
    use: { baseURL: 'http://localhost:4179/overlapmark/' },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command:
            'pnpm exec vite build --base /overlapmark/ && pnpm exec vite preview --base /overlapmark/ --port 4179 --strictPort',
        url: 'http://localhost:4179/overlapmark/',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
