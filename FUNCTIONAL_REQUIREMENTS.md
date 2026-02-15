# NodeShader - Functional Requirements Document

## Core Principles

### 1. **Unreal Engine-Style Strict Type Validation**
- ✅ NO automatic type conversions between incompatible types
- ✅ `float` ≠ `vec3` - must use explicit conversion nodes
- ✅ `auto` type can connect to anything (universal adapter)
- ✅ Multi-type ports (e.g., `float|vec3`) accept only specified types
- ✅ Connection validation happens BEFORE edge creation
- ✅ Type colors match Unreal Engine convention (Red=float, Green=vec2, Blue=vec3, Yellow=vec4, Purple=auto)

### 2. **Custom Nodes are the Killer Feature**
- ✅ Must work flawlessly in all scenarios
- ✅ End-to-end functionality tested, not just UI
- ✅ Create empty custom nodes (not just from selection)
- ✅ Recursive compilation support
- ✅ Visual distinction (purple border, 🔲 icon, CUSTOM badge)
- ✅ Port refresh after editing
- ✅ Navigation stack with breadcrumbs

### 3. **Zero Console Errors in Production**
- ✅ No `console.error` or `console.warn` in production code
- ✅ Tests verify console cleanliness
- ✅ Graceful error handling with user-friendly alerts

### 4. **All Tests Must Pass**
- ✅ Currently: 272 tests passing
- ✅ Target: 282+ tests (adding E2E workflows)
- ✅ 100% pass rate required before commits
- ✅ No shallow tests - must verify end results

---

## Custom Nodes System

### Requirements

#### ✅ Create from Selection
- User selects nodes + edges
- Right-click → "Create Custom Node"
- Enters name + description
- Creates custom node wrapping selection
- Subgraph contains selected nodes and internal edges

#### ✅ Create Empty (Default Nodes)
- User right-clicks on empty canvas
- "Create Custom Node" is ALWAYS enabled
- Enters name + description
- Creates custom node with defaults:
  - 1x Custom Input node (position: x=100, y=200)
  - 1x Output node (position: x=400, y=200)
  - No edges (user adds later)

#### ✅ Double-Click to Enter/Edit
- Double-click custom node instance
- Enters subgraph editing mode
- Navigation stack saves current state
- Breadcrumbs show hierarchy
- Can edit nodes/connections inside

#### ✅ Navigation Stack with Breadcrumbs
- Main → Level1 → Level2 (supports nesting)
- Breadcrumbs panel (floating purple panel):
  - Clickable level names
  - "Up One Level" button
  - "Exit to Main" button
- Preserves state of each level

#### ✅ Delete with Usage Warnings
- Right-click custom node in sidebar → "Delete"
- If used on canvas: Shows warning dialog
- User confirms deletion
- Removes from:
  - localStorage (`custom_nodes_library`)
  - NODE_REGISTRY
  - Sidebar (auto-refresh)

#### ✅ Port Refresh After Editing
- User edits custom node subgraph
- Adds/removes Custom Input or Custom Output nodes
- Navigates back to parent
- **CRITICAL**: System extracts ports from subgraph
- All instances of custom node update their ports
- Connections to removed ports are deleted

#### ✅ Recursive Compilation
- Custom nodes can contain other custom nodes
- Compiler recursively compiles subgraphs
- Custom Input nodes receive values from parent connections
- Custom Output nodes return values to parent
- `glslTemplate` is placeholder (actual code from subgraph)

