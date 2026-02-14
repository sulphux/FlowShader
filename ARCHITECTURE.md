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
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │  Compiler    │ ←→ │  Validator   │ ←→ │    Types     │     │
│  │              │    │              │    │              │     │
│  │ • Topo Sort  │    │ • Cycles     │    │ • DataType   │     │
│  │ • GLSL Gen   │    │ • Type Check │    │ • PortDef    │     │
│  │ • Type Cast  │    │ • Conn Valid │    │ • NodeDef    │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       NODE REGISTRY                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  │
│  │ Math │  │Vector│  │ Color│  │ SDF  │  │Params│  │Utils │  │
│  ├──────┤  ├──────┤  ├──────┤  ├──────┤  ├──────┤  ├──────┤  │
│  │ Add  │  │  UV  │  │C.Add │  │Circle│  │Float │  │Split │  │
│  │ Sub  │  │Scale │  │C.Mult│  │ ...  │  │Color │  │Relay │  │
│  │ Mult │  │Shift │  │ ...  │  └──────┘  │ ...  │  │Mix   │  │
│  │ Sin  │  │Length│  └──────┘             └──────┘  │ ...  │  │
│  │ ...  │  │ ...  │                                 └──────┘  │
│  └──────┘  └──────┘                                           │
│                                                                  │
│              60+ Nodes with GLSL Templates                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
                        DATA FLOW
═══════════════════════════════════════════════════════════════════

 User Action (Add/Connect Node)
          ↓
 NodeEditor (React State: nodes[], edges[])
          ↓
 onChange callback → compileGraphToGLSL()
          ↓
┌─────────────────────────────────────────┐
│        COMPILATION PIPELINE             │
├─────────────────────────────────────────┤
│  1. Topological Sort (dependency order) │
│  2. For each node:                      │
│     a. Resolve inputs from edges        │
│     b. Auto type conversion             │
│     c. Call glslTemplate()              │
│     d. Store variable                   │
│  3. Assemble final shader code          │
└─────────────────────────────────────────┘
          ↓
 GLSL Fragment Shader Code (string)
          ↓
 ShaderPreview Component
          ↓
 Three.js ShaderMaterial
          ↓
 WebGL Rendering (Canvas)
          ↓
 User sees result in real-time!

═══════════════════════════════════════════════════════════════════
                      TYPE SYSTEM
═══════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────┐
│                    Automatic Type Conversion                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   float ────┬───→ vec2(f)                                       │
│             ├───→ vec3(f)                                       │
│             └───→ vec4(f, f, f, 1.0)                            │
│                                                                  │
│   vec2 ─────┬───→ vec3(v.xy, 0.0)                               │
│             ├───→ vec4(v.xy, 0.0, 1.0)                          │
│             └───→ v.x (float)                                   │
│                                                                  │
│   vec3 ─────┬───→ vec4(v.xyz, 1.0)                              │
│             ├───→ v.xy (vec2)                                   │
│             └───→ v.x (float)                                   │
│                                                                  │
│   vec4 ─────┬───→ v.xyz (vec3)                                  │
│             ├───→ v.xy (vec2)                                   │
│             └───→ v.x (float)                                   │
│                                                                  │
│   Swizzling Support: .x .y .z .w / .r .g .b .a                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
                    COMPONENT HIERARCHY
═══════════════════════════════════════════════════════════════════

App
 │
 ├─ Sidebar (Portal) ─→ #sidebar-root
 │   └─ Node Library (drag & drop)
 │
 ├─ NodeEditor (ReactFlow)
 │   │
 │   ├─ ReactFlow
 │   │   │
 │   │   ├─ ShaderNode (60+ instances)
 │   │   │   ├─ Input Handles
 │   │   │   ├─ Controls (sliders, colors)
 │   │   │   └─ Output Handles
 │   │   │
 │   │   ├─ MonitorNode (debugging)
 │   │   ├─ PreviewNode (mini preview)
 │   │   └─ Edges (connections)
 │   │
 │   ├─ Toolbar (save/load/clear)
 │   ├─ Legend (shortcuts)
 │   └─ ContextMenu (right-click)
 │
 └─ ShaderPreview (Three.js)
     ├─ Canvas
     ├─ Scene
     ├─ Camera
     └─ Mesh + ShaderMaterial

