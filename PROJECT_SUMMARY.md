# FlowShader - Visual Shader Graph Editor

## Project Overview

**FlowShader** is a node-based visual shader editor built with React, TypeScript, and Three.js. It allows users to create GLSL fragment shaders through an intuitive node graph interface, with real-time preview and compilation.

## Key Information

- **Repository**: [github.com/sulphux/FlowShader](https://github.com/sulphux/FlowShader)
- **Version**: 0.0.0 (Early Development)
- **Tech Stack**: React 19, TypeScript, Vite, Three.js, ReactFlow
- **License**: Private

## Technology Stack

### Core Dependencies
- **React 19.2.0** - UI framework
- **ReactFlow 11.11.4** - Node graph visualization and interaction
- **Three.js 0.182.0** - WebGL shader rendering and preview
- **TypeScript 5.9.3** - Type safety and developer experience
- **Vite 7.2.4** - Build tool and dev server

### Development Tools
- **ESLint 9.39.1** - Code linting with React-specific rules
- **Vitest 4.0.18** - Unit testing framework
- **Testing Library** - React component testing
- **jsdom 28.0.0** - DOM environment for testing

## Features

### Current Features ✅
1. **Node-Based Shader Editor**
   - Drag-and-drop node creation
   - Visual connection system with type-safe edges
   - Real-time GLSL compilation
   - Auto-layout and graph validation

2. **Node Categories**
   - **Math**: Add, subtract, multiply, divide, sin, cos, abs, exp, pow
   - **Vector**: UV coords, length, fract, scale, shift
   - **Color**: Color addition, multiplication
   - **SDF**: Circle (more shapes planned)
   - **Parameters**: Float sliders, color pickers
   - **Utilities**: Split/combine vectors, relay nodes, mix, negate
   - **Special**: Notes, groups, monitor, preview

3. **Real-Time Preview**
   - Live shader compilation to GLSL
   - WebGL rendering with Three.js
   - Floating/docked preview modes
   - Picture-in-Picture support

4. **Advanced UI**
   - Resizable split-pane layout
   - Context menu for node operations
   - Sidebar with categorized node library
   - Toolbar with graph operations
   - Legend for keyboard shortcuts
   - Value monitoring system

5. **Type System**
   - Automatic type conversion (float ↔ vec2 ↔ vec3 ↔ vec4)
   - Swizzling support (.x, .y, .z, .w, .r, .g, .b, .a)
   - Smart type inference

## Project Structure

```
NodeShader/
├── Examples/
│   └── beautiful.json                 # Sample shader graph
│
└── shader-nodes/                      # Main application
    ├── src/
    │   ├── components/                # React UI components
    │   │   ├── __tests__/            # Component tests
    │   │   ├── ContextMenu.tsx       # Right-click menu
    │   │   ├── Legend.tsx            # Keyboard shortcuts display
    │   │   ├── MonitorNode.tsx       # Value monitoring node
    │   │   ├── NodeEditor.tsx        # Main graph editor (21KB)
    │   │   ├── PreviewNode.tsx       # In-graph shader preview
    │   │   ├── ShaderNode.tsx        # Individual node component (17KB)
    │   │   ├── ShaderPreview.tsx     # Three.js preview renderer
    │   │   ├── Sidebar.tsx           # Node library panel
    │   │   └── Toolbar.tsx           # Top toolbar
    │   │
    │   ├── core/                      # Core engine
    │   │   ├── compiler.ts           # GLSL code generation
    │   │   ├── types.ts              # TypeScript definitions
    │   │   ├── validator.ts          # Graph validation
    │   │   └── theme.ts              # UI theming
    │   │
    │   ├── nodes/                     # Node definitions
    │   │   ├── index.ts              # Node registry (60+ nodes)
    │   │   ├── math.ts               # Math operations
    │   │   ├── vector.ts             # Vector operations
    │   │   ├── utils.ts              # Utility nodes (6KB)
    │   │   ├── params.ts             # Parameter inputs
    │   │   ├── TimeNode.ts           # Time/animation
    │   │   ├── SDFCircle.ts          # Signed distance function
    │   │   ├── PaletteNode.ts        # Color palette
    │   │   ├── OutputNode.ts         # Final output
    │   │   └── MathNodes.ts          # Legacy math nodes
    │   │
    │   ├── tests/                     # Test directory (empty, ready for tests)
    │   ├── assets/                    # Static assets
    │   ├── App.tsx                    # Main application component
    │   ├── App.css                    # App styles
    │   ├── index.css                  # Global styles
    │   └── main.tsx                   # Application entry point
    │
    ├── public/                        # Static public assets
    ├── node_modules/                  # Dependencies
    ├── package.json                   # Project configuration
    ├── package-lock.json              # Dependency lock file
    ├── vite.config.ts                 # Vite configuration
    ├── tsconfig.json                  # TypeScript configuration
    ├── tsconfig.app.json              # App TypeScript config
    ├── tsconfig.node.json             # Node TypeScript config
    ├── eslint.config.js               # ESLint configuration
    └── README.md                      # Project documentation
```

## Architecture

### Compilation Pipeline
1. **Graph Structure**: ReactFlow manages node positions and connections
2. **Topological Sort**: Compiler orders nodes based on dependencies
3. **GLSL Generation**: Each node provides a GLSL template
4. **Type Conversion**: Automatic casting between float/vec2/vec3/vec4
5. **Code Assembly**: Final shader code compilation
6. **WebGL Rendering**: Three.js executes the shader

### Key Components

#### NodeEditor (21KB)
- Manages ReactFlow instance
- Handles node creation/deletion
- Graph serialization (save/load)
- Keyboard shortcuts
- Sidebar portal integration

#### ShaderNode (17KB)
- Renders individual nodes
- Input/output handles with type colors
- Parameter controls (sliders, color pickers)
- Compact/expanded modes
- Value monitoring integration

#### Compiler
- Topological graph traversal
- GLSL code generation
- Type-safe edge handling
- Swizzling support
- Smart type conversion

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production (TypeScript + Vite)
npm run lint     # Run ESLint
npm run preview  # Preview production build
npm test         # Run tests (to be configured)
```

## Recent Changes

### Latest Commit (1a17cf7)
**"Clean up examples and add testing infrastructure"**

- ✅ Removed 7 old/duplicate shader graph examples
- ✅ Renamed `shader_graph_1769882026082.json` → `beautiful.json`
- ✅ Added Vitest for unit testing
- ✅ Added jsdom for DOM testing
- ✅ Added React Testing Library
- ✅ Added @testing-library/jest-dom

### Previous Commits
- `8794860` - Stable version
- `eaea0dc` - Finally working value monitor
- `f516895` - All works
- `6a372c0` - Added Sidebar
- `462016f` - Preview feature ready

## Development Roadmap

### Planned Features 🚧
- [ ] More SDF shapes (rectangle, triangle, etc.)
- [ ] Texture sampling nodes
- [ ] Custom function nodes
- [ ] Graph templates/presets
- [ ] Undo/redo system
- [ ] Node search/filtering
- [ ] Export shader code
- [ ] Shader optimization
- [ ] Performance profiling

### Testing Strategy
- [ ] Unit tests for compiler
- [ ] Unit tests for type conversion
- [ ] Component tests for nodes
- [ ] Integration tests for graph operations
- [ ] E2E tests for shader compilation

## Node Registry (60+ Nodes)

### Output
- `output` - Final shader output

### Time & Animation
- `time` - Animation time

### SDF (Signed Distance Functions)
- `sdf_circle` - Circle SDF

### Color
- `palette` - Color palette
- `color_add` - Add colors
- `color_mult` - Multiply colors
- `param_color` - Color picker

### Math Operations
- `math_add`, `math_sub`, `math_mult`, `math_div`
- `math_sin`, `math_cos`
- `math_abs`, `math_exp`, `math_pow`
- `math_mix` - Linear interpolation
- `math_negate` - Negate value

### Vector Operations
- `uv` - UV coordinates
- `vec_length` - Vector length
- `vec_fract` - Fractional part
- `uv_scale` - Scale UV
- `uv_shift` - Offset UV

### Vector Utilities
- `split_vec2`, `split_vec3`, `split_vec4` - Split vectors
- `combine_vec2`, `combine_vec3`, `combine_vec4` - Combine scalars
- `smart_split` - Auto-detect split
- `smart_compose` - Auto-detect compose

### Parameters
- `param_float` - Float slider
- `param_color` - Color picker

### Relay Nodes
- `relay_float` - Float passthrough
- `relay_vec3` - Vec3 passthrough

### Special
- `special_note` - Text annotation
- `special_group` - Visual grouping
- `preview` - In-graph preview
- `monitor` - Value monitor

## Type System

### Supported Types
- `float` - Single scalar value
- `vec2` - 2D vector (x, y)
- `vec3` - 3D vector / RGB color (x, y, z)
- `vec4` - 4D vector / RGBA color (x, y, z, w)

### Automatic Conversions
```glsl
float → vec2   # vec2(f)
float → vec3   # vec3(f)
float → vec4   # vec4(f, f, f, 1.0)
vec2 → vec3    # vec3(v.xy, 0.0)
vec3 → vec4    # vec4(v.xyz, 1.0)
vec4 → vec3    # v.xyz
vec3 → vec2    # v.xy
vec2 → float   # v.x
```

## UI Features

### Layout
- **Split-pane**: Resizable editor/preview
- **Floating Preview**: Picture-in-Picture mode
- **Sidebar**: Collapsible node library
- **Toolbar**: Quick actions

### Interactions
- **Drag & Drop**: Create nodes from sidebar
- **Right-click**: Context menu
- **Connections**: Type-colored edges
- **Pan & Zoom**: Navigate large graphs

### Keyboard Shortcuts
- Graph operations (details in Legend component)
- Node manipulation
- View controls

## Configuration Files

### TypeScript
- `tsconfig.json` - Base configuration
- `tsconfig.app.json` - Application config
- `tsconfig.node.json` - Node/Vite config

### Build
- `vite.config.ts` - Vite bundler settings
- `eslint.config.js` - Linting rules

## Contributing

### Code Style
- TypeScript strict mode
- ESLint + TypeScript ESLint
- React hooks rules
- Functional components

### Naming Conventions
- Components: PascalCase
- Files: PascalCase for components, camelCase for utilities
- Node IDs: snake_case
- GLSL variables: snake_case

## Performance Notes

- **Large files**: NodeEditor.tsx (21KB), ShaderNode.tsx (17KB)
- **Registry**: 60+ node definitions
- **Real-time compilation**: Optimized for fast iteration
- **Type conversion overhead**: Minimal, compile-time

## Known Issues

- Empty `Examples/` directory (cleaned up)
- Empty `tests/` directory (testing setup ready)
- Tests directory structure ready but no tests written yet

## Contact & Links

- **Repository**: https://github.com/sulphux/FlowShader
- **Main Branch**: `main`
- **Latest Stable**: commit `1a17cf7`

---

**Last Updated**: 2026-02-14  
**Document Version**: 1.0
