# FlowShader - Project Summary

**Version:** 0.0.0 | **Status:** Early Development | **Last Updated:** 2026-02-19

## Quick Links

- **Repository:** [github.com/sulphux/FlowShader](https://github.com/sulphux/FlowShader)
- **Documentation:** See README.md for quick start
- **Architecture:** See ARCHITECTURE.md for technical details
- **Development:** See DEVELOPMENT.md for contribution guide

## What is FlowShader?

FlowShader is a node-based visual shader editor for creating GLSL fragment shaders through an intuitive drag-and-drop interface. Think Unreal Engine's Material Editor or Blender's Shader Nodes, but for the web.

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| UI Framework | React | 19.2.0 |
| Language | TypeScript | 5.9.3 |
| Graph Editor | ReactFlow | 11.11.4 |
| 3D/Shaders | Three.js | 0.182.0 |
| Build Tool | Vite | 7.2.4 |
| Testing | Vitest | 4.0.18 |
| Linting | ESLint | 9.39.1 |

## Features Overview

### ✅ Current Features

#### Node System (60+ Nodes)
- **Math:** Add, subtract, multiply, divide, sin, cos, abs, exp, pow, mix, negate
- **Vector:** UV coords, length, fract, scale, shift
- **Color:** Addition, multiplication, palette system
- **SDF:** Circle (Signed Distance Functions)
- **Parameters:** Float sliders, color pickers
- **Utilities:** Split/combine vectors, relay nodes
- **Special:** Notes, groups, monitor, preview nodes

#### Editor Features
- Drag-and-drop node creation
- Visual connection system
- Real-time GLSL compilation
- Type-safe edges with validation
- Auto-layout support
- Save/load graph as JSON

#### Type System
- Automatic conversion: `float` ↔ `vec2` ↔ `vec3` ↔ `vec4`
- GLSL swizzling support (`.x`, `.y`, `.z`, `.w`, `.r`, `.g`, `.b`, `.a`)
- Smart type inference
- Explicit conversion via Split/Combine nodes

#### UI/UX
- Resizable split-pane layout
- Floating/docked preview modes
- Context menu for operations
- Keyboard shortcuts
- Categorized node library
- Value monitoring system

### 🚧 Planned Features

- [ ] More SDF shapes (rectangle, triangle, polygon)
- [ ] Texture sampling nodes
- [ ] Custom function nodes
- [ ] Graph templates/presets
- [ ] Undo/redo system
- [ ] Node search/filtering
- [ ] Export shader code
- [ ] Shader optimization pass
- [ ] Performance profiling

## Project Structure

```
FlowShader/
├── src/
│   ├── components/        # React UI components (9 files)
│   │   ├── NodeEditor.tsx      # Main graph editor (21KB)
│   │   ├── ShaderNode.tsx      # Node rendering (17KB)
│   │   ├── ShaderPreview.tsx   # Three.js WebGL preview
│   │   ├── Sidebar.tsx         # Node library
│   │   ├── Toolbar.tsx         # Actions bar
│   │   ├── MonitorNode.tsx     # Value debugging
│   │   └── ...
│   │
│   ├── core/              # Engine (4 files)
│   │   ├── compiler.ts         # GLSL generation
│   │   ├── types.ts            # Type definitions
│   │   ├── validator.ts        # Graph validation
│   │   └── theme.ts            # UI colors
│   │
│   ├── nodes/             # Node definitions (10 files)
│   │   ├── index.ts            # Registry (60+ nodes)
│   │   ├── math.ts
│   │   ├── vector.ts
│   │   └── ...
│   │
│   └── tests/             # Test files (18 files, 230 tests)
│
├── Examples/
│   └── beautiful.json     # Sample shader graph
│
├── Documentation/
│   ├── README.md              # Main entry point
│   ├── ARCHITECTURE.md        # System design
│   ├── DEVELOPMENT.md         # Dev guide
│   └── CONNECTION_VALIDATION.md
│
└── Configuration/
    ├── package.json
    ├── tsconfig*.json
    ├── vite.config.ts
    └── vitest.config.ts
```

## Test Coverage

**230 tests passing across 18 test files:**

| Test Suite | Tests | Focus Area |
|------------|-------|------------|
| connection validator | 54 | Type system validation |
| math nodes | 30 | Mathematical operations |
| params | 28 | Parameter inputs |
| vector nodes | 28 | Vector operations |
| compiler | 13 | GLSL generation |
| validator | 13 | Graph validation |
| types | 12 | Type definitions |
| custom nodes | 8 | Custom node system |
| Others | 44 | Various features |

## Recent Changes

### Latest: Fix TypeScript Configuration (2026-02-19)
- ✅ Created missing `tsconfig.app.json` and `tsconfig.node.json`
- ✅ Fixed test execution - all 230 tests passing
- ✅ Cleaned up documentation structure

### Previous: Testing Infrastructure (2026-02-14)
- ✅ Removed 7 old/duplicate example files
- ✅ Renamed example file to `beautiful.json`
- ✅ Added Vitest testing framework
- ✅ Added React Testing Library
- ✅ Created 18 comprehensive test files

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Development server (http://localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
npm test             # Run all tests
npm run test:ui      # Interactive test UI
npm run test:coverage # Test coverage report
npm run lint         # Run ESLint
```

## Performance Characteristics

- **Compilation Time:** ~1-5ms for typical graphs
- **Large Graphs:** 100+ nodes may need optimization
- **WebGL Rendering:** 60 FPS target
- **Node Editor:** 21KB (largest component)
- **Real-time Updates:** Compiles on every change

## Known Limitations

- WebGL canvas not mocked in tests (expected warnings)
- No undo/redo yet
- No texture sampling yet
- Type conversions are automatic (may need manual control in future)

## Resources

- [The Book of Shaders](https://thebookofshaders.com/) - GLSL tutorial
- [Shadertoy](https://www.shadertoy.com/) - Shader examples
- [ReactFlow Documentation](https://reactflow.dev/)
- [Three.js Documentation](https://threejs.org/)
- [Inigo Quilez Articles](https://iquilezles.org/articles/) - SDF techniques

---

For detailed architecture information, see [ARCHITECTURE.md](./ARCHITECTURE.md).  
For development guidelines, see [DEVELOPMENT.md](./DEVELOPMENT.md).
