# Upstream provenance

The initial implementation is imported from [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin).

- Upstream branch: `main`
- Pinned commit: `e16c87f213a5ba5e45964e9b67c792105ec74d26`
- Original repository license: MIT
- Original release line: 2.2.1
- Source count at import: 272 files (including assets)

The source files and binary assets were copied with matching Git blob SHA identifiers. The upstream README is replaced by this project's README; two project docs (AGENTS.md and docs/architecture.md) were already present.

This is an adapted starter, not an official distribution from the original author. Preserve the upstream license and copyright.

## Syncing upstream changes

This repository does not share Git history with upstream: the files were copied at the pinned commit, so upstream changes are ported as patches, never merged. Upstream `main` was still at the pinned commit when this was last checked (2026-11-06).

Of the 272 upstream files at the pinned commit, 71 are unchanged here, 90 are modified and 111 were removed (non-generic pages and assets). That decides how each part of an upstream change is handled.

1. **Fetch upstream into a temporary ref**, not a branch or remote you will push:

   ```bash
   PIN=e16c87f213a5ba5e45964e9b67c792105ec74d26
   git fetch https://github.com/satnaing/shadcn-admin main:refs/upstream/main
   git log --oneline "$PIN"..refs/upstream/main
   git diff --stat "$PIN" refs/upstream/main
   ```

2. **Pick what to port.** Take fixes and dependency updates for files this starter still uses. Skip changes to removed pages, upstream branding and anything that conflicts with [AGENTS.md](../AGENTS.md) (Chinese-first UI, server-driven navigation, no mock code in production builds).

3. **Apply only to files that still exist here, with a three-way merge.** Fetching upstream puts the original file versions in the local object database, so `git apply -3` can merge into files this repository has modified:

   ```bash
   git diff --name-only "$PIN" refs/upstream/main \
     | while read -r file; do git ls-files --error-unmatch "$file" >/dev/null 2>&1 && echo "$file"; done \
     > /tmp/upstream-paths
   if [ -s /tmp/upstream-paths ]; then
     tr '\n' '\0' < /tmp/upstream-paths \
       | xargs -0 git diff "$PIN" refs/upstream/main -- \
       | git apply -3 --index
   else
     echo 'No upstream change touches a file this starter still has; nothing to apply.'
   fi
   ```

   The `if` matters: with an empty list, `git diff A B --` has no paths and would diff **everything**, including the files this step excludes. Paths are passed NUL-separated so names with spaces survive. (The loop variable is `file`, not `path`: in zsh, `path` is tied to `PATH`.) Unchanged files apply cleanly. Modified files either merge or are left with conflict markers to resolve by hand (`git status` lists them as unmerged). New upstream files are not on the list: add them deliberately if you want them.

4. **Record the sync:** update the pinned commit above to the upstream commit you synced to, add a CHANGELOG entry that lists what was ported, keep `LICENSE` and the upstream attribution unchanged, run the full check list from [releasing.md](releasing.md), then remove the temporary ref with `git update-ref -d refs/upstream/main`.
