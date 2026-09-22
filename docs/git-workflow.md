# Team Git workflow

`stable` is the team's single trunk and GitHub default branch. Its baseline is
`rinse-revision`, including the verified ingredient soft-archive fix. Do not merge
the legacy backend, TypeScript conversion, or UI branches wholesale into trunk.
Future InventoryBatch and UI work must be separate, scoped pull requests.

## Feature work and review

1. Start with a clean working tree, fetch origin, and update `stable` with
   `git pull --ff-only`.
2. Create a feature branch from `stable`, for example
   `git switch -c codex/inventory-batch-model`.
3. Commit one coherent change, push the feature branch, and open a PR targeting
   `stable`. Include the problem, behavior change, and relevant verification.
4. Obtain at least one approving review from a teammate other than the author.
   Resolve review conversations; obtain a fresh approval after material changes.
5. Merge the reviewed PR through GitHub. Do not push directly to `stable`, force
   push it, or delete it. This rule also applies to repository administrators.

For code changes run `npm run typecheck`, `npm run test --workspace server`,
`npm run test --workspace client`, and `npm run build:web`. Run applicable browser
tests for changed screens. Persistence changes additionally require the opt-in
isolated MongoDB integration test documented in `server/README.md`. Do not run
legacy startup/seed scripts against the shared database.

## Branch-protection status

Server-side enforcement is **pending**, not enabled. On 2026-09-21 GitHub rejected
both branch-protection and ruleset access for this private repository with:
"Upgrade to GitHub Pro or make this repository public to enable this feature."
The owner chose to keep the repository private and continue setup with protection
pending. Until an eligible plan is enabled, the team must follow the PR/review
policy manually; this document cannot prevent direct pushes.

The desired API configuration is `.github/stable-branch-protection.json`:
one approving PR review, stale approvals dismissed, resolved conversations,
administrator enforcement, no force pushes, and no branch deletion. No required
CI contexts are configured because this repository has no corresponding CI jobs.
After the owner enables an eligible plan, an administrator must apply the JSON to
`PUT /repos/heizevg08/ShelfLife-AI/branches/stable/protection` and read it back to
verify enforcement. Never make the repository public just to enable protection.

## Trunk transition

The transition below is historical. On 22 September 2026, obsolete branch names
were retired in favor of verified archive tags. See the
[branch consolidation record](branch-consolidation.md) for exact commit IDs,
selected ports, excluded work, and recovery commands.

The previous `stable` tip, `e14c948`, contains 25 commits absent from the previous
`rinse-revision`. A fast-forward is impossible without importing that work.
Preserve it as `codex/archive-stable-e14c948`, then rename the verified
`rinse-revision` to `stable` and select it as GitHub's default branch. No merge or
history rewrite is required. The other feature branches remain source references,
not additional trunks. GitHub can close PRs whose head branch is renamed; no old
PR should be merged as part of this transition.

For a teammate whose local `rinse-revision` is clean and has no unpublished work:

```bash
git fetch origin --prune
git switch rinse-revision
git branch -m stable
git branch --set-upstream-to=origin/stable stable
git pull --ff-only
git remote set-head origin -a
```

If a local branch named `stable` already exists, preserve it under a backup name
first. Preserve unpublished commits on a feature branch; do not reset them away.

## Archive fix investigation and evidence

Commit `9528c2f` was pushed to `origin/rinse-revision`. Its message claimed soft
archiving, but its backend patch changed only permissions, tests, and README;
neither the ingredient model nor store implemented an archive flag. Available
branch history, local reflog, and stash inspection found no separate archive fix.
The implementation was missing from that commit, not lost in a later merge.

The replacement keeps the document and sets `isActive: false` atomically with a
DEACTIVATE audit record. It preserves historical lookup and prevents ordinary
updates to archived ingredients. Existing documents without the flag remain
active. The HTTP DELETE method is retained for client compatibility.

A real MongoDB test on `shelflifeai.r3dcblh.mongodb.net`, database `shelflifeai`,
directly read document `6ab11a2cbd72353f01d2ca12` from isolated collection
`hardening_test_05ef26b274c6400ebc85aae613591600_ingredients` after archiving:

```json
{"documentExists":true,"isActive":false,"activeListTotal":0,"includeArchivedTotal":1,"auditAction":"DEACTIVATE"}
```

The same test verified audit rollback, concurrent archives, existing unflagged
documents, and retained name uniqueness. The test collections were dropped only
after verification; operational ingredients/users/audit records were not changed.

The supplied PDFs and current repository docs did not contain a Git review policy.
The policy above records the repository owner's explicit PR/review requirement.
