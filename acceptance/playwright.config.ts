import { defineConfig, devices, type Project } from '@playwright/test';
import { builtApps, portOf } from './scripts/serve.ts';

const profiles = {
    chromium: devices['Desktop Chrome'],
    firefox: devices['Desktop Firefox'],
    webkit: devices['Desktop Safari'],
    'mobile-chrome': devices['Pixel 7'],
    'mobile-safari': devices['iPhone 15'],
};

// One project per built app and browser profile, named
// `<app>-<variant>-<profile>`; every project runs the same specs.
const apps = builtApps();
const projects: Project[] = Object.keys(apps)
    .sort()
    .flatMap((app) =>
        Object.entries(profiles).map(([profile, device]) => ({
            name: `${app}-${profile}`,
            use: {
                ...device,
                baseURL: `http://127.0.0.1:${portOf(apps, app)}`,
            },
        })),
    );

export default defineConfig({
    testDir: './specs',
    outputDir: './.work/test-results',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: process.env.CI
        ? [
              ['list'],
              ['html', { outputFolder: './.work/report', open: 'never' }],
          ]
        : 'list',
    use: { trace: 'retain-on-failure' },
    projects,
    webServer: {
        command: 'node --experimental-strip-types acceptance/scripts/serve.ts',
        cwd: '..',
        wait: { stdout: /acceptance apps listening/ },
        stdout: 'ignore',
    },
});
