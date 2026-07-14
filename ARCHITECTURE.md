# FlowShader Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FlowShader                               │
│                   Visual Shader Graph Editor                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐  ┌──────────────────────┐  ┌──────────────┐   │
│  │  Toolbar   │  │    NodeEditor        │  │   Sidebar    │   │
│  │  (Actions) │  │  (ReactFlow Graph)   │  │ (Node Lib)   │   │
│  └────────────┘  │                      │  └──────────────┘   │
│                  │  ┌────────────────┐  │                      │
│                  │  │  ShaderNode    │  │                      │
│                  │  │  • Ports       │  │  ┌──────────────┐   │
│                  │  │  • Controls    │  │  │ShaderPreview │   │
│                  │  │  • Handles     │  │  │  (Three.js)  │   │
│                  │  └────────────────┘  │  │   WebGL      │   │
│                  │                      │  └──────────────┘   │
│                  └──────────────────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        CORE ENGINE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Compiler    │←→│  Validator   │←→│    Types     │          │
│  │              │  │              │  │              │          │
│  │ • Topo Sort  │  │ • Cycles     │  │ • DataType   │          │
│  │ • GLSL Gen   │  │ • Type Check │  │ • PortDef    │          │
│  │ • Type Cast  │  │ • Conn Valid │  │ • NodeDef    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ AutoAdapter  │  │RuntimeRes.   │  │ProjectStorage│          │
│  │              │  │              │  │              │          │
│  │ • Split/Comb │  │ • Textures   │  │ • Local      │          │
│  │   node insert│  │ • Audio      │  │ • Supabase   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       NODE REGISTRY (50 nodes)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐│
│  │ Math │ │Vector│ │ Color│ │Media │ │Params│ │Utils │ │Custom││
│  ├──────┤ ├──────┤ ├──────┤ ├──────┤ ├──────┤ ├──────┤ ├─────┤│
│  │+ − × ÷│ │ UV   │ │Palette│ │Texture│ │Float │ │Split/│ │Input││
│  │Sin/Cos│ │Scale │ │C.Add │ │Audio │ │Color │ │Combine│ │Output││
│  │Tan/Cot│ │Shift │ │C.Mult│ └──────┘ │Time  │ │(Auto)│ │(sub- ││
│  │Pow/Abs│ │Length│ │Mono  │          └──────┘ │Code  │ │graph)││
│  │Exp/Frc│ │Fract │ │SDF   │                   │Monitor│ └─────┘│
│  └──────┘ └──────┘ └──────┘                   │Preview│         │
│                                                 └──────┘         │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
                        DATA FLOW
═══════════════════════════════════════════════════════════════════

 User Action (Add/Connect Node)
          ↓
 NodeEditor (React state: nodes[], edges[]) ──→ localStorage (auto-save)
          ↓
 onChange callback → compileGraphToGLSL()
          ↓
┌───────────────────────────────────────────┐
│           COMPILATION PIPELINE             │
├───────────────────────────────────────────┤
│  1. Collect + generate custom-node         │
│     GLSL functions (recursive)             │
│  2. Topological sort (dependency order)    │
│  3. For each node:                         │
│     a. Resolve inputs from edges           │
│     b. autoCast() source expr → target type│
│     c. Call glslTemplate(inputs, data)     │
│     d. Store `${type} var_id = expr;`      │
│  4. Collect runtime resources               │
│     (textures/audio → uniform decls)       │
│  5. Assemble final shader string           │
└───────────────────────────────────────────┘
          ↓
 GLSL Fragment Shader Code (string)
          ↓
 ShaderPreview / PreviewNode / MonitorNode / ColorPreviewNode
          ↓
 Three.js ShaderMaterial (+ resource uniforms bound)
          ↓
 WebGL Rendering (Canvas) — 60fps by default, capped by Global Settings

═══════════════════════════════════════════════════════════════════
                      TYPE SYSTEM
═══════════════════════════════════════════════════════════════════

Connections are STRICT (like Unreal Engine Blueprints) — there is no
silent implicit casting at connect time. `connectionValidator.ts`
allows only:

  • same type → same type                (float→float, vec3→vec3, ...)
  • 'auto' type → anything, anything → 'auto'   (adapts dynamically)
  • multi-type ports (e.g. `float|vec3`) → any of the listed types

