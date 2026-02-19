# FlowShader

**Visual Shader Graph Editor** - Node-based GLSL shader creation with real-time preview

[![Tests](https://img.shields.io/badge/tests-230%20passing-brightgreen)](https://github.com/sulphux/FlowShader)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb)](https://react.dev/)

![FlowShader](https://img.shields.io/badge/Status-Early%20Development-yellow)

## 🎨 Overview

FlowShader is a node-based visual shader editor that allows you to create GLSL fragment shaders through an intuitive drag-and-drop interface. Built with React, TypeScript, and Three.js, it provides real-time compilation and WebGL preview.

### ✨ Key Features

- 🎯 **60+ Shader Nodes** - Math, vectors, colors, SDFs, and more
- 🔄 **Real-time Preview** - Instant WebGL rendering with Three.js
- 🎨 **Visual Graph Editor** - Powered by ReactFlow
- 🔀 **Smart Type System** - Automatic type conversion between float/vec2/vec3/vec4
- 💾 **Save/Load Graphs** - Export and import shader compositions
- 🎛️ **Interactive Controls** - Sliders, color pickers, and parameter nodes
- ⚡ **Fast Compilation** - Optimized GLSL generation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

### Available Commands

```bash
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run test suite (230 tests)
npm run test:ui      # Open Vitest UI
npm run lint         # Run ESLint
```

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and data flow
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development guide and API reference
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Complete project overview
- **[CONNECTION_VALIDATION.md](./CONNECTION_VALIDATION.md)** - Type system details

## 🎮 Usage

1. **Add Nodes** - Drag nodes from the sidebar onto the canvas
2. **Connect Nodes** - Draw connections between compatible outputs and inputs
3. **Configure** - Adjust parameters using built-in controls
4. **Preview** - See real-time shader results in the preview panel
5. **Save** - Export your shader graph as JSON

### Example: Simple Gradient

```
UV Node → Color Palette → Output
```

## 🏗️ Technology Stack

- **React 19.2** - UI framework
- **TypeScript 5.9** - Type safety
- **ReactFlow 11** - Node graph visualization
- **Three.js 0.182** - WebGL shader rendering
- **Vite 7** - Build tool
- **Vitest 4** - Testing framework

## 🧪 Testing

All 230 tests passing:
- ✅ 54 connection validator tests
- ✅ 30 math node tests
- ✅ 28 params tests
- ✅ 28 vector tests
- ✅ 13 compiler tests
- ✅ 13 validator tests
- ✅ And more...

## 🤝 Contributing

This project follows standard TypeScript/React conventions:
- Use functional components and hooks
- Follow ESLint rules
- Write tests for new features
- Update documentation

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed guidelines.

## 📄 License

Private - All rights reserved

## 🔗 Resources

- [The Book of Shaders](https://thebookofshaders.com/) - Learn GLSL
- [Shadertoy](https://www.shadertoy.com/) - Shader examples
- [ReactFlow Docs](https://reactflow.dev/) - Node graph library
- [Three.js Docs](https://threejs.org/) - WebGL framework

---

**Version:** 0.0.0 (Early Development)  
**Last Updated:** 2026-02-19
