# FlowShader — Product Principles

The exhaustive, line-by-line spec that used to live in this file duplicated
what the source code and the 630+ test suite already express — and drifted
out of sync with both the moment either changed. What's durable is the
*intent* behind the product; that's what stays here. For how the system
actually works today, read the code, the tests, and
[ARCHITECTURE.md](ARCHITECTURE.md).

## Core Principles

1. **Strict typing, Unreal-Blueprint style.** No silent implicit conversions
   between connection types. `float ↛ vec3` directly — connecting the two
   auto-inserts a Combine node instead of quietly casting. `auto`-typed ports
   accept anything and adapt to whatever connects. See ARCHITECTURE.md's
   Type System section for the full rule set.

2. **Custom nodes are the killer feature.** They must work end-to-end, not
   just render correctly: creation (including empty, not just from
   selection), recursive compilation, port sync after subgraph edits, and
   navigation breadcrumbs into/out of a subgraph.

3. **Zero console errors in normal use.** A new `console.error`/`console.warn`
   during a standard workflow is a regression to fix, not noise to filter.

4. **Tests must pass, and must mean something.** A test that only checks
   "the button renders" isn't proof a feature works — assert on the actual
   end state (compiled GLSL, localStorage/registry contents, DOM after the
   full user flow), the way `graphLoadRegression.test.ts` or
   `slimAdapters.ui.test.tsx` do.

## Known Constraints

- **Topological sort is O(n²)** — fine for typical graphs, may need
  optimization past ~100+ nodes.
- **Local project storage is capped** (localStorage quota, ~4 MB budget in
  `LocalProjectStorageProvider`). The optional Supabase backend (see
  [CLOUD_SYNC_DESIGN.md](CLOUD_SYNC_DESIGN.md)) removes this ceiling with a
  per-user quota instead.
- **Audio is not persisted** in saved projects (files are too large for
  JSON/localStorage) — only the graph structure and texture data URLs are
  saved.
- **Modern browsers only** (ES2022+, WebGL, Web Audio for the Audio node);
  File System Access API save/load falls back to classic download/`<input>`
  where unsupported (Firefox, Safari).
