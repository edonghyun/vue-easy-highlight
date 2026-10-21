import { defineConfig, devices, type Project } from '@playwright/test';
import { builtApps, portOf } from './scripts/serve.ts';

const profiles = {
    chromium: devices['Desktop Chrome'],
    firefox: devices['Desktop Firefox'],
    webkit: devices['Desktop Safari'],
    'mobile-chrome': devices['Pixel 7'],
    'mobile-safari': devices['iPhone 15'],
};

// What each variant runs: the `client` build runs every spec but
// ssr.spec.ts in every profile. The `ssr` build runs a reduced set on the
// desktop engines, ssr.spec.ts and the `@core` tests against the hydrated
// page; the `floor` build (the app on its framework's declared peer floor)
// runs the `@core` tests in Chromium.
const variants: Record<
    string,
    { profiles?: string[]; filter: Pick<Project, 'grep' | 'testIgnore'> }
> = {
    client: { filter: { testIgnore: 'ssr.spec.ts' } },
    ssr: {
        profiles: ['chromium', 'firefox', 'webkit'],
        filter: { grep: /ssr\.spec\.ts|@core/ },
    },
    floor: {
        profiles: ['chromium'],
        filter: { grep: /@core/, testIgnore: 'ssr.spec.ts' },
    },
};

// One project per built app and browser profile, named
// `<app>-<variant>-<profile>`.
const apps = builtApps();
const projects: Project[] = Object.keys(apps)
    .sort()
    .flatMap((app) => {
        const variant = variants[app.slice(app.lastIndexOf('-') + 1)];
        if (!variant) throw new Error(`unknown variant of ${app}`);
        return Object.entries(profiles)
            .filter(
                ([profile]) =>
                    !variant.profiles || variant.profiles.includes(profile),
            )
            .map(([profile, device]) => ({
                name: `${app}-${profile}`,
                use: {
                    ...device,
                    baseURL: `http://127.0.0.1:${portOf(apps, app)}`,
                },
                ...variant.filter,
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
