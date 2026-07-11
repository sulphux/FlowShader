# Development Guide - FlowShader

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- Git

### Installation & Dev Server
```bash
npm install
npm run dev        # http://localhost:5173 (or next free port)
```

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full module map with data
flow. Quick orientation:

- **`src/components/`** — UI: `NodeEditor.tsx` (graph state, ReactFlow),
  `ShaderNode.tsx` (per-node rendering), `ShaderPreview.tsx` (Three.js
  WebGL preview, shared by the main pane and every in-graph preview node),
  plus dialogs (`SettingsDialog`, `CloudDialog`, `CreateCustomNodeDialog`).
- **`src/core/`** — engine: `compiler.ts` (graph → GLSL),
  `connectionValidator.ts` + `autoAdapterSystem.ts` (strict typing +
  auto Split/Combine insertion), `runtimeResources.ts`/`threeResources.ts`
  (texture/audio uniforms), `projectStorage.ts`/`supabaseStorage.ts`
  (local/cloud saves), `fileAccess.ts` (File System Access save/load).
- **`src/nodes/`** — node definitions, registered in `index.ts`
  (`NODE_REGISTRY`, 50 nodes across math/vector/color/media/utils/params).
- **`src/tests/`** — integration/regression tests (in addition to
  `*.test.ts` files colocated next to the code they test).

## Adding a New Node

```typescript
// src/nodes/math.ts (or a new file)
import type { ShaderNodeDefinition } from '../core/types';

export const MyNode: ShaderNodeDefinition = {
  id: 'my_node',            // unique, snake_case — this becomes the GLSL var prefix
  label: 'My Node',
  compact: true,             // small pill-shaped node vs. full card
  description: 'Does something cool',

  inputs: [
    { id: 'a', label: 'A', type: 'float' },
    { id: 'b', label: 'B', type: 'vec3' },
  ],
  outputs: [
    { id: 'out', label: 'Result', type: 'vec3' },
  ],

  // Optional control rendered on the node itself
  controls: { type: 'float', defaultValue: 1.0, min: 0, max: 10, step: 0.1 },

  // inputs are already-cast GLSL expression strings; data carries
  // { value, nodeId, definition, ... } from the node's React state
  glslTemplate: (inputs, data) => {
    const a = inputs.a || '0.0';
    const b = inputs.b || 'vec3(1.0)';
    const factor = data?.value ?? 1.0;
    return `(${b} * ${a} * ${factor})`;
  },
};
```

Register it in `src/nodes/index.ts` (`NODE_REGISTRY`), and add its id to the
menu structures in `Sidebar.tsx` / `ContextMenu.tsx` if it should be
user-addable. Then write a test asserting the exact `glslTemplate` output
(and, ideally, a full-graph compile validated with glslangValidator — see
existing tests in `src/tests/` for the pattern).

## Type System (see ARCHITECTURE.md for the full picture)

```typescript
type DataType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'auto';
// plus multi-type ports as pipe-joined strings, e.g. 'float|vec3'
```

Connections are validated strictly (`connectionValidator.ts`) — same type,
`auto`, or a listed multi-type always connects directly; anything else is
either blocked outright or triggers `autoAdapterSystem.ts` to insert a
Split/Combine node automatically. There is **no** silent implicit casting at
connect time. `autoCast()` (`functionGenerator.ts`) only casts expressions
that are already known-compatible (e.g. a vec3 feeding `gl_FragColor`).

## Testing

```bash
npm test                    # run all tests (watch mode by default)
npx vitest run               # single run, CI-style
npx vitest run <path>        # a single file
npm run test:coverage
```

Write tests that assert the real end state, not just that a component
renders — e.g. the compiled GLSL string, `NODE_REGISTRY`/localStorage
contents after an action, or DOM state after a full simulated user flow.
See `src/tests/graphLoadRegression.test.ts` or
`src/tests/slimAdapters.ui.test.tsx` for the standard this repo holds to.

## Code Style

- TypeScript strict mode, no implicit `any`.
- Functional React components, hooks only.
- Naming: components `PascalCase.tsx`, utilities `camelCase.ts`, node ids
  and GLSL variables `snake_case`.

## Building & Checking

```bash
npx tsc -b          # type-check (also runs as part of `npm run build`)
npm run build       # type-check + production build → dist/
npm run preview     # serve the production build locally
npm run lint         # eslint
```

Run all three (plus `npm test`) before considering a change done.

## Debugging

- **Node doesn't appear in the sidebar** → check it's registered in
  `NODE_REGISTRY` (`src/nodes/index.ts`) and listed in the menu structure
  (`Sidebar.tsx` / `ContextMenu.tsx`).
- **Shader compilation error** → open `< > Code` in the toolbar to see the
  generated GLSL, or check `getShaderValidationReport()` output
  (`core/validator.ts`) which the preview panel surfaces on failure.
- **Type mismatch / connection refused** → check
  `connectionValidator.ts`'s rules; if it should auto-adapt but doesn't,
  the issue is likely in `autoAdapterSystem.ts`'s type resolution.
- If you're an AI agent without a way to click through the UI yourself,
  see [AGENTS.md](AGENTS.md) first — you likely have more capability here
  than you think.

## Resources

- [React](https://react.dev/) · [ReactFlow](https://reactflow.dev/) ·
  [Three.js](https://threejs.org/) · [Vitest](https://vitest.dev/)
- [The Book of Shaders](https://thebookofshaders.com/) ·
  [GLSL Reference](https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language) ·
  [Inigo Quilez Articles](https://iquilezles.org/articles/)

---

**Questions?** Check [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), or repository issues.
