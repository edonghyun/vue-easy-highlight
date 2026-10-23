# Contributing to overlapmark

Thanks for helping. Bug reports and pull requests are welcome at [github.com/edonghyun/overlapmark](https://github.com/edonghyun/overlapmark). For a larger change, open an issue first so we can agree on the approach.

## Setup

You need Node.js 22.12 or later (CI uses 22.22.0) and pnpm 10, which corepack provides at the version pinned in `package.json` (`packageManager`):

```sh
corepack enable
pnpm install
pnpm exec playwright install chromium   # browser tests
```

The repository is a pnpm workspace:

| Path                              | What it is                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/core`                   | `@overlapmark/core`: segments, render contract, DOM helpers, `styles.css`                                |
| `packages/dom`                    | `@overlapmark/dom`, the vanilla JS adapter                                                               |
| `packages/vue`, `react`, `svelte` | The framework adapters                                                                                   |
| `packages/adapter-contract`       | Private: the browser test suite every adapter runs                                                       |
| `acceptance`                      | End-to-end tests of apps installed from the packed tarballs                                              |
| `site`                            | The [live demo and docs](https://edonghyun.github.io/overlapmark/): `pnpm --filter overlapmark-site dev` |
| `docs-assets`                     | README images, rendered from the site by `pnpm docs:images`                                              |

## Checks

These are what CI runs on every pull request:

```sh
pnpm lint            # ESLint
pnpm format:check    # Prettier (`pnpm format` fixes)
pnpm typecheck       # tsc, vue-tsc and svelte-check
pnpm test            # unit, property, contract, type and browser tests
pnpm test:perf       # performance ceilings
pnpm build           # every package
```

## Test layers

- **Unit and property tests** (`*.test.ts`, Node): core's segment computation, search, rendering contract, color validation and warnings, with fast-check properties for segments and matches.
- **Browser tests** (`*.browser.test.ts`, Vitest browser mode in Playwright's Chromium): DOM offsets, interactions, view state and the stylesheet.
- **Adapter contract** (`packages/adapter-contract`): one shared suite every adapter runs on its own component (`*.contract.browser.test.ts`), covering DOM structure, offsets, event payloads, updates and teardown. Behavior every adapter must share is tested here, not in one adapter's tests.
- **Type and declaration tests** (`*.node.test.ts`): the adapters' generic `data` typing, and the Vue declarations against Vue 3.3, 3.4, 3.5.0 and the latest 3.5.
- **SSR tests**: each framework renders on the server and hydrates without mismatches.
- **Performance** (`pnpm test:perf`): a ceiling on `computeSegments`; a miss fails.

Run one package's tests with `pnpm --filter @overlapmark/<name> test`.

Write test titles as English sentences that describe behavior, separate arrange, act and assert with blank lines, and fix a bug by first adding a test that fails without the fix.

## Acceptance suite

The acceptance suite installs the packed packages into real apps: vanilla JS as a client build, and Vue, React and Svelte each as a client build, a server-rendered build and a build on its framework's lowest supported version (the floor) and drives them with Playwright in desktop Chromium, Firefox and WebKit and in emulated Pixel 7 and iPhone 15 profiles.

```sh
pnpm exec playwright install chromium firefox webkit
pnpm acceptance:build                        # build and pack the packages, then build the apps
pnpm acceptance                              # every app in every profile
pnpm acceptance --project "*-chromium"       # one profile
ACCEPTANCE_APPS=vue-client pnpm acceptance:build   # only some apps
```

`pnpm check:readme` checks that the quick starts in `README.md` and in each package README are identical and appear in the acceptance apps (`acceptance/apps/*/src`), which compile and run them. If you change a quick start, change all three places. `pnpm check:packages` checks the packed packages with publint and attw.

## Changesets

Every change that affects a published package needs a changeset:

```sh
pnpm changeset
```

Pick the packages and the bump (while we are on 0.x, `minor` for breaking changes and features, `patch` for fixes), and describe the change for users: the summary is copied into each package's `CHANGELOG.md` as written.

## Releasing

Releases are published from CI, not from a laptop. The process, and the owner actions around it, are in [RELEASING.md](RELEASING.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