═══════════════════════════════════════════════════════════════════
                      FILE STRUCTURE
═══════════════════════════════════════════════════════════════════

NodeShader/
├── Examples/
│   └── beautiful.json ← Sample shader graph
│
├── PROJECT_SUMMARY.md ← Overview & documentation
├── DEVELOPMENT.md ← Developer guide
│
└── shader-nodes/
    ├── src/
    │   ├── components/ ← UI components (9 files)
    │   │   ├── NodeEditor.tsx (21KB) ← Main editor
    │   │   ├── ShaderNode.tsx (17KB) ← Node rendering
    │   │   └── ...
    │   │
    │   ├── core/ ← Engine (4 files)
    │   │   ├── compiler.ts ← GLSL generation
    │   │   ├── types.ts ← Type definitions
    │   │   ├── validator.ts ← Graph validation
    │   │   └── theme.ts ← UI colors
    │   │
    │   ├── nodes/ ← Node definitions (10 files)
    │   │   ├── index.ts ← Registry (60+ nodes)
    │   │   ├── math.ts
    │   │   ├── vector.ts
    │   │   ├── utils.ts
    │   │   └── ...
    │   │
    │   ├── tests/ ← Test setup
    │   │   └── setup.ts
    │   │
    │   ├── App.tsx ← Root component
    │   └── main.tsx ← Entry point
    │
    ├── vitest.config.ts ← Test configuration
    ├── package.json ← Dependencies & scripts
    └── ...

═══════════════════════════════════════════════════════════════════
                     TESTING STRATEGY
═══════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────┐
│                       Test Pyramid                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                        ┌─────────┐                              │
│                        │   E2E   │ (Future)                     │
│                        │ Shader  │                              │
│                        └─────────┘                              │
│                    ┌───────────────┐                            │
│                    │  Integration  │ (Planned)                  │
│                    │ Graph → GLSL  │                            │
│                    └───────────────┘                            │
│              ┌─────────────────────────┐                        │
│              │   Component Tests       │ (Ready)                │
│              │ NodeEditor, ShaderNode  │                        │
│              └─────────────────────────┘                        │
│        ┌─────────────────────────────────────┐                  │
│        │        Unit Tests                   │ (Priority)       │
│        │ Compiler, Validator, Type System    │                  │
│        └─────────────────────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Test Commands:
  npm test              → Run all tests
  npm run test:ui       → Vitest UI
  npm run test:coverage → Coverage report

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
│                   Type Conversion Logic                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  if sourceType != targetType:                                   │
│                                                                  │
│    // Upcasting (float → vec*)                                  │
│    if target == vec2 and source == float:                       │
│      return "vec2(" + source + ")"                              │
│                                                                  │
│    if target == vec3 and source == float:                       │
│      return "vec3(" + source + ")"                              │
│                                                                  │
│    if target == vec3 and source == vec2:                        │
│      return "vec3(" + source + ".xy, 0.0)"                      │
│                                                                  │
│    // Downcasting (vec* → smaller)                              │
│    if target == float and source == vec*:                       │
│      return source + ".x"                                       │
│                                                                  │
│    if target == vec2 and source == vec3/vec4:                   │
│      return source + ".xy"                                      │
│                                                                  │
│    if target == vec3 and source == vec4:                        │
│      return source + ".xyz"                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
                    PERFORMANCE NOTES
═══════════════════════════════════════════════════════════════════

• NodeEditor: 21KB (consider code splitting)
• ShaderNode: 17KB (optimized with React.memo)
• Real-time compilation: ~1-5ms for typical graphs
• Large graphs (100+ nodes): May need debouncing
• WebGL rendering: 60 FPS target

Optimization Ideas:
  ✓ React.memo on ShaderNode
  ✓ useCallback for event handlers
  ⚬ Debounce compilation (300ms)
  ⚬ Cache GLSL per node (invalidate on change)
  ⚬ Web Workers for heavy compilation
  ⚬ Virtual scrolling for large node lists

═══════════════════════════════════════════════════════════════════

Last Updated: 2026-02-14
Version: 1.0
