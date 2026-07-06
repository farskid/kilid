# Releasing

kilid uses a single GitHub Actions workflow to cut a **GitHub release** and publish to **npm** in one step. Releases are driven by version bumps on `main` — not by hand-tagging or manual `npm publish`.

## How it works

When `package.json` version changes on `main`, the [**Release** workflow](.github/workflows/release.yml):

1. Verifies the version was bumped (compared to the previous commit)
2. Runs `build`, `typecheck`, `test`, and `size`
3. Creates git tag `vX.Y.Z` and a GitHub release (auto-generated notes)
4. Publishes `@farskid/kilid@X.Y.Z` to npm (with provenance)

If the tag already exists, the workflow skips GitHub release creation. If the version is already on npm, publish is skipped.

## Normal release (maintainers)

### 1. Bump the version on a branch

```bash
git checkout main
git pull origin main
git checkout -b chore/release-0.2.1

npm version patch --no-git-tag-version   # 0.2.0 → 0.2.1
# or: npm version minor --no-git-tag-version
# or: npm version major --no-git-tag-version
```

Use `--no-git-tag-version` so CI creates the tag — do **not** run `git tag` locally.

### 2. Open a pull request

- Title example: `chore: release v0.2.1`
- Wait for **CI** and **Bundle size** checks to pass on the PR

### 3. Merge to `main`

After merge, the Release workflow runs automatically. Within a few minutes you should see:

- GitHub release: https://github.com/farskid/kilid/releases
- npm package: https://www.npmjs.com/package/@farskid/kilid

No manual Actions run is needed for normal releases.

## Version numbering

Follow [semver](https://semver.org/):

| Bump | When |
|---|---|
| **patch** | Bug fixes, docs-only changes that ship no API change, internal refactors |
| **minor** | New features, new exports, backward-compatible API additions |
| **major** | Breaking API changes |

Recent breaking changes (already in 0.2.0): React hooks split (`useKeybinding` no longer accepts strings — use `useParsedKeybinding`).

## Manual recovery

Use this only when GitHub already has the release/tag but npm publish failed.

1. Confirm [`NPM_TOKEN`](#one-time-setup) is set under **Settings → Secrets and variables → Actions → Repository secrets**
2. Go to [**Actions → Release**](https://github.com/farskid/kilid/actions/workflows/release.yml)
3. Click **Run workflow**
4. Branch: `main`
5. Enable **force** (required when the tag already exists)
6. Run

The workflow re-runs checks and publishes to npm if that version is not already published. It does not create a duplicate GitHub release when the tag exists.

### CLI alternative

```bash
gh workflow run Release --repo farskid/kilid -f force=true
```

## One-time setup

### npm token (`NPM_TOKEN`)

Add a repository secret named **`NPM_TOKEN`** (not an environment secret):

- **Settings → Secrets and variables → Actions → Repository secrets → New repository secret**
- Value: npm token with **read + write** access scoped to `@farskid/kilid`
- Granular or Automation tokens both work

The workflow passes this to `setup-node` as `NODE_AUTH_TOKEN` for `npm publish --provenance`.

### Branch protection (recommended)

Protect `main` so releases and code only land via reviewed PRs:

**Option A — workflow (repo admin):**

1. **Actions → Setup branch protection → Run workflow**

**Option B — manual:**

1. **Settings → Branches → Add rule** for `main`
2. Require a pull request before merging
3. Require status check **CI / test**

## Bundle size budgets

If a release fails at the `size` step, a scenario exceeded its budget in `scripts/check-size.mjs`. Raise the budget in the **same PR** that increases bundle size, with a short comment explaining why.

PRs get an automated size report comment from the **Bundle size** workflow.

## What not to do

- Do not create git tags locally for releases
- Do not run `npm publish` by hand (except local dry-runs with `--dry-run`)
- Do not merge version bumps with failing CI
- Do not use the Release **force** option for normal releases — only for npm recovery

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Release workflow never ran | `package.json` version unchanged on merge | Bump version in the PR |
| Workflow skipped immediately | Tag `vX.Y.Z` already exists | Normal if re-merging; use **force** only for npm recovery |
| `ENEEDAUTH` on publish | `NPM_TOKEN` missing or wrong name | Add repo secret exactly named `NPM_TOKEN` |
| No **Run workflow** button | Insufficient repo permissions | Need Write access; or use `gh workflow run` |
| Size check failed | Bundle grew past budget | Update budget in `scripts/check-size.mjs` in the same PR |

## Related files

- [`.github/workflows/release.yml`](.github/workflows/release.yml) — release + npm publish
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — PR / main checks
- [`scripts/check-size.mjs`](scripts/check-size.mjs) — bundle size scenarios and budgets
