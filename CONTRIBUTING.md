# Contributing to kilid

Thanks for your interest in kilid. This guide covers local setup, how to submit changes, and what CI expects.

For release and npm publishing, see [RELEASING.md](RELEASING.md).

## Code of conduct

Be respectful and constructive in issues and pull requests.

## Getting started

### Prerequisites

- **Node.js 22** (matches CI)
- **npm** (lockfile is `package-lock.json` — use `npm ci`, not ad-hoc installs)

### Clone and install

```bash
git clone https://github.com/farskid/kilid.git
cd kilid
npm ci
```

### Verify your setup

```bash
npm run build
npm run typecheck
npm test
npm run test:browser   # requires Playwright Chromium (installed on first run)
npm run size           # optional; same check as CI on PRs
```

## Project layout

```
src/
  index.ts              # core public API
  keyboard.ts           # key encoding / dispatch
  keybindings.ts        # keybindings factory
  chords.ts             # chordKeybindings (opt-in)
  pointer.ts            # pointerBindings factory
  format.ts             # parse/format strings (opt-in)
  adapter/              # shared logic for framework adapters
  react/                # @farskid/kilid/react
  vue/                  # @farskid/kilid/vue
  svelte/               # @farskid/kilid/svelte
  solid/                # @farskid/kilid/solid
  angular/              # @farskid/kilid/angular
  testing/              # @farskid/kilid/testing
test/                   # Vitest unit tests (+ Playwright smoke tests)
docs/index.html         # landing page (GitHub Pages)
scripts/check-size.mjs  # bundle size budgets
scripts/size-scenarios/ # consumer scenarios for size CI
```

Design goals: zero runtime dependencies, tree-shakeable modules, zero-allocation dispatch, small gzip footprint.

## Making changes

### 1. Branch from `main`

```bash
git checkout main
git pull origin main
git checkout -b feat/short-description
```

Use a descriptive branch name (`feat/…`, `fix/…`, `docs/…`, `test/…`).

### 2. Make focused changes

- Match existing style: TypeScript, ESM, minimal abstractions
- Keep PRs scoped — one logical change per PR when possible
- Add or update tests for behavior changes
- If bundle size grows, update budgets in `scripts/check-size.mjs` in the same PR

### 3. Run checks locally

```bash
npm run build && npm run typecheck && npm test
```

For adapter or DOM behavior changes, also run:

```bash
npm run test:browser
```

For anything that might affect shipped bytes:

```bash
npm run size
```

### 4. Open a pull request

- Target branch: **`main`**
- Fill in what changed and why
- Link related issues if any
- Wait for CI — all checks must pass before merge

Direct pushes to `main` may be blocked by branch protection; use PRs.

## CI checks

| Workflow | When | What it runs |
|---|---|---|
| **CI** | Every PR and push to `main` | `npm ci`, build, typecheck, unit tests, Playwright smoke tests |
| **Bundle size** | Every PR | Build + size scenarios; posts a report comment on the PR |
| **Deploy docs** | Push to `main` touching `docs/**` | Publishes landing page to GitHub Pages |
| **Release** | Push to `main` when `package.json` version bumps | Tag, GitHub release, npm publish — see [RELEASING.md](RELEASING.md) |

Required status check for branch protection: **CI / test**.

## Writing tests

- Unit tests live in `test/` and run with Vitest + happy-dom
- React adapter tests use `@testing-library/react`
- Framework adapter tests cover Vue, Svelte, Solid, Angular where applicable
- Browser smoke tests use Playwright (`npm run test:browser`)

When adding a feature:

1. Add tests that exercise real registration + dispatch behavior
2. Prefer `@farskid/kilid/testing` helpers for keyboard/pointer dispatch in tests
3. Avoid tests that only assert implementation details

Example:

```ts
import { KeyMod, KeyCode, keybindings } from '@farskid/kilid';
import { dispatchKeybinding } from '@farskid/kilid/testing';

const save = vi.fn();
const keys = keybindings(window);
keys.add(KeyMod.CtrlCmd | KeyCode.KeyS, save);

dispatchKeybinding(window, KeyMod.CtrlCmd | KeyCode.KeyS);
expect(save).toHaveBeenCalled();
```

## Bundle size

kilid treats bundle size as a contract. Each consumer scenario in `scripts/size-scenarios/` has a minified byte budget in `scripts/check-size.mjs`.

If your change increases size:

1. Run `npm run size` locally
2. If over budget, raise the relevant budget in the **same PR**
3. Briefly note why in the PR description

Do not disable size checks or skip scenarios.

## Documentation

- **README.md** — package overview and API summary
- **docs/index.html** — landing page / live docs (keep in sync for user-facing API or recipe changes)
- **RELEASING.md** — maintainers only
- **CONTRIBUTING.md** — this file

When changing public API or adding entry points, update README and `docs/index.html`.

## Adding a build entry point

Entry points are defined in:

- `package.json` → `exports`
- `tsup.config.ts` → `entry`
- `scripts/check-size.mjs` → add a scenario + budget

Add tests and document the import path (`@farskid/kilid/…`).

## Framework adapters

Shared subscription logic lives in `src/adapter/`. Framework-specific code should stay thin:

- React: hooks in `src/react/`
- Vue: composables in `src/vue/`
- Svelte: bind helpers in `src/svelte/`
- Solid: create* helpers in `src/solid/`
- Angular: bind functions in dist; decorators in source-only directive files

Keep framework packages as optional peer dependencies.

## Reporting bugs

Open an issue with:

- kilid version
- Browser / framework (if relevant)
- Minimal reproduction steps or code sample
- Expected vs actual behavior

## Pull request checklist

- [ ] `npm run build` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run test:browser` passes (if DOM / adapter behavior changed)
- [ ] `npm run size` passes (if bundle-affecting)
- [ ] README / docs updated (if user-facing)
- [ ] Tests added or updated for behavior changes

## Questions

Open a [GitHub issue](https://github.com/farskid/kilid/issues) or start a discussion on your PR.
