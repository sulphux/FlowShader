# Development Guide - FlowShader

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Installation
```bash
cd shader-nodes
npm install
```

### Development Server
```bash
npm run dev
```
Opens at `http://localhost:5173`

## Project Structure Explained

### `/src/components`
React components for the UI. Main components:

- **NodeEditor.tsx** (21KB) - Main graph editor, handles ReactFlow instance
- **ShaderNode.tsx** (17KB) - Individual node rendering with ports and controls
- **ShaderPreview.tsx** - Three.js WebGL preview
- **Sidebar.tsx** - Node library panel
- **Toolbar.tsx** - Top action bar
- **MonitorNode.tsx** - Special node for debugging values
- **ContextMenu.tsx** - Right-click menu

### `/src/core`
Core engine and utilities:

- **compiler.ts** - Converts node graph to GLSL code
- **types.ts** - TypeScript type definitions
- **validator.ts** - Graph validation logic
- **theme.ts** - UI color scheme

### `/src/nodes`
Node definitions organized by file:

- **index.ts** - Central registry (60+ nodes)
- **math.ts** - Math operations (add, multiply, sin, cos, etc.)
- **vector.ts** - Vector operations (UV, length, scale, etc.)
- **utils.ts** - Utility nodes (split, combine, relay, etc.)
- **params.ts** - Parameter inputs (float slider, color picker)
- **TimeNode.ts** - Animation time
- **SDFCircle.ts** - Signed distance function
- **PaletteNode.ts** - Color palette
- **OutputNode.ts** - Final output

**Future**: `/src/nodes/categories/` structure created for better organization

### `/src/tests`
Test files (setup complete, tests to be written):

- **setup.ts** - Vitest configuration with Testing Library

## Adding a New Node

### Step 1: Define the Node
Create a new node definition or add to existing file:

```typescript
// src/nodes/math.ts or new file
import type { ShaderNodeDefinition } from '../core/types';

export const MyNode: ShaderNodeDefinition = {
  id: 'my_node',           // Unique identifier (snake_case)
  label: 'My Node',        // Display name
  compact: false,          // true for small nodes
  description: 'Does something cool',
  
  inputs: [
    { id: 'a', label: 'Input A', type: 'float' },
    { id: 'b', label: 'Input B', type: 'vec3' }
  ],
  
  outputs: [
    { id: 'out', label: 'Result', type: 'vec3' }
  ],
  
  // Optional: Add controls (slider, color picker, text)
  controls: {
    type: 'float',
    defaultValue: 1.0,
    min: 0,
    max: 10,
    step: 0.1
  },
  
  // GLSL code generation
  glslTemplate: (inputs, data) => {
    const a = inputs.a || '0.0';
    const b = inputs.b || 'vec3(1.0)';
    const factor = data?.value ?? 1.0;
    
    return `(${b} * ${a} * ${factor})`;
  }
};
```

### Step 2: Register the Node
Add to `src/nodes/index.ts`:

```typescript
import { MyNode } from './myfile';

export const NODE_REGISTRY = {
  // ... existing nodes
  my_node: MyNode,
};
```

### Step 3: Test
- Restart dev server
- Node appears in sidebar
- Drag to canvas and connect

## Type System

### Supported Types
```typescript
type DataType = 'float' | 'vec2' | 'vec3' | 'vec4';
```

### Type Conversion Rules
The compiler automatically converts between types:

```glsl
// float → vec*
float → vec2   // vec2(f)
float → vec3   // vec3(f)
float → vec4   // vec4(f, f, f, 1.0)

// vec* → vec*
vec2 → vec3    // vec3(v.xy, 0.0)
vec3 → vec4    // vec4(v.xyz, 1.0)
vec4 → vec3    // v.xyz
vec3 → vec2    // v.xy

// vec* → float
vec* → float   // v.x
```

### Swizzling
Edges support GLSL swizzling:
- `.x`, `.y`, `.z`, `.w` (positional)
- `.r`, `.g`, `.b`, `.a` (color)

Example: Connect `vec3` output to `float` input via `.x` handle

## Testing

### Running Tests
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage # With coverage report
```

### Writing Tests

#### Component Test Example
```typescript
// src/components/__tests__/MyComponent.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

#### Compiler Test Example
```typescript
// src/core/__tests__/compiler.test.ts
import { describe, it, expect } from 'vitest';
import { compileGraphToGLSL } from '../compiler';

describe('Compiler', () => {
  it('compiles simple graph', () => {
    const nodes = [/* ... */];
    const edges = [/* ... */];
    const glsl = compileGraphToGLSL(nodes, edges);
    expect(glsl).toContain('void main()');
  });
});
```

## Code Style

### TypeScript
- Strict mode enabled
- No implicit any
- Use interfaces for complex types
- Prefer type over interface for simple types

### React
- Functional components only
- Hooks over class components
- Use `useCallback` for event handlers
- Use `useMemo` for expensive computations

### Naming
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Node IDs: `snake_case`
- GLSL vars: `snake_case`

