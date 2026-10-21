# Releasing

Releases are cut by CI with [Changesets](https://github.com/changesets/changesets), not from a laptop. The workflow is [`.github/workflows/release.yml`](.github/workflows/release.yml). It does nothing until the owner sets the repository variable `RELEASE_ENABLED` to `true`, so the setup below comes first, in this order.

## One-time setup (repository owner)

1. **npm scope.** Run `npm login`, create the `overlapmark` organization (or scope) on npm, and confirm you own it. The packages are `@overlapmark/core`, `@overlapmark/dom`, `@overlapmark/vue`, `@overlapmark/react` and `@overlapmark/svelte`.
2. **npm token for the first release.** Packages must exist on npm before a trusted publisher can be configured for them, and a first release must go through CI (a laptop publish would not build, would not rewrite `workspace:^`, and would publish `0.0.0` from source). So create a granular access token on npmjs.com with publish permission for the `@overlapmark` scope and a short expiry, and store it as the repository secret `NPM_TOKEN`.
3. **Allow Actions to open pull requests.** Settings, Actions, General, Workflow permissions: read and write, and "Allow GitHub Actions to create and approve pull requests". The Version Packages pull request needs both.
4. **Branch protection on `main`.** Require the status checks `ci`, `acceptance` (the aggregate job that fails unless every browser leg passed) and `packaging`, require pull requests, and require branches to be up to date before merging. The release job runs on the commit that lands on `main`, so these checks passing on the pull request are what gate a publish. Note that pull requests opened by `GITHUB_TOKEN` do not start other workflows: if the checks do not appear on the Version Packages pull request, close and reopen it, or give the workflow a personal access token or GitHub App token for `changesets/action`.
5. **Enable the release workflow.** Settings, Secrets and variables, Actions, Variables: add `RELEASE_ENABLED` with the value `true`.

## Normal flow

1. Add a changeset to every pull request that changes a published package: `pnpm changeset`. Choose the packages and the bump, and write what the change means for users.
2. Merge the feature pull requests into `main`. Each push to `main` opens or updates a pull request named "chore: version packages", which holds the version bumps and the changelog entries.
3. Review that pull request. The first one releases `0.1.0` of all five packages, with internal dependencies at `^0.1.0`.
4. Merge it. The release job runs `pnpm release`: it builds every package in `packages/` and runs `changeset publish`, which publishes to npm with provenance and pushes the git tags.

Never run `npm publish` or `changeset publish` from a laptop.

## After the first publish

1. **Move to trusted publishing.** For every package on npmjs.com, add a trusted publisher: GitHub Actions, owner `edonghyun`, repository `overlapmark`, workflow filename `release.yml`. Then revoke the npm token, delete the `NPM_TOKEN` secret, and optionally set each package's publishing access to "Require two-factor authentication and disallow tokens".

The demo links to the npm packages, which return 404 until they are published, and the README images need these files on `main`. So these come last:

2. **Demo site.** Settings, Pages: set the source to GitHub Actions, then add the repository variable `PAGES_ENABLED` with the value `true`. The next push to `main`, or a manual run of the Pages workflow, deploys the demo to <https://edonghyun.github.io/overlapmark/>.
3. **Repository homepage.** Set the repository website (the About box) to <https://edonghyun.github.io/overlapmark/>.
4. **Deprecate the old package.** The root README says `vue-easy-highlight` is replaced; make npm say so:

    ```sh
    npm deprecate vue-easy-highlight "Moved to @overlapmark/vue"
    ```
