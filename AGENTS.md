# Notes for AI Agents Working on FlowShader

## You CAN run and see the app

If you're Claude Code (or another agent with browser/preview tooling), you
are **not** blind to this app — use it:

- Start the dev server via the preview tool (not a bare `npm run dev` in a
  blocking shell) and interact with the real page: click, fill, inspect DOM,
  read console/network logs.
- **Screenshots of the canvas will time out (~30s).** This is expected, not a
  bug: `ShaderPreview` keeps a WebGL `requestAnimationFrame` loop running,
  which busies the render thread. It does **not** mean the app is broken —
  verify with DOM/state inspection instead (element counts, `innerText`,
  evaluating `compileGraphToGLSL(...)` directly) and only screenshot when you
  need a visual for the user.
- To seed a specific graph for testing without clicking through the UI,
  write a `serializeGraph`-shaped object to `localStorage['shader-nodes-save-v1']`
  and reload — much faster than manually placing nodes.
- If a preview tab is hidden/backgrounded, the browser throttles
  `requestAnimationFrame`, so animated values (iTime, audio levels) will look
  frozen. That's the harness, not the app — don't chase it as a bug.

Manually reproduce user-reported bugs in the running app before proposing a
fix. Trust what you observe over assumptions about the code.

## Invariants (do not break without explicit user sign-off)

- **Strict connection typing.** No silent implicit casts at connect time
  (`float → vec3` is blocked, not auto-widened). Incompatible-but-convertible
  connections get an auto-inserted Split/Combine node instead — see
  `autoAdapterSystem.ts` and the Type System section of ARCHITECTURE.md.
- **Custom nodes are core, not a side feature.** Creation, editing, port
  sync after subgraph edits, and recursive compilation must keep working.
- **No console errors/warnings in normal use.** Tests assert on this
  (`consoleErrors.test.tsx`); a new warning is a regression, not noise to
  ignore.
- Run `npx tsc -b`, `npm test`, and `npm run build` before calling work done.

## Where things live

See [ARCHITECTURE.md](ARCHITECTURE.md) for the module map and data flow, and
[DEVELOPMENT.md](DEVELOPMENT.md) for local setup.
