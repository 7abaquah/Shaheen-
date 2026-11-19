# Rules for every implementation node

You are one node in a build graph (see `graph.md`). You have one bounded job, a fixed
evaluator, and a set of files you own. Another node may be working in this same checkout
at the same time.

## Boundaries

- Create and edit files **only** inside the globs listed under "You own" in your spec.
- Never edit the evaluator: contracts (`*/contract.ts`), `**/tests/acceptance/**`,
  `src/tests/setup.ts`, `shared/**`, `sources/**`, `graph/**`, `scripts/**`, config files
  (`package.json`, `tsconfig.json`, `eslint.config.js`, `vite.config.ts`, `index.html`).
  They are hash-pinned and immutable on disk; a change fails your gate.
- No `git commit`, `git push`, `git stash`, `git checkout`, `git reset`, `git clean`. The lead
  commits accepted work. Do not touch another node's files even to "fix" them.
- No `npm install` / `npm uninstall`. Every dependency you may use is already installed. If
  you believe one is missing, stop and report it.
- No network access is needed. Do not call any external API.
- Do not weaken a check to make it pass: no `eslint-disable`, no `@ts-ignore` /
  `@ts-expect-error`, no `as any`, no skipped or deleted tests, no special-casing of test input.

## If the evaluator looks wrong

If a frozen test or contract seems to contradict itself or the spec, do not work around it and
do not edit it. Finish everything else, then report the exact file, line, and why it is
wrong under "Evaluator issues". The lead decides.

## Code conventions

- TypeScript, strict. **Erasable syntax only**: no `enum`, no `namespace`, no constructor
  parameter properties (the server and the scripts run `.ts` files directly in Node).
- Relative imports carry the `.ts` / `.tsx` extension in `kernel/`, `server/`, `shared/`.
  In `src/` use the aliases `@/…`, `@shared/…`, `@kernel`.
- `import type` for type-only imports (`verbatimModuleSyntax` is on).
- `noUncheckedIndexedAccess` is on: index access yields `T | undefined`.
- Comments explain *why*, briefly. No banner art, no changelog comments, no "FIX B00x" tags.
- User-facing text is Arabic (RTL). Identifiers and comments are English.
- Do not write claims the code cannot back: nothing is "unhackable", "100% secure",
  "military grade". State what a mechanism does.

## Your gate

Run it yourself as often as you like (it does not write to the gate log in this mode):

    node scripts/gate.mjs <your node id> --no-log

It checks: evaluator untouched · only your files changed · no type errors in your scope ·
ESLint clean · your acceptance tests pass. Faster inner loops:

    npx tsc --noEmit --pretty false | grep '<your path prefix>'
    npx eslint <your paths>
    npx vitest run <test file> [-t "<name pattern>"]

## What to return

A short report, plain text:

1. **Output** — the files you created (paths).
2. **Verdict** — the last lines of `node scripts/gate.mjs <id> --no-log` (GATE OPEN / CLOSED
   and which checks failed, verbatim).
3. **Decisions** — anything you chose that the spec left open, one line each.
4. **Evaluator issues** — suspected defects in frozen files, or "none".
5. **Not done** — anything in the spec you did not finish, or "nothing".

Report a closed gate as closed. A truthful "2 checks fail, here is why" is useful; a
claimed pass that the lead's gate then refutes is not.