Everything else is BLOCKED at connect time and, where a conversion is
possible, `autoAdapterSystem.ts` expands the original ports into component
pins inside their nodes instead of adding graph nodes:

┌─────────────────────────────────────────────────────────────────┐
│                    Inline Port Adaptation                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   float → vecN   ⇒  expand target; float feeds target.x          │
│   vecN → float   ⇒  expand source; source.x feeds target         │
│   vecA → vecB    ⇒  expand both original ports and connect       │
│                      matching components (x→x, y→y, ...)         │
│                                                                  │
│   Multi-type targets (e.g. Output's `float|vec3`) resolve to     │
│   the best concrete type before the rules above apply.           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Once a graph is valid, the compiler's `autoCast()` (functionGenerator.ts)
does the low-level string casting for already-compatible expressions —
e.g. producing `vec4(x, 1.0)` for a vec3 driving `gl_FragColor`, or
casting a custom node's subgraph output to its declared port type.
Swizzling (`.x .y .z .w` / `.r .g .b .a`) is supported throughout.

═══════════════════════════════════════════════════════════════════
                    COMPONENT HIERARCHY
═══════════════════════════════════════════════════════════════════

App
 │
 ├─ Sidebar (Portal) ─→ #sidebar-root
 │   └─ Node Library (drag & drop, PARAMS tab)
 │
 ├─ NodeEditor (ReactFlow)
 │   │
 │   ├─ ReactFlow
 │   │   ├─ ShaderNode        (standard nodes: math, vector, color, media, custom)
 │   │   ├─ MonitorNode       (live numeric readout, THREE renderer)
 │   │   ├─ PreviewNode       (mini live preview, embeds ShaderPreview)
 │   │   ├─ ColorPreviewNode  (color swatch readout)
 │   │   └─ Edges (connections)
 │   │
 │   ├─ Toolbar (new/save/save-as/load/cloud/fit/undo/redo/code/settings/clear)
 │   ├─ ContextMenu (quick-add, direction-aware type filtering)
 │   ├─ NodeContextMenu, CreateCustomNodeDialog, SettingsDialog, CloudDialog
 │   ├─ NavigationPanel (breadcrumbs into custom-node subgraphs)
 │   └─ Legend
 │
 └─ ShaderPreview (Three.js) — also used standalone as the main preview pane
     ├─ Canvas / Scene / Camera / Mesh + ShaderMaterial
     ├─ FeedbackPassRenderer (one ping-pong buffer per Feedback node)
     │   ├─ Impulse links use a persistent interval event id; manual Snapshot links use a 0 → 1 edge
     │   └─ Frame Buffer exposes an opaque Buffer2D handle; any number of Sample Buffer nodes
     │      resolve that handle to the same sampler uniform with independent UV/pixel offsets
     └─ Resource uniforms (textures, audio levels, feedback samplers) bound per frame

═══════════════════════════════════════════════════════════════════
                      FILE STRUCTURE
═══════════════════════════════════════════════════════════════════

NodeShader/
├── Examples/                 ← sample .json shader graphs
├── supabase/schema.sql       ← cloud storage schema (optional backend)
├── scripts/docs-screenshots.mjs
│
├── README.md · ARCHITECTURE.md · DEVELOPMENT.md · AGENTS.md
├── CLOUD_SYNC_DESIGN.md · SUPABASE_SETUP.md
│
└── src/
    ├── components/    ← UI (editor, dialogs, node renderers)
    │   ├── NodeEditor.tsx     ← main editor: graph state, history, connect logic
    │   ├── ShaderNode.tsx     ← renders every node's on-canvas UI
    │   ├── ShaderPreview.tsx  ← WebGL preview (shared by all preview windows)
    │   ├── MonitorNode.tsx / PreviewNode.tsx / ColorPreviewNode.tsx
    │   ├── CloudDialog.tsx / SettingsDialog.tsx / CreateCustomNodeDialog.tsx
    │   └── Toolbar.tsx / Sidebar.tsx / ContextMenu.tsx / NodeContextMenu.tsx / ...
    │
    ├── core/          ← engine, no UI
    │   ├── compiler.ts            ← graph → GLSL
    │   ├── functionGenerator.ts   ← custom-node GLSL functions, autoCast()
    │   ├── connectionValidator.ts ← strict type rules
    │   ├── autoAdapterSystem.ts   ← inline component-port adaptation
    │   ├── validator.ts / glslangValidation.ts ← shader correctness checks
    │   ├── runtimeResources.ts / threeResources.ts ← texture/audio/feedback uniforms
    │   ├── feedbackPasses.ts / feedbackPassRenderer.ts ← stateful multi-pass rendering
    │   ├── audioManager.ts        ← Web Audio analyser (level/bass/mid/high)
    │   ├── graphRehydration.ts    ← save/load graph (de)serialization
    │   ├── fileAccess.ts          ← File System Access save/load
    │   ├── globalSettings.ts      ← FPS limit, render quality
    │   ├── projectStorage.ts / supabaseStorage.ts ← local/cloud project storage
    │   ├── customNodeManager.ts   ← custom node persistence
    │   └── types.ts / theme.ts
    │
    ├── nodes/         ← node definitions (registered in index.ts)
    │   ├── index.ts   ← NODE_REGISTRY (50 nodes)
    │   ├── math.ts / vector.ts / utils.ts / params.ts / media.ts
    │   ├── OutputNode.ts / TimeNode.ts / PaletteNode.ts / SDFCircle.ts
    │   └── CustomInput.ts / CustomOutput.ts
    │
    ├── tests/         ← integration/regression tests + test setup
    ├── App.tsx        ← layout (editor + preview split, resizer, hide toggle)
    └── main.tsx        ← entry point

═══════════════════════════════════════════════════════════════════
                     TESTING STRATEGY
═══════════════════════════════════════════════════════════════════

630+ tests (Vitest), spanning:

  • Unit tests       — compiler, validator, auto-adapter, type casting
  • GLSL correctness — every generated shader validated with
                        glslangValidator when available (skipped otherwise)
  • Component tests  — UI behavior (React Testing Library)
  • Regression packs — real saved graphs (Examples/*.json) recompiled and
                        re-validated end to end (catches load/refresh bugs)

Test Commands:
  npm test               → Run all tests
  npx tsc -b             → Type-check
  npm run build          → Production build

═══════════════════════════════════════════════════════════════════
                    KEY ALGORITHMS
═══════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────┐
│              Topological Sort (Compilation Order)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  function sortNodesTopologically(nodes, edges, targetId):       │
│    visited = new Set()                                          │
│    sorted = []                                                  │
│                                                                  │
│    function visit(nodeId):                                      │
│      if visited.has(nodeId): return                             │
│      visited.add(nodeId)                                        │
│                                                                  │
│      // Visit all dependencies first (DFS)                      │
│      for edge in edges where edge.target == nodeId:             │
│        visit(edge.source)                                       │
│                                                                  │
│      sorted.push(node)                                          │
│                                                                  │
│    visit(targetId or outputNode)                                │
│    return sorted  // Dependencies before dependents             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   autoCast() — Explicit Casting                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Applied to an already-compatible source expression, never to    │
│  bypass connection validation — validation happens first.        │
│                                                                  │
│    float → vec2/vec3/vec4     "vecN(expr)"                       │
│    vecN  → float               "(expr).x"                        │
│    vec2  → vec3                "vec3(expr, 0.0)"                 │
│    vec3  → vec2                "(expr).xy"                       │
│    vec3  → vec4                "vec4(expr, 1.0)"                 │
│    vec4  → vec3                "(expr).xyz"                      │
│    vec2  → vec4 / vec4 → vec2  via zero-fill / .xy                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              Runtime Resources (textures / audio)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  collectRuntimeResources(nodes) scans the graph for texture_2d   │
│  and audio_input nodes, producing:                                │
│    • one `uniform sampler2D u_tex_<nodeId>` per texture node      │
│    • shared `u_audio_{level,bass,mid,high}` floats if any audio   │
│      node is present                                              │
│                                                                  │
│  Every render target (main preview, PreviewNode, MonitorNode,    │
│  ColorPreviewNode) binds these via threeResources.ts and updates │
│  audio uniforms each frame from audioManager.ts's AnalyserNode.  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════

See also: README.md (feature tour with screenshots), DEVELOPMENT.md
(local setup), CLOUD_SYNC_DESIGN.md (Supabase provider design).

Last Updated: 2026-07-11
