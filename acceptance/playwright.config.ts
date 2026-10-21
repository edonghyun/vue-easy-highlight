import { defineConfig, devices, type Project } from '@playwright/test';
import { builtApps, portOf } from './scripts/serve.ts';

const profiles = {
    chromium: devices['Desktop Chrome'],
    firefox: devices['Desktop Firefox'],
    webkit: devices['Desktop Safari'],
    'mobile-chrome': devices['Pixel 7'],
    'mobile-safari': devices['iPhone 15'],
};

// The `ssr` variant runs a reduced set on the desktop engines: ssr.spec.ts
// and the `@core` tests, against the hydrated page.
const ssrProfiles = new Set(['chromium', 'firefox', 'webkit']);
const ssrSpecs = /ssr\.spec\.ts|@core/;

// One project per built app and browser profile, named
// `<app>-<variant>-<profile>`.
const apps = builtApps();
const projects: Project[] = Object.keys(apps)
    .sort()
    .flatMap((app) => {
        const ssr = app.endsWith('-ssr');
        return Object.entries(profiles)
            .filter(([profile]) => !ssr || ssrProfiles.has(profile))
            .map(([profile, device]) => ({
                name: `${app}-${profile}`,
                use: {
                    ...device,
                    baseURL: `http://127.0.0.1:${portOf(apps, app)}`,
                },
                ...(ssr ? { grep: ssrSpecs } : { testIgnore: 'ssr.spec.ts' }),
            }));
    });

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