### Imports
```typescript
// External libraries
import { useState } from 'react';
import type { Node } from 'reactflow';

// Internal - absolute imports (future)
import { ShaderNodeDefinition } from '@core/types';
import NodeEditor from '@components/NodeEditor';

// Internal - relative imports (current)
import { compileGraphToGLSL } from '../core/compiler';
import type { GraphNode } from './types';
```

## Building & Deployment

### Build for Production
```bash
npm run build
```
Output in `dist/`

### Preview Production Build
```bash
npm run preview
```

### Type Checking
```bash
tsc --noEmit
```

### Linting
```bash
npm run lint
```

## Architecture Deep Dive

### Graph Compilation Flow

1. **User Edits Graph**
   - NodeEditor catches `onNodesChange` / `onEdgesChange`
   - Triggers `handleGraphChange` callback

2. **Type Conversion**
   - Converts ReactFlow `Node[]` to `GraphNode[]`
   - Ensures type safety

3. **Topological Sort**
   - Compiler analyzes dependencies
   - Orders nodes from inputs → output
   - Detects cycles (future: error handling)

4. **GLSL Generation**
   - For each node in order:
     - Resolve input values (from edges or defaults)
     - Call `glslTemplate(inputs, data)`
     - Store result in `nodeVarMap`

5. **Type Casting**
   - Automatic conversions inserted
   - Swizzling handled (.x, .y, etc.)
   - Constructor calls (vec2, vec3, etc.)

6. **Final Assembly**
   - Combine all statements
   - Wrap in `void main() { ... }`
   - Return to ShaderPreview

7. **WebGL Rendering**
   - Three.js ShaderMaterial receives code
   - Fragment shader executes per pixel
   - Canvas updated in real-time

### State Management

Currently using React local state:
- `NodeEditor` - graph state (nodes, edges)
- `App` - layout state (split %, floating mode)
- `ShaderPreview` - shader code

Future: Consider Zustand/Redux for complex state

### Performance Considerations

- **Large Graphs**: 100+ nodes may slow compilation
- **Real-time**: Compilation runs on every change
- **Optimization Ideas**:
  - Debounce compilation
  - Cache GLSL per node
  - Incremental compilation
  - Worker threads

## Debugging

### Common Issues

**Node doesn't appear in sidebar**
→ Check NODE_REGISTRY in `src/nodes/index.ts`

**Shader compilation error**
→ Check browser console for GLSL errors
→ Verify `glslTemplate` returns valid GLSL

**Type mismatch**
→ Ensure edge types are compatible
→ Compiler auto-converts, but check logic

**Three.js errors**
→ Check ShaderPreview WebGL context
→ Verify shader code syntax

### Debug Tools

```typescript
// In compiler.ts
console.log('Sorted nodes:', sortedNodes);
console.log('Generated GLSL:', glsl);

// In ShaderNode.tsx
console.log('Node data:', node.data);

// In NodeEditor.tsx
console.log('Graph state:', nodes, edges);
```

## Git Workflow

### Branches
- `main` - stable releases
- `develop` - active development (if needed)
- `feature/*` - new features
- `fix/*` - bug fixes

### Commit Messages
Follow existing style:
```
Short description (50 chars)

- Bullet point details
- What changed and why
- Reference issues if any
```

### Before Committing
```bash
npm run lint        # Fix linting errors
npm test            # Run tests
npm run build       # Ensure build works
git status          # Review changes
git diff            # Check diff
```

## Roadmap & TODOs

### High Priority
- [ ] Write tests for compiler
- [ ] Write tests for type conversion
- [ ] Add more SDF shapes
- [ ] Texture sampling nodes
- [ ] Undo/redo system

### Medium Priority
- [ ] Export shader code feature
- [ ] Import/export graph templates
- [ ] Node search/filter in sidebar
- [ ] Keyboard shortcuts system
- [ ] Graph minimap

### Low Priority
- [ ] Custom function nodes
- [ ] Shader optimization pass
- [ ] Performance profiling
- [ ] Dark/light theme toggle
- [ ] Localization

### Code Quality
- [ ] Move nodes to `/categories` structure
- [ ] Add path aliases (@components, @core, etc.)
- [ ] Extract magic numbers to constants
- [ ] Add JSDoc comments to complex functions
- [ ] Set up CI/CD pipeline

## Resources

### Documentation
- [React](https://react.dev/)
- [ReactFlow](https://reactflow.dev/)
- [Three.js](https://threejs.org/)
- [Vitest](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)

### GLSL References
- [The Book of Shaders](https://thebookofshaders.com/)
- [GLSL Reference](https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language)
- [Shadertoy](https://www.shadertoy.com/)
- [Inigo Quilez Articles](https://iquilezles.org/articles/)

### Tools
- [GLSL Sandbox](http://glslsandbox.com/)
- [ShaderToy](https://www.shadertoy.com/)
- [GLSL Editor](https://glsleditor.com/)

---

**Questions?** Check PROJECT_SUMMARY.md or repository issues.

**Last Updated**: 2026-02-14