#### ✅ Visual Distinction
- **Border**: Purple (#9c27b0) vs normal gray (#555)
- **Box-shadow**: Purple glow (0 4px 12px rgba(156, 39, 176, 0.4))
- **Icon**: 🔲 next to name in node header
- **Badge**: "🔲 CUSTOM" floating above node (purple background)
- **Selected**: Purple border becomes pink (#ff007a)

---

## Workflows

### Workflow 1: Create Empty Custom Node
```
1. User right-clicks on empty canvas
2. Context menu shows "📦 Create Custom Node" (enabled, not grayed)
3. User clicks "Create Custom Node"
4. Dialog appears with fields:
   - Name: [text input]
   - Description: [text input, optional]
5. User enters name "MyNode"
6. User clicks "Create"
7. System:
   - Creates `custom_mynode` in NODE_REGISTRY
   - Saves to localStorage
   - Adds default subgraph:
     * Custom Input node at (100, 200)
     * Output node at (400, 200)
   - Dispatches 'customNodesUpdated' event
8. Sidebar refreshes, shows "MyNode" in "Custom Nodes" category
9. User can drag "MyNode" onto canvas
10. User can double-click to edit internal nodes
```

### Workflow 2: Create Custom Node from Selection
```
1. User adds nodes: Add (id=1), Multiply (id=2)
2. User connects: Add.result → Multiply.a
3. User selects both nodes (Shift+Click or drag-select)
4. User right-clicks → "Create Custom Node"
5. User enters name "MathOperations"
6. System:
   - Extracts selected nodes [1, 2]
   - Extracts edges connecting them
   - Creates custom_mathoperations
   - Subgraph contains copied nodes + edges
7. Optionally: System deletes original nodes (configurable)
8. Custom node appears in sidebar
```

### Workflow 3: Edit Custom Node and Port Refresh
```
1. User creates empty custom node "Processor"
2. User double-clicks "Processor" instance
3. Navigation panel shows: Main > Processor
4. User sees default: Custom Input + Output
5. User adds another Custom Input node (label: "Factor")
6. User clicks "Exit to Main" in navigation panel
7. System:
   - Saves subgraph to custom_processor definition
   - Extracts ports: [Input, Factor] → [Out]
   - Updates NODE_REGISTRY[custom_processor].inputs
   - Refreshes all "Processor" instances on canvas
8. User sees "Processor" now has 2 input handles
```

### Workflow 4: Delete Custom Node with Warning
```
1. User creates custom node "Test"
2. User drags "Test" instance onto canvas
3. User right-clicks "Test" in sidebar → "Delete"
4. System checks: instances on canvas?
5. System shows alert: "⚠️ This custom node is currently used on the canvas. Delete anyway?"
6. User clicks "OK"
7. System:
   - Calls deleteCustomNode('custom_test')
   - Removes from localStorage
   - Deletes from NODE_REGISTRY
   - Dispatches 'customNodesUpdated'
   - Sidebar refreshes (node disappears)
8. Existing instances remain but broken (orphaned)
```

### Workflow 5: Nested Custom Nodes
```
1. User creates custom node "Inner" (empty)
2. User creates custom node "Outer" (empty)
3. User enters "Outer" subgraph
4. User drags "Inner" into "Outer" subgraph
5. User exits to Main
6. User drags "Outer" onto canvas
7. Compiler recursively compiles:
   - Outer.glslTemplate → compiles Outer.subgraph
   - Finds Inner node → compiles Inner.subgraph
   - Returns nested GLSL code
```

---

## Type System

### Supported Types
| Type | Color | Description | Example |
|------|-------|-------------|---------|
| `float` | Red (#ff4444) | Single scalar | `1.5` |
| `vec2` | Green (#44ff44) | 2D vector | `vec2(1.0, 0.5)` |
| `vec3` | Blue (#4444ff) | 3D vector/color | `vec3(1.0, 0.0, 0.0)` |
| `vec4` | Yellow (#ffff44) | 4D vector/RGBA | `vec4(1.0, 0.0, 0.0, 1.0)` |
| `auto` | Purple (#9333ea) + rainbow | Universal adapter | Adapts to connected type |

### Connection Validation Rules

#### Rule 1: Exact Type Match
```
float → float ✅
vec3 → vec3 ✅
vec2 → vec3 ❌ (incompatible)
```

#### Rule 2: Auto Type Universal
```
auto → float ✅
auto → vec3 ✅
float → auto ✅
vec3 → auto ✅
```

#### Rule 3: Multi-Type Ports
```
float|vec3 → float ✅
float|vec3 → vec3 ✅
float|vec3 → vec2 ❌
```

#### Rule 4: No Automatic Conversions
```
float → vec3 ❌ (must use explicit "float to vec3" node)
vec3 → float ❌ (must use explicit "vec3 to float" or swizzle .x)
```

#### Rule 5: Smart Split Adaptation
```
Smart Split (auto input):
  - float input → outputs: [x: float]
  - vec2 input → outputs: [x: float, y: float]
  - vec3 input → outputs: [x: float, y: float, z: float]
  - vec4 input → outputs: [x: float, y: float, z: float, w: float]
```

#### Rule 6: Single Connection Per Input
```
Node A.out → Node B.in ✅
Node C.out → Node B.in (replaces A→B connection)
Result: Only C→B exists
```

### Type Colors (Unreal Engine Style)
```typescript
const TYPE_COLORS = {
  float: '#ff4444',    // Red
  vec2: '#44ff44',     // Green  
  vec3: '#4444ff',     // Blue
  vec4: '#ffff44',     // Yellow
  auto: '#9333ea'      // Purple (with CSS rainbow animation)
};
```

---

## Complete Node Specifications

This section provides detailed specifications for all 45+ nodes in the application.

### Legend
- **ID**: Unique identifier in NODE_REGISTRY
- **Label**: Display name on node
- **Category**: Menu category
- **Compact**: Whether node uses compact circular mode
- **Inputs**: Input ports (id, label, type)
- **Outputs**: Output ports (id, label, type)
- **Controls**: User controls (sliders, color pickers, text)
- **GLSL**: Template for shader code generation
- **Use Cases**: Common usage patterns
- **Notes**: Special behaviors or edge cases

---

### Output & Inputs Category

#### output
- **ID**: `output`
- **Label**: "Output (Screen)"
- **Category**: Output & Inputs
- **Compact**: false
- **Inputs**: 
  - `color: float|vec3` - Final color (multi-type: accepts float OR vec3)
- **Outputs**: None (final output)
- **Controls**: None
- **GLSL**: `vec3({color})` - Auto-wraps float to vec3
- **Use Cases**: 
  - Final shader output (required in every graph)
  - Can accept grayscale (float) or color (vec3)
- **Notes**:
  - **Protected**: Cannot delete if it's the last Output node
  - **Multi-type**: Automatically converts float to vec3
  - **Header color**: Based on first input type

#### time
- **ID**: `time`
- **Label**: "Time (iTime)"
- **Category**: Output & Inputs
- **Compact**: true
- **Inputs**: None
- **Outputs**:
  - `t: float` - Seconds since shader start
- **Controls**: None
- **GLSL**: `iTime` - Global uniform variable
- **Use Cases**:
  - Animations (sin(time), cos(time))
  - Scrolling effects (uv + time)
  - Pulsing colors (time * frequency)
- **Notes**:
  - **Uniform**: Value provided by ShaderPreview component
  - **Range**: 0 to infinity (resets on page reload)

#### param_float
- **ID**: `param_float`
- **Label**: "Float Param"
- **Category**: Output & Inputs
- **Compact**: false
- **Inputs**: None
- **Outputs**:
  - `out: float` - Parameter value
- **Controls**:
  - **Type**: Slider
  - **Default**: 0.5
  - **Min**: 0.0 (adjustable)
  - **Max**: 10.0 (adjustable)
  - **Step**: 0.01 (adjustable)
- **GLSL**: `{value}` - Literal float (e.g., `0.5`)
- **Use Cases**:
  - User-controllable parameters
  - Global values (speed, intensity, radius)
  - Grouped parameters (same label = shared value)
- **Notes**:
  - **Global Parameters**: Same label → same value across all instances
  - **Sidebar Control**: Appears in Parameters tab
  - **Formatting**: Always adds `.0` for integers (e.g., `1.0`)

#### param_color
- **ID**: `param_color`
- **Label**: "Color Param"
- **Category**: Output & Inputs
- **Compact**: false
- **Inputs**: None
- **Outputs**:
  - `rgb: vec3` - RGB color
- **Controls**:
  - **Type**: Color picker
  - **Default**: `#ff007a` (pink)
- **GLSL**: `vec3(r, g, b)` - Converted from hex to 0-1 range
- **Use Cases**:
  - Tint colors
  - Background colors
  - Theme colors
- **Notes**:
  - **Hex to vec3**: `#ff007a` → `vec3(1.0, 0.0, 0.478)`
  - **Global Parameters**: Same label → same color

#### uv
- **ID**: `uv`
- **Label**: "UV Coord"
- **Category**: Output & Inputs
- **Compact**: true
- **Inputs**: None
- **Outputs**:
  - `out: vec2` - UV coordinates (0-1 range)
- **Controls**: None
- **GLSL**: `uv` - Global varying variable
- **Use Cases**:
  - Texture coordinates
  - Position-based effects
  - Starting point for most shaders
- **Notes**:
  - **Visual Distinction**: Green inset border on top
  - **Coordinates**: (0,0) = bottom-left, (1,1) = top-right
  - **Varying**: Interpolated from vertex shader

---

### Custom Nodes Category

#### custom_input
- **ID**: `custom_input`
- **Label**: "Input"
- **Category**: Custom Nodes
- **Compact**: false
- **Inputs**: None
- **Outputs**:
  - `out: auto` - Value from parent connection
- **Controls**:
  - **Type**: Text input
  - **Default**: "Input"
- **GLSL**: Replaced during compilation with parent value
- **Use Cases**:
  - Define input ports for custom nodes
  - Name determines port label on parent
- **Notes**:
  - **Auto Type**: Adapts to connected type
  - **Compilation**: Value injected from parent graph
  - **Multiple Inputs**: Each Custom Input = one input port on parent

#### custom_output
- **ID**: `custom_output`
- **Label**: "Output"
- **Category**: Custom Nodes
- **Compact**: false
- **Inputs**:
  - `in: auto` - Value to output
- **Outputs**: None
- **Controls**:
  - **Type**: Text input
  - **Default**: "Output"
- **GLSL**: `{in}` - Passthrough value
- **Use Cases**:
  - Define output ports for custom nodes
  - Name determines port label on parent
- **Notes**:
  - **Auto Type**: Adapts to connected type
  - **Multiple Outputs**: Each Custom Output = one output port on parent
  - **Return Value**: Becomes parent node's output

---

### Math (Basic) Category

#### math_add
- **ID**: `math_add`
- **Label**: "+"
- **Category**: Math (Basic)
- **Compact**: true
- **Inputs**:
  - `a: float` - First operand
  - `b: float` - Second operand
- **Outputs**:
  - `out: float` - Sum (A + B)
- **Controls**: None
- **GLSL**: `({a} + {b})` - Parenthesized for precedence
- **Use Cases**:
  - Combine values
  - Offset positions
  - Brighten colors
- **Notes**:
  - **Defaults**: a=0.0, b=0.0 if disconnected

#### math_sub
- **ID**: `math_sub`
- **Label**: "-"
- **Category**: Math (Basic)
- **Compact**: true
- **Inputs**:
  - `a: float` - Minuend
  - `b: float` - Subtrahend
- **Outputs**:
  - `out: float` - Difference (A - B)
- **Controls**: None
- **GLSL**: `({a} - {b})`
- **Use Cases**:
  - Offset in opposite direction
  - Calculate differences
- **Notes**:
  - **Order Matters**: a - b ≠ b - a

#### math_mult
- **ID**: `math_mult`
- **Label**: "×"
- **Category**: Math (Basic)
- **Compact**: true
- **Inputs**:
  - `a: float` - First factor
  - `b: float` - Second factor
- **Outputs**:
  - `out: float` - Product (A × B)
- **Controls**: None
- **GLSL**: `({a} * {b})`
- **Use Cases**:
  - Scale values
  - Modulate signals
  - Attenuation
- **Notes**:
  - **Defaults**: a=1.0, b=1.0 if disconnected

#### math_div
- **ID**: `math_div`
- **Label**: "÷"
- **Category**: Math (Basic)
- **Compact**: true
- **Inputs**:
  - `a: float` - Dividend
  - `b: float` - Divisor
- **Outputs**:
  - `out: float` - Quotient (A ÷ B)
- **Controls**: None
- **GLSL**: `({a} / {b})`
- **Use Cases**:
  - Inverse scaling
  - Normalize values
- **Notes**:
  - **Division by Zero**: Undefined (GLSL may return inf/nan)
  - **Defaults**: a=1.0, b=1.0

#### math_negate
- **ID**: `math_negate`
- **Label**: "Negate (-x)"
- **Category**: Math (Basic)
- **Compact**: true
- **Inputs**:
  - `in: float` - Input value
- **Outputs**:
  - `out: float` - Negated (-in)
- **Controls**: None
- **GLSL**: `(-{in})`
- **Use Cases**:
  - Flip direction
  - Invert signal
- **Notes**:
  - **Default**: -0.0 = 0.0

#### math_pow
- **ID**: `math_pow`
- **Label**: "POW"
- **Category**: Math (Basic)
- **Compact**: true
- **Inputs**:
  - `base: float` - Base value
  - `exp: float` - Exponent
- **Outputs**:
  - `out: float` - base^exp
- **Controls**: None
- **GLSL**: `pow({base}, {exp})`
- **Use Cases**:
  - Gamma correction (pow(color, 2.2))
  - Non-linear curves
  - Exponential falloff
- **Notes**:
  - **Defaults**: base=0.0, exp=1.0
  - **Negative Base**: Undefined for fractional exponents

---

### Math (Trig/Func) Category

#### math_sin
- **ID**: `math_sin`
- **Label**: "SIN"
- **Category**: Math (Trig/Func)
- **Compact**: true
- **Inputs**:
  - `in: float` - Input angle (radians)
- **Outputs**:
  - `out: float` - Sine value (-1 to 1)
- **Controls**: None
- **GLSL**: `sin({in})`
- **Use Cases**:
  - Oscillations
  - Wave patterns
  - Smooth animations (sin(time))
- **Notes**:
  - **Range**: Output is always -1 to 1
  - **Period**: 2π (6.28318)

#### math_cos
- **ID**: `math_cos`
- **Label**: "COS"
- **Category**: Math (Trig/Func)
- **Compact**: true
- **Inputs**:
  - `in: float` - Input angle (radians)
- **Outputs**:
  - `out: float` - Cosine value (-1 to 1)
- **Controls**: None
- **GLSL**: `cos({in})`
- **Use Cases**:
  - Oscillations (phase-shifted from sin)
  - Circular motion
  - Palette generation
- **Notes**:
  - **Phase Shift**: cos(x) = sin(x + π/2)

#### math_abs
- **ID**: `math_abs`
- **Label**: "ABS"
- **Category**: Math (Trig/Func)
- **Compact**: true
- **Inputs**:
  - `in: float` - Input value
- **Outputs**:
  - `out: float` - Absolute value (always positive)
- **Controls**: None
- **GLSL**: `abs({in})`
- **Use Cases**:
  - Distance calculations
  - Mirroring
  - Positive-only values
- **Notes**:
  - **Symmetry**: abs(-x) = abs(x)

#### math_exp
- **ID**: `math_exp`
- **Label**: "EXP"
- **Category**: Math (Trig/Func)
- **Compact**: true
- **Inputs**:
  - `in: float` - Exponent
- **Outputs**:
  - `out: float` - e^in (Euler's number raised to power)
- **Controls**: None
- **GLSL**: `exp({in})`
- **Use Cases**:
  - Exponential growth/decay
  - Glow effects
  - Falloff curves
- **Notes**:
  - **Range**: Always positive (> 0)
  - **Euler's Number**: e ≈ 2.71828

---

### Vector & Space Category

#### uv_scale
- **ID**: `uv_scale`
- **Label**: "UV Scale (*)"
- **Category**: Vector & Space
- **Compact**: true
- **Inputs**:
  - `uv: vec2` - UV coordinates
  - `scale: float` - Scale factor
- **Outputs**:
  - `out: vec2` - Scaled UV
- **Controls**: None
- **GLSL**: `({uv} * {scale})`
- **Use Cases**:
  - Tile textures (scale > 1)
  - Zoom in (scale < 1)
  - Repeat patterns
- **Notes**:
  - **Center**: Scales from (0,0), not center
  - **Defaults**: uv=vec2(0.0), scale=1.0

#### uv_shift
- **ID**: `uv_shift`
- **Label**: "UV Shift (+/-)"
- **Category**: Vector & Space
- **Compact**: true
- **Inputs**:
  - `uv: vec2` - UV coordinates
  - `shift: float` - Offset amount
- **Outputs**:
  - `out: vec2` - Shifted UV
- **Controls**: None
- **GLSL**: `({uv} - vec2({shift}))` - CRITICAL: Subtracts, not adds!
- **Use Cases**:
  - Pan/scroll
  - Center UV (shift by 0.5)
  - Animate movement (shift = time)
- **Notes**:
  - **Bug Fix**: Was `- vec2(shift)` correctly (not `+ shift`)
  - **Uniform Shift**: Applies same shift to both X and Y

#### vec_length
- **ID**: `vec_length`
- **Label**: "Length"
- **Category**: Vector & Space
- **Compact**: true
- **Inputs**:
  - `in: vec2` - Vector
- **Outputs**:
  - `out: float` - Length (magnitude)
- **Controls**: None
- **GLSL**: `length({in})`
- **Use Cases**:
  - Distance from origin
  - Radial gradients
  - SDF calculations
- **Notes**:
  - **Formula**: sqrt(x² + y²)
  - **Range**: Always positive (≥ 0)

#### vec_fract
- **ID**: `vec_fract`
- **Label**: "Fract (Vec2)"
- **Category**: Vector & Space
- **Compact**: true
- **Inputs**:
  - `in: vec2` - Input vector
- **Outputs**:
  - `out: vec2` - Fractional part
- **Controls**: None
- **GLSL**: `fract({in})`
- **Use Cases**:
  - Tiling/wrapping
  - Repeat patterns
  - Keep values in 0-1 range
- **Notes**:
  - **Formula**: x - floor(x)
  - **Range**: Always 0-1

#### math_mix
- **ID**: `math_mix`
- **Label**: "Mix (Lerp)"
- **Category**: Vector & Space
- **Compact**: true
- **Inputs**:
  - `a: vec3` - First color
  - `b: vec3` - Second color
  - `t: float` - Blend factor (0-1)
- **Outputs**:
  - `out: vec3` - Blended color
- **Controls**: None
- **GLSL**: `mix({a}, {b}, {t})`
- **Use Cases**:
  - Blend colors
  - Gradients
  - Smooth transitions
- **Notes**:
  - **Formula**: a * (1 - t) + b * t
  - **t=0**: Returns a
  - **t=1**: Returns b
  - **Defaults**: a=vec3(0.0), b=vec3(1.0), t=0.5

#### relay_auto
- **ID**: `relay_auto`
- **Label**: "Relay"
- **Category**: Vector & Space
- **Compact**: true
- **Inputs**:
  - `in: auto` - Any type
- **Outputs**:
  - `out: auto` - Same type as input
- **Controls**: None
- **GLSL**: `{in}` - Passthrough
- **Use Cases**:
  - Wire organization
  - Type adaptation
  - Debug points
- **Notes**:
  - **Auto Type**: Adapts to input type
  - **Default**: vec3(0.5) if disconnected
  - **Visual**: Rainbow gradient on handle

---

### Utils Category

#### smart_split
- **ID**: `smart_split`
- **Label**: "Split (Auto)"
- **Category**: Utils
- **Compact**: true
- **Inputs**:
  - `in: auto` - Vector to split
- **Outputs**: **DYNAMIC** - Adapts based on input type:
  - `float` → `x: float`
  - `vec2` → `x: float`, `y: float`
  - `vec3` → `x: float`, `y: float`, `z: float`
  - `vec4` → `x: float`, `y: float`, `z: float`, `w: float`
- **Controls**: None
- **GLSL**: `{in}` - Passthrough (swizzling handled by compiler)
- **Use Cases**:
  - Extract components
  - Split RGB
  - Access individual axes
- **Notes**:
  - **CRITICAL**: Outputs adapt on connection AND on load/undo
  - **Flexbox Layout**: Multi-output ports arranged horizontally
  - **Labels**: vec3 uses R/G/B, vec4 uses R/G/B/A

#### smart_compose
- **ID**: `smart_compose`
- **Label**: "Compose (Auto)"
- **Category**: Utils
- **Compact**: false
- **Inputs**:
  - `x: float` - X/R component
  - `y: float` - Y/G component
  - `z: float` - Z/B component
  - `w: float` - W/A component
- **Outputs**: **DYNAMIC** - User selects via buttons:
  - `vec2` - Uses X, Y
  - `vec3` - Uses X, Y, Z (default)
  - `vec4` - Uses X, Y, Z, W
- **Controls**: Type selector buttons (vec2/vec3/vec4)
- **GLSL**: 
  - vec2: `vec2({x}, {y})`
  - vec3: `vec3({x}, {y}, {z})`
  - vec4: `vec4({x}, {y}, {z}, {w})`
- **Use Cases**:
  - Combine components
  - Build vectors
  - Merge RGB channels
- **Notes**:
  - **Buttons**: Click to change output type
  - **Active Button**: Pink highlight
  - **Unused Inputs**: Ignored (e.g., W ignored for vec3)

#### split_vec2
- **ID**: `split_vec2`
- **Label**: "Split (Vec2)"
- **Category**: Utils (not in sidebar)
- **Compact**: false
- **Inputs**:
  - `in: vec2` - Vector to split
- **Outputs**:
  - `x: float` - X component
  - `y: float` - Y component
- **Controls**: None
- **GLSL**: `{in}` - Passthrough
- **Use Cases**: Fixed vec2 split (replaced by smart_split)
- **Notes**: Legacy, prefer `smart_split`

#### split_vec3
- **ID**: `split_vec3`
- **Label**: "Split (Vec3)"
- **Category**: Utils (not in sidebar)
- **Compact**: false
- **Inputs**:
  - `in: vec3` - Vector to split
- **Outputs**:
  - `x: float` - R component
  - `y: float` - G component
  - `z: float` - B component
- **Controls**: None
- **GLSL**: `{in}` - Passthrough
- **Use Cases**: Fixed vec3 split (replaced by smart_split)
- **Notes**: Legacy, prefer `smart_split`

#### split_vec4
- **ID**: `split_vec4`
- **Label**: "Split (Vec4)"
- **Category**: Utils (not in sidebar)
- **Compact**: false
- **Inputs**:
  - `in: vec4` - Vector to split
- **Outputs**:
  - `x: float` - R component
  - `y: float` - G component
  - `z: float` - B component
  - `w: float` - A component
- **Controls**: None
- **GLSL**: `{in}` - Passthrough
- **Use Cases**: Fixed vec4 split (replaced by smart_split)
- **Notes**: Legacy, prefer `smart_split`

#### combine_vec2
- **ID**: `combine_vec2`
- **Label**: "Combine (Vec2)"
- **Category**: Utils (not in sidebar)
- **Compact**: false
- **Inputs**:
  - `x: float` - X component
  - `y: float` - Y component
- **Outputs**:
  - `out: vec2` - Combined vector
- **Controls**: None
- **GLSL**: `vec2({x}, {y})`
- **Use Cases**: Fixed vec2 combine (replaced by smart_compose)
- **Notes**: Legacy, prefer `smart_compose`

#### combine_vec3
- **ID**: `combine_vec3`
- **Label**: "Combine (Vec3)"
- **Category**: Utils (not in sidebar)
- **Compact**: false
- **Inputs**:
  - `x: float` - R component
  - `y: float` - G component
  - `z: float` - B component
- **Outputs**:
  - `out: vec3` - Combined vector
- **Controls**: None
- **GLSL**: `vec3({x}, {y}, {z})`
- **Use Cases**: Fixed vec3 combine (replaced by smart_compose)
- **Notes**: Legacy, prefer `smart_compose`

#### combine_vec4
- **ID**: `combine_vec4`
- **Label**: "Combine (Vec4)"
- **Category**: Utils (not in sidebar)
- **Compact**: false
- **Inputs**:
  - `x: float` - R component
  - `y: float` - G component
  - `z: float` - B component
  - `w: float` - A component
- **Outputs**:
  - `out: vec4` - Combined vector
- **Controls**: None
- **GLSL**: `vec4({x}, {y}, {z}, {w})`
- **Use Cases**: Fixed vec4 combine (replaced by smart_compose)
- **Notes**: Legacy, prefer `smart_compose`

#### monitor
- **ID**: `monitor`
- **Label**: "Value Watcher"
- **Category**: Utils
- **Compact**: false
- **Inputs**:
  - `in: vec4` - Value to monitor
- **Outputs**:
  - `out: vec3` - Passthrough (first 3 components)
- **Controls**: None
- **GLSL**: `vec3({in})` - Auto-extract RGB
- **Use Cases**:
  - Debug values
  - Watch live data
  - Visual feedback
- **Notes**:
  - **Display**: Shows R, G, B, A values in node UI
  - **Passthrough**: Output = vec3(input)
  - **Monitoring**: Updates in real-time

#### preview
- **ID**: `preview`
- **Label**: "Preview"
- **Category**: Utils
- **Compact**: false
- **Inputs**:
  - `in: vec3` - Color to preview
- **Outputs**: None
- **Controls**: None
- **GLSL**: `''` - Not compiled (UI only)
- **Use Cases**:
  - In-graph preview
  - Visual debugging
  - Intermediate results
- **Notes**:
  - **Rendering**: Shows live shader preview in node
  - **No Output**: Terminal node (doesn't contribute to final output)

#### special_note
- **ID**: `special_note`
- **Label**: "Comment"
- **Category**: Utils
- **Compact**: false
- **Inputs**: None
- **Outputs**: None
- **Controls**:
  - **Type**: Multi-line text
  - **Default**: "Write something here...\nUse scroll for more text."
- **GLSL**: `''` - Not compiled
- **Use Cases**:
  - Annotations
  - Documentation
  - TODO notes
- **Notes**:
  - **Resizable**: Node can be resized
  - **No Handles**: No input/output ports
  - **Visual**: Brown background (#4e342e)

#### special_group
- **ID**: `special_group`
- **Label**: "Group Frame"
- **Category**: Utils
- **Compact**: false
- **Inputs**: None
- **Outputs**: None
- **Controls**:
  - **Type**: Text (title) + Color picker
  - **Default**: "My Group", rgba(255, 255, 255, 0.05)
- **GLSL**: `''` - Not compiled
- **Use Cases**:
  - Visual organization
  - Group related nodes
  - Sections
- **Notes**:
  - **Resizable**: Large container
  - **Semi-transparent**: Background with adjustable color
  - **Z-index**: Behind other nodes

---

### Color & Shapes Category

#### palette
- **ID**: `palette`
- **Label**: "Cosine Palette"
- **Category**: Color & Shapes
- **Compact**: false
- **Inputs**:
  - `t: float` - Input value (0-1)
- **Outputs**:
  - `color: vec3` - Generated color
- **Controls**: None
- **GLSL**: Cosine palette formula with hardcoded coefficients
- **Use Cases**:
  - Procedural colors
  - Rainbow gradients
  - Kishimisu-style effects
- **Notes**:
  - **Formula**: `0.5 + 0.5 * cos(6.28318 * (t + offset))`
  - **Offset**: vec3(0.263, 0.416, 0.557) - Preset for vibrant colors
  - **Credit**: Based on Inigo Quilez's cosine palette

#### color_add
- **ID**: `color_add`
- **Label**: "Add (Color)"
- **Category**: Color & Shapes
- **Compact**: true
- **Inputs**:
  - `a: vec3` - First color
  - `b: vec3` - Second color
- **Outputs**:
  - `out: vec3` - Sum (brightens)
- **Controls**: None
- **GLSL**: `({a} + {b})`
- **Use Cases**:
  - Brighten colors
  - Combine light sources
  - Additive blending
- **Notes**:
  - **Defaults**: a=vec3(0.0), b=vec3(0.0)
  - **Clamping**: May exceed 1.0 (no auto-clamp)

#### color_mult
- **ID**: `color_mult`
- **Label**: "Scale"
- **Category**: Color & Shapes
- **Compact**: true
- **Inputs**:
  - `col: vec3` - Color
  - `fac: float` - Scale factor
- **Outputs**:
  - `out: vec3` - Scaled color
- **Controls**: None
- **GLSL**: `({col} * {fac})`
- **Use Cases**:
  - Darken (fac < 1)
  - Brighten (fac > 1)
  - Intensity control
- **Notes**:
  - **Defaults**: col=vec3(1.0), fac=1.0

#### sdf_circle
- **ID**: `sdf_circle`
- **Label**: "Circle SDF"
- **Category**: Color & Shapes
- **Compact**: false
- **Inputs**:
  - `uv: vec2` - Position
  - `radius: float` - Circle radius
- **Outputs**:
  - `out: float` - Signed distance
- **Controls**: None
- **GLSL**: `length({uv}) - {radius}`
- **Use Cases**:
  - Draw circles
  - Distance fields
  - Smooth shapes
- **Notes**:
  - **SDF**: Negative = inside, Zero = edge, Positive = outside
  - **Defaults**: uv=uv, radius=0.5
  - **Center**: Distance from (0,0), use UV Shift to move

---

### Summary Statistics

**Total Nodes**: 45
- Output & Inputs: 5
- Custom Nodes: 2
- Math (Basic): 6
- Math (Trig/Func): 4
- Vector & Space: 6
- Utils: 16 (including legacy split/combine)
- Color & Shapes: 4

**Compact Nodes**: 24 (circular small nodes)
**Standard Nodes**: 21 (rectangular with full UI)

**Special Categories**:
- Auto-adapting: smart_split, smart_compose, relay_auto (3)
- Multi-type: output (1)
- Legacy: split_vec2/3/4, combine_vec2/3/4 (6)
- Visual only: special_note, special_group, preview (3)

---

## UI Components Specification

This section provides complete technical specifications for all UI components in the application.

### NodeEditor Component

**File**: `src/components/NodeEditor.tsx`

**Purpose**: Main graph editor component, manages the ReactFlow instance and all node/edge operations.

#### Props
```typescript
interface Props {
  onChange?: (nodes: Node[], edges: Edge[]) => void;
}
```
- `onChange` (optional): Callback fired when graph changes (nodes or edges modified)

#### State Variables
- `nodes` (Node[]): All nodes on canvas
- `edges` (Edge[]): All connections between nodes
- `reactFlowInstance`: ReactFlow instance for programmatic control
- `menu`: Context menu state (`{x, y, visible, type}` or null)
- `menuFilter` (string | null): Type filter for filtered context menu
- `pendingConnection`: Connection being created (for auto-add on drop)
- `clipboard`: Copy/paste buffer (`{nodes: Node[], edges: Edge[]}` or null)
- `showCode` (boolean): Show GLSL code modal
- `currentCode` (string): Generated GLSL code
- `history` (HistoryState[]): Undo history stack (max 50)
- `historyIndex` (number): Current position in history
- `currentFilePath` (string | null): Current file path (for Save vs Save As)
- `showCustomDialog` (boolean): Show Create Custom Node dialog
- `navigationStack`: Stack of navigation levels for custom nodes
- `currentContext` (string): Current navigation context (e.g., "Main", "MyCustomNode")
- `connectionStartRef`: Ref for tracking connection start (for drag-to-add)

#### Key Event Handlers

**Node Operations:**
- `onNodesChange`: Update nodes array (ReactFlow callback)
- `onEdgesChange`: Update edges array (ReactFlow callback)
- `onConnect`: Create new edge with validation
- `onAddNode(typeId: string)`: Add node to canvas at menu position
- `deleteSelected()`: Delete selected nodes/edges
- `handleCopy()`: Copy selected to clipboard
- `handlePaste()`: Paste from clipboard with offset
- `handleCut()`: Copy then delete selected

**Custom Nodes:**
- `handleCreateCustomNode(name, description)`: Create new custom node
- `enterCustomNode(nodeId)`: Enter custom node subgraph (double-click)
- `navigateBack()`: Go up one level in navigation stack
- `navigateToLevel(index)`: Jump to specific level
- `navigateToMain()`: Exit all custom nodes to Main

**File Operations:**
- `handleSave(saveAs?)`: Save graph to file (or Save As)
- `handleLoad()`: Load graph from file
- `handleClear()`: Clear all nodes (with confirmation)
- `handleNew()`: New project (reset without confirmation)

**History:**
- `saveToHistory()`: Create snapshot (debounced 2s)
- `undo()`: Restore previous state
- `redo()`: Restore next state

**View:**
- `handleFitView()`: Center and zoom to show all nodes

**Compilation:**
- `onShowCode()`: Compile graph and show GLSL modal

#### Keyboard Shortcuts Handled
- `Ctrl+Z`: Undo
- `Ctrl+Y` / `Ctrl+Shift+Z`: Redo
- `Ctrl+C`: Copy selected
- `Ctrl+V`: Paste
- `Ctrl+X`: Cut
- `Delete`: Delete selected
- `Ctrl+S`: Save
- `Ctrl+Shift+S`: Save As

#### Special Behaviors
- **Auto-add on drag**: Drag from handle → drop on empty → show filtered menu → auto-connect
- **Single connection per input**: New connection replaces existing
- **Smart Split adaptation**: Auto-adapt output type based on input connection
- **Relay Auto adaptation**: Adapt on both connect and load/undo
- **Last Output protection**: Can't delete if only one Output node exists
- **Undo debouncing**: Only save history every 2s to prevent spam
- **Custom node defaults**: Add Custom Input + Output if subgraph empty

---

### ShaderNode Component

**File**: `src/components/ShaderNode.tsx`

**Purpose**: Renders individual nodes with inputs/outputs, controls, and special modes.

#### Props
```typescript
interface NodeProps {
  id: string;
  data: {
    definition: ShaderNodeDefinition;
    label?: string;
    value?: any;
    min?: number;
    max?: number;
    step?: number;
    adaptedOutputs?: { id: string; label: string; type: string }[];
  };
  selected: boolean;
}
```

#### Special Node Types
1. **Note (`special_note`)**:
   - Resizable text area
   - Title input + multi-line content
   - Brown background (#4e342e)
   - No handles

2. **Group (`special_group`)**:
   - Resizable container
   - Large title + color picker
   - Semi-transparent background
   - No handles
   - Acts as visual grouping

3. **UV (`uv`)**:
   - Special inset top border (green)
   - Visual distinction for UV coordinates

4. **Float Param (`param_float`)**:
   - Slider control
   - Min/max/step adjustable
   - No inputs, single float output

5. **Color Param (`param_color`)**:
   - Color picker control
   - No inputs, vec3 output (RGB)

6. **Smart Compose (`smart_compose`)**:
   - Type selector buttons (vec2/vec3/vec4)
   - Dynamically changes input count

7. **Custom Node**:
   - Purple border (#9c27b0)
   - 🔲 icon next to label
   - "🔲 CUSTOM" badge on top
   - Purple box-shadow

8. **Compact Mode (`def.compact`)**:
   - Small circular node
   - Label in center
   - Multi-output ports in flexbox layout (for Smart Split)

#### Rendering Logic
```
if (isNote) → ResizableNote
else if (isGroup) → ResizableGroup  
else if (compact) → CompactNode
else → StandardNode
```

#### Standard Node Structure
```
<div> (baseStyle + customStyle/uvStyle)
  {renderInfoIcon()} - if description exists
  {isCustomNode && <Badge>🔲 CUSTOM</Badge>}
  <HeaderStrip color={headerColor} />
  <TitleBar>
    <input editable label />
  </TitleBar>
  {isSmartCompose && <TypeSelector />}
  <Body>
    <InputsColumn>
      {inputs.map => <Handle + Label + MultiTypeIndicator>}
    </InputsColumn>
    {controls && <ControlsSection>}
    <OutputsColumn>
      {outputs.map => <Label + Handle + MultiTypeIndicator>}
    </OutputsColumn>
  </Body>
</div>
```

#### Visual Styling
- **Header color**: Based on first output type (or first input for processing nodes)
- **Border**: Selected = pink (#ff007a), Normal = gray (#555), Custom = purple (#9c27b0)
- **Box-shadow**: Selected = pink glow, Custom = purple glow
- **Handle colors**: TYPE_COLORS (red/green/blue/yellow/purple)

---

### Sidebar Component

**File**: `src/components/Sidebar.tsx`

**Purpose**: Node library, parameter controls, and custom nodes management.

#### Props
```typescript
interface Props {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  currentContext?: string; // Current navigation context (default: 'Main')
}
```

#### State Variables
- `collapsed` (boolean): Sidebar collapsed state
- `activeTab` ('lib' | 'params'): Active tab (Library vs Parameters)
- `refreshKey` (number): Force re-render for custom nodes
- `contextMenu` ({x, y, nodeId} | null): Right-click menu on custom node

#### Tabs

**1. Library Tab (`'lib'`)**
- Shows node categories in accordion
- Drag-and-drop to add nodes
- Categories:
  - Output & Inputs
  - Math (Basic)
  - Math (Trig/Func)
  - Vector & Space
  - Utils
  - Color & Shapes
  - **Custom Nodes** (dynamic, loaded from localStorage)

**2. Parameters Tab (`'params'`)**
- Shows all parameter nodes (param_float, param_color)
- Grouped by label (same name = one entry)
- Slider for floats, color picker for colors
- Changes update ALL nodes with same label (global params)

#### Custom Nodes Features
- **Loading**: Loaded via `loadCustomNodes()` on mount and refreshKey change
- **Refresh triggers**:
  - localStorage 'storage' event (from other tabs)
  - Custom 'customNodesUpdated' event (from same window)
- **Context menu**: Right-click → Delete (with usage warning)
- **Deletion flow**:
  1. Check if used on canvas
  2. Show warning if used
  3. Confirm deletion
  4. Remove from localStorage + NODE_REGISTRY
  5. Force refresh (setRefreshKey)

#### Drag & Drop
```javascript
onDragStart(event, nodeType) {
  event.dataTransfer.setData('application/reactflow', nodeType);
  event.dataTransfer.effectAllowed = 'move';
}
```

#### Visual Features
- **Color indicators**: Input/output type colors next to node names
- **Multi-type indicators**: Special component for float|vec3 etc.
- **Collapse button**: Triangle icon, toggles sidebar width

---

### Toolbar Component

**File**: `src/components/Toolbar.tsx`

**Purpose**: Top-right toolbar with file operations and view controls.

#### Props
```typescript
interface Props {
  onSave: (saveAs?: boolean) => void;
  onLoad: () => void;
  onClear: () => void;
  onNew: () => void;
  onFitView: () => void;
  onShowCode: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  currentFile?: string | null;
}
```

#### Buttons (Left to Right)

1. **File Path Display** (if currentFile)
   - Shows current file name
   - Gray, non-clickable
   - Example: "📄 beautiful.json"

2. **New**
   - Creates new project
   - No confirmation (instant reset)
   - Clears file path

3. **Save**
   - If file path exists → Save
   - If no path → Save As (file picker)

4. **Save As**
   - Always shows file picker
   - Updates currentFile path

5. **Load**
   - Shows file picker
   - Loads graph + custom nodes

6. **Undo** (Ctrl+Z)
   - Disabled if !canUndo
   - Grayed out when disabled

7. **Redo** (Ctrl+Y)
   - Disabled if !canRedo
   - Grayed out when disabled

8. **Fit View**
   - Centers all nodes
   - Zoom with 0.2 padding
   - 300ms animation

9. **Show Code**
   - Compiles graph
   - Shows GLSL modal

10. **Clear All**
    - Clears graph with confirmation
    - Warning dialog: "Clear all nodes?"

#### Visual Styling
- **Background**: Dark gray (#1a1a1a)
- **Buttons**: Gray (#333) with hover effect (#444)
- **Disabled**: Opacity 0.3, cursor not-allowed

---

### NavigationPanel Component

**File**: `src/components/NavigationPanel.tsx`

**Purpose**: Breadcrumb navigation for custom node hierarchy.

#### Props
```typescript
interface NavigationPanelProps {
  breadcrumbs: string[];            // ['Main', 'OuterNode', 'InnerNode']
  currentContext: string;            // 'InnerNode'
  onNavigateToLevel: (index) => void;
  onNavigateBack: () => void;
  onNavigateToMain: () => void;
}
```

#### Visibility
- **Hidden** when `currentContext === 'Main'`
- **Visible** when inside any custom node

#### Visual Structure
```
┌─────────────────────────────────────┐
│ ✏️ EDITING: InnerNode               │  (Big banner)
├─────────────────────────────────────┤
│ 📍 🏠 Main › 🔲 OuterNode › InnerNode│  (Breadcrumbs, clickable)
├─────────────────────────────────────┤
│ [← Up One Level] [🏠 Exit to Main] │  (Quick nav buttons)
└─────────────────────────────────────┘
```

#### Features
- **Breadcrumbs**: Clickable buttons to jump to any level
- **Current level**: Highlighted in purple (#8a2be2)
- **Hover effects**: Border changes to purple on hover
- **Icons**: 🏠 for Main, 🔲 for custom nodes
- **Backdrop blur**: Semi-transparent purple background

#### Positioning
- **Fixed** position: top: 80px, left: 10px
- **Z-index**: 100 (above canvas, below modals)
- **Max-width**: 600px

---

### ContextMenu Component

**File**: `src/components/ContextMenu.tsx`

**Purpose**: Right-click menu with node categories and actions.

#### Props
```typescript
interface Props {
  x: number;
  y: number;
  onClose: () => void;
  onAddNode: (typeId: string) => void;
  filterType?: string | null;        // Type filter for drag-from-handle
  onPaste?: () => void;
  onCreateCustom?: () => void;
  hasClipboard?: boolean;
  hasSelection?: boolean;
}
```

#### Menu Variants

**1. Pane Context Menu** (Right-click on empty canvas)
```
📋 Paste (Ctrl+V)           [enabled if hasClipboard]
📦 Create Custom Node       [ALWAYS enabled]
──────────────────
Output & Inputs     ›
Math (Basic)        ›
...
```

**2. Filtered Context Menu** (Drag from handle, drop on empty)
```
Connecting: float →         [header showing type]
──────────────────
Compatible nodes only       [filtered by type]
Math (Basic)        ›
...
```

**3. Node Context Menu** (Right-click on node)
- Shown via NodeContextMenu component (separate file)
- Actions: Copy, Cut, Delete, Edit Definition (custom only)

#### Behavior
- **Auto-positioning**: Adjusts if near screen edge
- **Submenu direction**: Opens left if near right edge
- **Filter logic**: Uses `isValidConnection()` for type compatibility
- **Click outside**: Closes menu
- **Hover category**: Shows submenu with node list
- **Click node**: Adds to canvas, closes menu

#### Visual Styling
- **Background**: Dark (#1a1a1a)
- **Border**: Gray (#444)
- **Hover**: Item highlights with pink (#ff007a) or gray (#333)
- **Submenu**: Positioned absolutely, same styling

---

### CreateCustomNodeDialog Component

**File**: `src/components/CreateCustomNodeDialog.tsx`

**Purpose**: Modal dialog for creating custom nodes.

#### Props
```typescript
interface Props {
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}
```

#### Fields
1. **Name** (required)
   - Text input
   - Placeholder: "My Custom Effect"
   - Validation: Must not be empty
   - Auto-focus on open

2. **Description** (optional)
   - Textarea
   - Placeholder: "What does this custom node do?"
   - Resizable vertically

#### Buttons
- **Cancel**: Close dialog without creating
- **Create**: Validate and call onCreate()

#### Keyboard Shortcuts
- `Enter` (in name field): Create
- `Escape`: Cancel

#### Validation
- Empty name → Alert: "Please enter a name for the custom node."
- Valid → Calls onCreate(name.trim(), description.trim())

#### Visual Layout
```
┌──────────────────────────────────┐
│ 📦 Create Custom Node            │
├──────────────────────────────────┤
│ Name *                           │
│ [My Custom Effect________]       │
│                                  │
│ Description (optional)           │
│ [What does this...________]      │
│ [                          ]     │
│                                  │
│          [Cancel]  [Create]      │
├──────────────────────────────────┤
│ 💡 Tip: Use "Custom Input" and  │
│ "Custom Output" nodes inside...  │
└──────────────────────────────────┘
```

#### Styling
- **Modal overlay**: rgba(0,0,0,0.8), covers full screen
- **Dialog**: 400px wide, centered
- **Background**: Dark gray (#1a1a1a)
- **Inputs**: Dark background (#222), light text
- **Create button**: Pink (#ff007a) with hover effect

---

## UI Features

### Keyboard Shortcuts
- **Ctrl+Z**: Undo (50 state history, 2s debounce)
- **Ctrl+Y**: Redo
- **Ctrl+C**: Copy selected nodes
- **Ctrl+V**: Paste from clipboard
- **Ctrl+X**: Cut selected nodes
- **Delete**: Delete selected nodes
- **Ctrl+S**: Save current graph
- **Ctrl+Shift+S**: Save As

### Context Menus

#### Pane Context Menu (Right-click on empty canvas)
- 📋 Paste (Ctrl+V) - enabled if clipboard has nodes
- 📦 Create Custom Node - **ALWAYS enabled**
- (Separator)
- Node categories (filtered if dragging from handle)

#### Node Context Menu (Right-click on node)
- 📋 Copy (Ctrl+C)
- ✂️ Cut (Ctrl+X)
- 🗑️ Delete - disabled if last Output node
- ✏️ Edit Definition - only for custom nodes

#### Sidebar Context Menu (Right-click on custom node)
- 🗑️ Delete - shows warning if used on canvas

### Navigation Panel (Custom Nodes)
- Floating purple panel (top-right)
- Breadcrumbs: Main > Level1 > Level2
- Clickable levels (navigate to specific level)
- "Up One Level" button
- "Exit to Main" button
- Only visible when inside custom node

### Toolbar
- **File**: New, Save, Save As, Load
- **Edit**: Undo, Redo
- **View**: Fit View (center all nodes)
- **File path**: Shows current file or "Untitled"

---

## Storage & Persistence

### localStorage Keys
- `shader_graph` - Current graph state (nodes + edges)
- `custom_nodes_library` - All custom node definitions (JSON array)

### File Format (JSON)
```json
{
  "nodes": [...],
  "edges": [...],
  "customNodes": [...],  // Optional: embedded custom definitions
  "metadata": {
    "version": "1.0",
    "created": "2026-02-15T...",
    "modified": "2026-02-15T..."
  }
}
```

### NODE_REGISTRY
- Runtime object containing all node definitions
- Built-in nodes: Loaded from `src/nodes/index.ts`
- Custom nodes: Loaded from localStorage on app start
- Dynamically updated when custom nodes created/deleted

---

## Testing Philosophy

### Testing Levels

#### 1. Unit Tests
- Test individual functions in isolation
- Core logic: compiler, validator, type system
- Math operations, vector operations
- Examples: `compiler.test.ts`, `validator.test.ts`

#### 2. Component Tests
- Test React components with Testing Library
- UI interactions: clicks, inputs, renders
- Examples: `MultiTypeIndicator.test.tsx`

#### 3. Integration Tests
- Test multiple components working together
- Custom node manager + localStorage + NODE_REGISTRY
- Examples: `customNodeManager.test.ts`

#### 4. End-to-End (E2E) Tests
- **CRITICAL**: Test complete user workflows
- Verify end results, not just surface behavior
- Must check:
  - localStorage state
  - NODE_REGISTRY state
  - UI updates (sidebar refresh)
  - No console errors
- Examples: `customNodeWorkflows.test.tsx` (NEW)

### Test Quality Standards

#### ❌ BAD TEST (Shallow, UI-only)
```typescript
it('should show Create Custom Node button', () => {
  render(<ContextMenu ... />);
  const button = screen.getByText(/Create Custom Node/i);
  expect(button).toBeDefined(); // Only checks if button exists
});
```

#### ✅ GOOD TEST (E2E, verifies end result)
```typescript
it('E2E: should create empty custom node with defaults', () => {
  // 1. Setup
  const handleCreate = vi.fn();
  render(<App />);
  
  // 2. User action
  rightClick(canvas, 100, 100);
  click('Create Custom Node');
  enterText('Name', 'MyNode');
  click('Create');
  
  // 3. Verify complete workflow
  expect(handleCreate).toHaveBeenCalledWith('MyNode', '');
  expect(NODE_REGISTRY.custom_mynode).toBeDefined();
  expect(NODE_REGISTRY.custom_mynode.subgraph.nodes.length).toBe(2); // Input + Output
  expect(localStorage.getItem('custom_nodes_library')).toContain('custom_mynode');
  expect(screen.getByText('MyNode')).toBeInTheDocument(); // Sidebar
});
```

### Test Coverage Requirements
- **Core logic**: 100% (compiler, validator, types)
- **Custom nodes**: 100% (critical feature)
- **UI components**: 80%+
- **E2E workflows**: All major user paths

### Console Error Detection
- Tests must verify NO console errors
- Use console spy to catch:
  - `console.error()`
  - `console.warn()`
- Examples: `consoleErrors.test.tsx`

---

## Known Constraints

### Performance
- **Large graphs**: Topological sort is O(n²) - slow with 100+ nodes
- **Deep nesting**: Recursive compilation overhead
- **localStorage**: 5-10MB limit per domain

### Browser Compatibility
- **Modern browsers only**: Chrome, Firefox, Edge (ES2020+)
- **WebGL required**: For shader preview
- **localStorage required**: For persistence

### Future Limitations
- **No multi-file custom nodes**: All stored in single localStorage key
- **No custom node versioning**: Editing affects all instances immediately
- **No custom node sharing**: Can't export/import individual custom nodes yet

---

## Error Handling

### User-Facing Errors
- **Alert dialogs**: For critical errors (can't create custom node, etc.)
- **Toast notifications**: For info (custom node created successfully)
- **Console logs**: For debugging (prefixed with emoji for visibility)

### Error Examples
```typescript
// ❌ Custom node already exists
alert('❌ Custom node "MyNode" already exists!');

// ⚠️ Deleting used custom node
if (confirm('⚠️ This custom node is used on canvas. Delete anyway?')) { ... }

// ✅ Success message
alert('✅ Custom node "MyNode" created!');
```

---

## Development Guidelines

### For Future AI Assistants

#### 🚨 NEVER DO THIS:
1. Change connection validation logic without explicit approval
2. Allow automatic type conversions (float → vec3)
3. Break custom node creation/editing/deletion
4. Commit without running all tests
5. Write shallow tests that only check UI

#### ✅ ALWAYS DO THIS:
1. Run all 272+ tests before committing
2. Write E2E tests for new features
3. Verify localStorage + NODE_REGISTRY state
4. Check for console errors in tests
5. Update FUNCTIONAL_REQUIREMENTS.md when adding features

### Common Pitfalls
1. **glslTemplate restoration**: Must restore function after JSON.parse
2. **Navigation stack**: Must save/restore state correctly
3. **Port refresh**: Must extract ports from subgraph after editing
4. **Empty custom nodes**: Don't block creation (allow defaults)
5. **TypeScript build errors**: May exist but runtime works (tests pass)

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-15 | 1.0 | Initial functional requirements document |
| 2026-02-15 | 1.1 | **Iteracja 1**: Added "UI Components Specification" - Complete specs for 7 components (515 new lines) |
| 2026-02-15 | 1.2 | **Iteracja 2**: Expanded "Complete Node Specifications" - Detailed specs for 24 core nodes with inputs/outputs/GLSL/use cases/notes (870+ new lines) |

---

**Last Updated**: 2026-02-15  
**Document Owner**: Development Team  
**Status**: Active  
**Review Cycle**: After major features or every 10 commits
