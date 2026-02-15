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

## State Management & Data Flow

This section describes all state variables, their storage locations, and how data flows through the application.

### React State (NodeEditor Component)

#### Core Graph State
```typescript
const [nodes, setNodes] = useNodesState(initialData.nodes);
const [edges, setEdges] = useEdgesState(initialData.edges);
```
- **Type**: `Node[]`, `Edge[]`
- **Source**: ReactFlow hooks (wrapper around useState)
- **Persistence**: Saved to localStorage on change
- **Updates**: Via `onNodesChange`, `onEdgesChange`, or direct setters
- **Triggers**: Graph rendering, compilation, auto-save

#### ReactFlow Instance
```typescript
const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
```
- **Type**: `ReactFlowInstance | null`
- **Source**: ReactFlow `onInit` callback
- **Usage**: Programmatic control (fitView, toObject, project coordinates)
- **Methods**:
  - `fitView(options)` - Center and zoom
  - `project({ x, y })` - Convert screen to graph coordinates
  - `toObject()` - Export graph state

#### Menu State
```typescript
const [menu, setMenu] = useState<{ x, y, visible, type, nodeId? } | null>(null);
const [menuFilter, setMenuFilter] = useState<string | null>(null);
```
- **menu**: Context menu position and type
  - `type: 'pane'` - Right-click on canvas
  - `type: 'node'` - Right-click on node
  - `nodeId` - For node context menu
- **menuFilter**: Type filter for drag-from-handle menus
  - Example: `'float'` when dragging from float output

#### Clipboard
```typescript
const [clipboard, setClipboard] = useState<{ nodes: Node[], edges: Edge[] } | null>(null);
```
- **Type**: `{nodes, edges}` or null
- **Updates**: On Copy (Ctrl+C) or Cut (Ctrl+X)
- **Usage**: Paste (Ctrl+V) creates copies with offset
- **Notes**: Only includes internal edges (both source and target selected)

#### File Path
```typescript
const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
```
- **Type**: `string | null`
- **Usage**: 
  - `null` - Untitled (new project)
  - `string` - File path (e.g., "beautiful.json")
- **Display**: Shown in Toolbar
- **Behavior**:
  - Save → Uses currentFilePath (quick save)
  - Save As → Updates currentFilePath

#### History (Undo/Redo)
```typescript
const [history, setHistory] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
const [historyIndex, setHistoryIndex] = useState(-1);
const maxHistorySize = 50;
```
- **history**: Array of snapshots (max 50)
- **historyIndex**: Current position (-1 = no history)
- **Debouncing**: saveToHistory() debounced by 2 seconds
- **Circular Buffer**: When exceeds 50, removes oldest
- **Undo**: `historyIndex--`, restore history[historyIndex]
- **Redo**: `historyIndex++`, restore history[historyIndex]
- **Branch**: New action after undo clears future states

#### Custom Nodes Navigation
```typescript
const [navigationStack, setNavigationStack] = useState<Array<{ name, nodes, edges }>>([]);
const [currentContext, setCurrentContext] = useState<string>('Main');
```
- **navigationStack**: Stack of saved states
  - Index 0: Main graph
  - Index 1+: Nested custom nodes
- **currentContext**: Display name ("Main" or custom node name)
- **Push**: When entering custom node (double-click)
- **Pop**: When exiting (navigate back)
- **Jump**: navigateToLevel(index) - pops to specific level

#### Dialog States
```typescript
const [showCode, setShowCode] = useState(false);
const [currentCode, setCurrentCode] = useState('');
const [showCustomDialog, setShowCustomDialog] = useState(false);
```
- **showCode**: GLSL code modal visibility
- **currentCode**: Compiled GLSL code
- **showCustomDialog**: Create Custom Node dialog visibility

#### Connection Tracking
```typescript
const [pendingConnection, setPendingConnection] = useState<OnConnectStartParams | null>(null);
const connectionStartRef = useRef<OnConnectStartParams | null>(null);
```
- **pendingConnection**: Connection being created (for auto-add)
- **connectionStartRef**: Ref to avoid stale closures
- **Usage**: Drag from handle → drop on empty → auto-connect

#### Other Refs
```typescript
const ref = useRef<HTMLDivElement>(null);
const fileInputRef = useRef<HTMLInputElement>(null);
const lastLogicHash = useRef<string>("");
const mousePos = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
const isLoadedRef = useRef(false);
```
- **ref**: Main container ref (for coordinate calculations)
- **fileInputRef**: Hidden file input (for Load button)
- **lastLogicHash**: Debounce auto-save (prevents duplicate saves)
- **mousePos**: Current mouse position (for adding nodes at cursor)
- **isLoadedRef**: Prevents double-load on mount

---

### Sidebar State
```typescript
const [collapsed, setCollapsed] = useState(false);
const [activeTab, setActiveTab] = useState<'lib' | 'params'>('lib');
const [refreshKey, setRefreshKey] = useState(0);
const [contextMenu, setContextMenu] = useState<{ x, y, nodeId } | null>(null);
```
- **collapsed**: Sidebar collapsed (narrow width)
- **activeTab**: 'lib' (Library) or 'params' (Parameters)
- **refreshKey**: Incremented to force re-render (custom nodes refresh)
- **contextMenu**: Right-click menu on custom node in sidebar

---

### localStorage Storage

#### Keys
```typescript
const STORAGE_KEY = 'shader_graph';                  // Main graph
const CUSTOM_NODES_KEY = 'custom_nodes_library';     // Custom nodes
```

#### shader_graph Format
```json
{
  "nodes": [...],
  "edges": [...]
}
```
- **When Saved**: On any graph change (debounced via lastLogicHash)
- **When Loaded**: On app mount (isLoadedRef prevents double-load)
- **Size**: Typically 5-50KB depending on graph size

#### custom_nodes_library Format
```json
[
  {
    "id": "custom_mynode",
    "label": "MyNode",
    "description": "...",
    "inputs": [...],
    "outputs": [...],
    "isCustom": true,
    "subgraph": {
      "nodes": [...],
      "edges": [...]
    }
    // Note: glslTemplate is NOT saved (function)
  }
]
```
- **When Saved**: On custom node create/update/delete
- **When Loaded**: On app mount + on storage events
- **Functions Lost**: glslTemplate must be restored after JSON.parse
- **Size**: Can grow large with many custom nodes

#### Storage Events
```typescript
window.addEventListener('storage', handleStorageChange);        // Cross-tab sync
window.dispatchEvent(new Event('customNodesUpdated'));        // Same-window sync
```

---

### NODE_REGISTRY (Global Object)

```typescript
export const NODE_REGISTRY = {
  output: OutputNode,
  time: TimeNode,
  // ... 40+ built-in nodes
};
```

#### Static Nodes (Built-in)
- **Source**: `src/nodes/index.ts`
- **Loaded**: Import time (before app renders)
- **Count**: 45 nodes
- **Immutable**: Never modified at runtime

#### Dynamic Nodes (Custom)
- **Source**: localStorage → loaded on mount
- **Added**: `NODE_REGISTRY[customNodeId] = customNode`
- **Deleted**: `delete NODE_REGISTRY[customNodeId]`
- **Prefix**: All custom nodes start with `custom_`
- **Restoration**: glslTemplate function restored in loadCustomNodes()

---

### Data Flow Diagrams

#### Flow 1: Add Node to Canvas
```
User Action: Drag from sidebar OR Click in context menu
    ↓
onDrop() or onAddNode(typeId)
    ↓
Get NODE_REGISTRY[typeId] definition
    ↓
Create new Node object:
  - id: unique (timestamp-based)
  - type: 'shaderNode'
  - position: mousePos or menu position
  - data: { definition, value, label }
    ↓
setNodes([...nodes, newNode])
    ↓
ReactFlow re-renders
    ↓
Auto-save to localStorage (debounced)
    ↓
saveToHistory() after 2s
```

#### Flow 2: Create Connection
```
User Action: Drag from output handle to input handle
    ↓
onConnect(params: { source, sourceHandle, target, targetHandle })
    ↓
Get source and target node definitions
    ↓
Validate types: isValidConnection(sourceType, targetType)
    ↓
    ├─ Invalid → Abort (no edge created)
    └─ Valid → Continue
         ↓
    Check single connection per input:
    Remove existing edges to same target handle
         ↓
    Check auto-adaptation:
    If Smart Split input → adapt outputs
    If Relay Auto → adapt both input and output
         ↓
    setEdges([...filtered, newEdge])
         ↓
    ReactFlow re-renders
         ↓
    Auto-save to localStorage
         ↓
    saveToHistory() after 2s
```

#### Flow 3: Compile Graph to GLSL
```
User Action: Click "Show Code"
    ↓
handleShowCode()
    ↓
Convert nodes to GraphNode format
    ↓
Call compile(graphNodes, graphEdges)
    ↓
Topological sort (dependency order)
    ↓
For each node (in order):
    ├─ Get definition.glslTemplate
    ├─ Resolve input variables
    ├─ If custom node → Recursive compile(subgraph)
    ├─ Generate GLSL statement
    └─ Assign to variable (e.g., var_n123)
         ↓
    Find output node
         ↓
    Generate final code:
      - uniforms (iTime, iResolution)
      - function declarations
      - main() { ... gl_FragColor = vec4(output, 1.0); }
         ↓
    setCurrentCode(glslCode)
    setShowCode(true)
         ↓
    Modal displays code
```

#### Flow 4: Save/Load Graph
```
SAVE:
User clicks Save/Save As
    ↓
handleSaveFile(saveAs)
    ↓
Serialize graph:
  { nodes, edges }
    ↓
    ├─ saveAs=true → Show file picker, update currentFilePath
    └─ saveAs=false → Use currentFilePath or show picker
         ↓
    Create JSON blob
         ↓
    Trigger download
         ↓
    Update Toolbar (file name display)

LOAD:
User clicks Load
    ↓
File picker opens
    ↓
User selects JSON file
    ↓
Read file content
    ↓
restoreGraph(jsonString, fileName)
    ↓
Parse JSON
    ↓
Restore nodes + edges
    ↓
Auto-adapt Smart Split/Relay Auto nodes
    ↓
setNodes(restored), setEdges(restored)
    ↓
setCurrentFilePath(fileName)
    ↓
ReactFlow re-renders
```

#### Flow 5: Create Custom Node
```
User Action: Right-click → Create Custom Node
    ↓
setShowCustomDialog(true)
    ↓
User enters name + description
    ↓
handleCreateCustomNode(name, description)
    ↓
Get selected nodes (or use defaults if empty)
    ↓
Extract selected edges (internal only)
    ↓
Extract ports from Custom Input/Output nodes
    ↓
Create CustomNodeDefinition:
  - id: custom_{name}
  - inputs, outputs (from ports)
  - subgraph: { nodes, edges }
  - isCustom: true
  - glslTemplate: placeholder
    ↓
addCustomNode(customNode)
    ↓
Save to localStorage (CUSTOM_NODES_KEY)
    ↓
Add to NODE_REGISTRY[id] = customNode
    ↓
Dispatch 'customNodesUpdated' event
    ↓
Sidebar catches event → setRefreshKey(prev => prev + 1)
    ↓
Sidebar re-renders with new custom node
```

#### Flow 6: Undo/Redo
```
Graph Change:
setNodes() or setEdges()
    ↓
Debounced saveToHistory() (2s delay)
    ↓
Check if different from last snapshot
    ↓
Create snapshot: { nodes: deep copy, edges: deep copy }
    ↓
Clear future states if historyIndex < history.length - 1
    ↓
Push snapshot to history
    ↓
Trim to maxHistorySize (50)
    ↓
setHistoryIndex(history.length - 1)

UNDO (Ctrl+Z):
undo()
    ↓
Check historyIndex > 0
    ↓
setHistoryIndex(historyIndex - 1)
    ↓
Restore snapshot: history[historyIndex - 1]
    ↓
setNodes(), setEdges()
    ↓
Auto-adapt Smart Split/Relay Auto

REDO (Ctrl+Y):
redo()
    ↓
Check historyIndex < history.length - 1
    ↓
setHistoryIndex(historyIndex + 1)
    ↓
Restore snapshot: history[historyIndex + 1]
    ↓
setNodes(), setEdges()
```

#### Flow 7: Navigate Custom Nodes
```
ENTER:
User double-clicks custom node
    ↓
onNodeDoubleClick(node)
    ↓
Check if node.data.definition.isCustom
    ↓
enterCustomNode(nodeId)
    ↓
Get custom node definition
    ↓
Save current state to navigationStack:
  { name: currentContext, nodes, edges }
    ↓
Load subgraph:
  - If empty → Add default Custom Input + Output
  - Else → Load subgraph.nodes + edges
    ↓
setNodes(subgraph.nodes)
setEdges(subgraph.edges)
setCurrentContext(customNode.label)
    ↓
NavigationPanel becomes visible
    ↓
User edits subgraph

EXIT:
User clicks "Exit to Main" or breadcrumb
    ↓
navigateBack() or navigateToLevel(index)
    ↓
Save current subgraph to custom node definition
    ↓
Extract ports from Custom Input/Output nodes
    ↓
Update NODE_REGISTRY[nodeId].inputs/outputs
    ↓
Refresh all instances of custom node on canvas
    ↓
Pop from navigationStack
    ↓
Restore parent state:
  setNodes(navigationStack[index].nodes)
  setEdges(navigationStack[index].edges)
    ↓
setCurrentContext(navigationStack[index].name)
    ↓
If index === 0 → NavigationPanel hides
```

---

### State Update Triggers

#### Triggers for setNodes()
1. User drags node → `onNodesChange` (position update)
2. User adds node → `onDrop` or `onAddNode`
3. User deletes node → `deleteSelected` or context menu delete
4. Copy/Paste → `handlePaste`
5. Undo/Redo → `undo()`, `redo()`
6. Load file → `restoreGraph()`
7. Navigate custom node → `enterCustomNode()`, `navigateBack()`
8. Smart Split adaptation → Auto-update node.data.definition.outputs
9. Parameter update (Sidebar) → Update node.data.value

#### Triggers for setEdges()
1. User creates connection → `onConnect`
2. User deletes edge → Context menu or node deletion
3. Copy/Paste → `handlePaste`
4. Undo/Redo → `undo()`, `redo()`
5. Load file → `restoreGraph()`
6. Navigate custom node → `enterCustomNode()`, `navigateBack()`

#### Triggers for localStorage Write
1. Graph change → Auto-save (debounced via lastLogicHash)
2. Create custom node → `addCustomNode()`
3. Delete custom node → `deleteCustomNode()`
4. Manual save → `handleSaveFile()`
5. Clear graph → `handleClear()`
6. New project → `handleNew()`

#### Triggers for NODE_REGISTRY Update
1. App mount → `loadCustomNodes()` (adds custom_ nodes)
2. Create custom node → Direct assignment
3. Delete custom node → `delete NODE_REGISTRY[id]`
4. Navigate back from custom node → Update ports

#### Triggers for UI Re-render
1. State change → React automatic re-render
2. Custom nodes update → `setRefreshKey(prev => prev + 1)` (Sidebar)
3. Storage event → Cross-tab sync
4. customNodesUpdated event → Same-window sync

---

### Critical State Synchronization Points

#### Point 1: Custom Node Creation
```
State Changes:
1. localStorage[CUSTOM_NODES_KEY] ← addCustomNode()
2. NODE_REGISTRY[id] ← customNode
3. Sidebar.refreshKey ← +1 (via event)
4. history ← saveToHistory() after 2s

Verification:
✅ localStorage has JSON
✅ NODE_REGISTRY has definition
✅ Sidebar shows new node
✅ Can drag onto canvas
```

#### Point 2: Custom Node Deletion
```
State Changes:
1. localStorage[CUSTOM_NODES_KEY] ← deleteCustomNode()
2. NODE_REGISTRY[id] ← delete
3. Sidebar.refreshKey ← +1
4. history ← saveToHistory() after 2s

Verification:
✅ localStorage JSON updated
✅ NODE_REGISTRY no longer has id
✅ Sidebar removes node
✅ Existing instances orphaned (no error)
```

#### Point 3: Port Refresh
```
State Changes:
1. User edits subgraph (adds Custom Input)
2. navigateBack() extracts new ports
3. NODE_REGISTRY[id].inputs/outputs ← updated
4. All instances refresh (React sees definition change)
5. Canvas re-renders with new handles

Verification:
✅ Custom node instances show new port
✅ Can connect to new port
✅ Old connections preserved if port still exists
```

#### Point 4: Undo/Redo
```
State Changes:
1. User changes graph
2. After 2s → saveToHistory()
3. history array grows (max 50)
4. historyIndex = history.length - 1

On Undo:
1. historyIndex--
2. setNodes(history[historyIndex].nodes)
3. setEdges(history[historyIndex].edges)
4. Auto-adapt Smart Split/Relay Auto

Verification:
✅ Graph restored to previous state
✅ Smart nodes adapted correctly
✅ No console errors
```

---

### Memory Management

#### Limits
- **History**: 50 snapshots max (~5MB with large graphs)
- **localStorage**: 5-10MB browser limit
- **NODE_REGISTRY**: No limit (in-memory object)
- **Custom Nodes**: Practical limit ~100 nodes before performance issues

#### Cleanup
- **History Trim**: Removes oldest when > 50
- **Future States**: Cleared on new action after undo
- **Navigation Stack**: Cleared on "New" or "Load"
- **Clipboard**: Persists until overwritten (no auto-clear)

#### Performance Considerations
- **Deep Copy**: JSON.parse(JSON.stringify()) for history snapshots
- **Debouncing**: 2s for history, hash-based for auto-save
- **Memoization**: useMemo for custom nodes list, filtered structure
- **Event Throttling**: None currently (potential improvement)

---

## Edge Cases & Error Scenarios

This section documents edge cases, error conditions, and how the system handles them for each major functionality.

### Node Operations

#### Add Node to Canvas

**Normal Case:**
- User drags from sidebar or selects from context menu
- Node appears at drop/click position
- Unique label generated
- Added to graph successfully

**Edge Cases:**
1. **Duplicate Label**:
   - System appends number: "Add", "Add 2", "Add 3"
   - Counter increments until unique
   - Preserves original definition label

2. **Canvas Boundary**:
   - Node can be placed anywhere (no bounds checking)
   - User responsibility to keep organized

3. **Special Nodes**:
   - Group: Larger size (200x150 default)
   - Preview: Smaller size (100x100)
   - Note: Medium size (160x100)

4. **Empty NODE_REGISTRY[typeId]**:
   - Should never happen (validated before drag)
   - If happens → undefined behavior, likely crash

**Error Scenarios:**
- **Out of Memory**: Browser may crash with 1000+ nodes
- **Invalid typeId**: Returns without adding (silent fail)

#### Delete Node

**Normal Case:**
- User selects node(s) and presses Delete
- Nodes and connected edges removed
- Undo snapshot created

**Edge Cases:**
1. **Last Output Node**:
   - **BLOCKED** - Cannot delete
   - Alert: "Cannot delete the last Output node!"
   - Deletion prevented entirely

2. **No Selection**:
   - Delete key does nothing (no nodes to delete)

3. **Node with Many Connections**:
   - All connected edges deleted automatically
   - Orphaned nodes remain (no auto-cleanup)

4. **Delete While in Custom Node**:
   - Deletes from current subgraph context
   - Does not affect parent graph

**Error Scenarios:**
- **Orphaned Edges**: Should never happen (edges cleaned up automatically)

---

### Connection Operations

#### Create Connection

**Normal Case:**
- Drag from output to compatible input
- Type validation passes
- Single connection created
- Previous connection (if any) replaced

**Edge Cases:**
1. **Incompatible Types**:
   - **BLOCKED** - Connection not created
   - Alert: "Cannot connect {source} to {target}\n\n{reason}"
   - Examples:
     - float → vec3: "Incompatible types"
     - vec3 → float: "Incompatible types"

2. **Same Node**:
   - Allowed (e.g., Add node: out → a creates feedback loop)
   - Compiler may detect cycles later

3. **Multiple Outputs to Same Input**:
   - New connection REPLACES old connection
   - Only ONE edge per input allowed
   - Old edge automatically removed

4. **Auto Type Adaptation**:
   - auto → float: auto becomes float
   - float → auto: auto becomes float
   - After disconnect: auto returns to auto

5. **Smart Split Adaptation**:
   - Connect float to Smart Split input
   - Outputs change to: [x: float]
   - Connect vec3 to Smart Split input
   - Outputs change to: [x, y, z: float]
   - Previous connections preserved if ports still exist

6. **Multi-Type Ports**:
   - float|vec3 accepts float: ✅
   - float|vec3 accepts vec3: ✅
   - float|vec3 accepts vec2: ❌

**Error Scenarios:**
- **Cyclic Dependency**: Not checked during connection (checked during compilation)
- **Missing Handle**: If sourceHandle or targetHandle not found → silent fail

#### Delete Connection

**Normal Case:**
- Right-click edge → Delete
- Or delete source/target node
- Edge removed from graph

**Edge Cases:**
1. **Last Connection to Node**:
   - Node becomes isolated (no auto-delete)
   - Still compiles (uses default values)

2. **Delete Node Deletes Edges**:
   - All edges to/from node automatically removed

3. **Smart Split Disconnect**:
   - If input disconnected → outputs revert to [auto: auto]
   - Node shrinks back to single port

**Error Scenarios:**
- **Edge Not Found**: Should never happen (React state consistency)

---

### Custom Node Operations

#### Create Custom Node

**Normal Case:**
- User selects nodes (or none for empty)
- Right-click → Create Custom Node
- Enters name and description
- Custom node created with proper ports

**Edge Cases:**
1. **Empty Name**:
   - Alert: "Please enter a name for the custom node."
   - Creation blocked

2. **Name with Spaces**:
   - Converted to snake_case: "My Node" → `custom_my_node`
   - Lowercase enforced

3. **Name with Special Characters**:
   - Replaced with underscores: "Node@#$" → `custom_node____`
   - Safe for JavaScript object keys

4. **No Selection (Empty Custom Node)**:
   - ✅ **ALLOWED** (fixed in latest commit)
   - Creates with defaults:
     - Custom Input at (100, 200)
     - Output at (400, 200)

5. **Selection Without Custom Input/Output**:
   - Creates with placeholder outputs: [{ id: 'out', label: 'Out', type: 'vec3' }]
   - User should add Custom Input/Output nodes inside

6. **Selection with Partial Edges**:
   - Only includes edges where BOTH source AND target are selected
   - External connections ignored

7. **Selection Includes Another Custom Node**:
   - ✅ **ALLOWED** - Nesting supported
   - Recursive compilation handles it

8. **Name Collision**:
   - Currently: Overwrites existing (addCustomNode filters by id)
   - **TODO**: Should warn or auto-rename

**Error Scenarios:**
- **localStorage Full** (>5MB):
  - saveCustomNodes() fails silently
  - console.error logged
  - Node not saved (lost on reload)

- **Circular Self-Reference**:
  - Custom node contains instance of itself
  - Currently: Not prevented
  - Compiler: Infinite recursion → stack overflow
  - **TODO**: Detect and prevent

#### Edit Custom Node (Navigate In)

**Normal Case:**
- Double-click custom node instance
- Enters subgraph editing mode
- Navigation panel appears
- Edit nodes inside

**Edge Cases:**
1. **Empty Subgraph**:
   - System adds default Custom Input + Output
   - Positions: (100, 200) and (400, 200)

2. **Deep Nesting** (3+ levels):
   - ✅ Supported (no depth limit)
   - Navigation panel shows full breadcrumb trail

3. **Edit While Another Custom Node Open**:
   - Navigation stack preserves hierarchy
   - Can navigate: Main → Outer → Inner → Edit Inner

**Error Scenarios:**
- **Missing Custom Node Definition**:
  - If NODE_REGISTRY[id] deleted → undefined behavior
  - Should check before entering

#### Navigate Back (Exit)

**Normal Case:**
- Click "Exit to Main" or breadcrumb
- Saves current subgraph
- Extracts updated ports
- Restores parent graph

**Edge Cases:**
1. **No Custom Input/Output**:
   - Ports arrays empty: inputs=[], outputs=[]
   - Custom node on parent has no handles
   - Compilation may fail

2. **Changed Port Count**:
   - Added ports: New handles appear on parent instances
   - Removed ports: Connections to removed ports deleted
   - All instances refresh (React re-render)

3. **Changed Port Types**:
   - Custom Input/Output are always 'auto'
   - No type change issues

4. **Navigate Back from Main**:
   - navigationStack.length === 0 → Early return
   - No crash

**Error Scenarios:**
- **Restore Main State Error**:
  - navigationStack[0] should always be Main
  - If corrupted → uses initialNodesDefault (fallback)

#### Delete Custom Node

**Normal Case:**
- Right-click in sidebar → Delete
- Check if used on canvas
- Show warning if used
- Delete from storage + registry

**Edge Cases:**
1. **Used on Canvas**:
   - Confirmation dialog: "⚠️ This custom node is currently used on the canvas. Delete anyway?"
   - User can cancel
   - If confirmed → Deletes (instances become orphaned)

2. **Not Used on Canvas**:
   - No confirmation (immediate delete)

3. **Delete Non-Existent**:
   - deleteCustomNode() silently succeeds (filter removes nothing)
   - No error thrown

4. **Rapid Deletion**:
   - Multiple deletes in quick succession
   - Each triggers sidebar refresh
   - May cause flicker (acceptable)

**Error Scenarios:**
- **localStorage Write Fail**:
   - console.error logged
   - Node may not be deleted persistently
   - Appears deleted until refresh

- **NODE_REGISTRY Delete Fail**:
   - Manual delete (no try/catch)
   - Should never fail

---

### File Operations

#### Save Graph

**Normal Case:**
- User clicks Save (Ctrl+S)
- If file path exists → quick save
- If no path → prompts for filename
- JSON downloaded

**Edge Cases:**
1. **Save As (Ctrl+Shift+S)**:
   - Always prompts for filename
   - Pre-fills with current filename (without .json)
   - User can rename

2. **Empty Graph**:
   - Saves `{ nodes: [Output], edges: [] }`
   - Valid JSON (can be reloaded)

3. **Large Graph** (100+ nodes):
   - JSON may be 100KB+
   - Browser handles download fine

4. **Special Characters in Filename**:
   - User enters "My Graph!"
   - Saved as "My Graph!.json"
   - May cause issues on some filesystems

5. **Cancel File Prompt**:
   - prompt() returns null
   - Uses fallback: `shader_graph_{timestamp}.json`

**Error Scenarios:**
- **JSON.stringify Fail**:
  - Should never happen (all nodes are serializable)
  - If happens → unhandled exception

- **Download Blocked**:
  - Browser popup blocker may prevent
  - User must allow downloads

#### Load Graph

**Normal Case:**
- User clicks Load
- File picker opens
- Selects .json file
- Graph restored

**Edge Cases:**
1. **Invalid JSON**:
   - Parse error caught
   - console.error logged
   - Graph not changed (stays as-is)

2. **JSON Without nodes/edges**:
   - Missing nodes → uses initialNodesDefault
   - Missing edges → uses []

3. **Old Format** (before custom nodes):
   - No customNodes field → ignored
   - Backward compatible

4. **Smart Split Nodes in File**:
   - Restored with saved outputs
   - Auto-adaptation re-runs on load
   - Outputs may change if connections differ

5. **Load While Editing Custom Node**:
   - Loads into current context (replaces subgraph)
   - May be unexpected → **TODO**: Warn or force to Main

6. **Cancel File Picker**:
   - No file selected → nothing happens

**Error Scenarios:**
- **File Read Error**:
   - FileReader may fail
   - No error handling currently
   - **TODO**: Add try/catch

- **Corrupted Custom Nodes**:
   - loadCustomNodes() returns empty array
   - Graph loads but custom nodes missing
   - User sees broken references

---

### Undo/Redo Operations

#### Undo (Ctrl+Z)

**Normal Case:**
- User makes change
- After 2s → saveToHistory()
- Presses Ctrl+Z
- Graph restored to previous state

**Edge Cases:**
1. **Undo Immediately After Change** (< 2s):
   - No snapshot yet (debounced)
   - Undo does nothing (historyIndex doesn't change)

2. **Undo to Empty Graph**:
   - Restores to snapshot with only Output node
   - Valid state

3. **Undo Smart Split Connection**:
   - Smart Split outputs revert to previous type
   - If was vec3, reverts to vec3

4. **Multiple Undos in Sequence**:
   - Each undo goes back one step
   - Stops at historyIndex === 0

5. **Undo After Delete Last Output**:
   - Output node restored
   - Protection only applies to delete action, not undo

**Error Scenarios:**
- **Corrupted Snapshot**:
   - JSON.parse may fail (shouldn't happen)
   - If fails → graph broken
   - **TODO**: Validate snapshot before saving

#### Redo (Ctrl+Y)

**Normal Case:**
- User undoes change
- Presses Ctrl+Y
- Graph restored to next state

**Edge Cases:**
1. **Redo After New Action**:
   - Future states cleared
   - Redo becomes unavailable (canRedo = false)

2. **Multiple Redos**:
   - Stops at historyIndex === history.length - 1

3. **Redo Unavailable**:
   - Button grayed out
   - Shortcut does nothing

**Error Scenarios:**
- **History Corruption**: Same as Undo

---

### Parameter Operations

#### Update Global Parameter

**Normal Case:**
- User changes slider in Sidebar Parameters tab
- All nodes with same label update simultaneously
- Shader recompiles

**Edge Cases:**
1. **No Nodes with Label**:
   - Parameter appears in tab but unused
   - Slider still functional

2. **Mixed Types Same Label**:
   - Should never happen (same label = same type)
   - If happens → only matching type updates

3. **Parameter on Canvas** (not in Sidebar):
   - Value only updates if user drags slider on node itself
   - Sidebar parameter controls global value

4. **Min > Max**:
   - Slider broken (value clamped incorrectly)
   - **TODO**: Validate min < max

5. **Step Too Small** (< 0.0001):
   - Slider may be too sensitive
   - Precision issues

**Error Scenarios:**
- **NaN Value**:
   - parseFloat() may return NaN
   - GLSL compilation may fail
   - **TODO**: Validate numeric input

---

### Compilation Edge Cases

#### Compile Graph to GLSL

**Normal Case:**
- Graph has valid connections
- Topological sort succeeds
- GLSL code generated

**Edge Cases:**
1. **Cyclic Dependency**:
   - A → B → C → A (cycle)
   - Topological sort fails (no valid ordering)
   - Currently: **NOT DETECTED**
   - Result: Undefined behavior, may infinite loop
   - **TODO**: Add cycle detection

2. **Disconnected Nodes**:
   - Nodes without inputs use default values
   - Compiled as literals (e.g., `0.0`, `vec3(0.0)`)

3. **Multiple Output Nodes**:
   - ✅ Allowed
   - Only first Output node used for final output
   - Others ignored (dead code)

4. **No Output Node**:
   - Compilation fails
   - Final shader: `gl_FragColor = vec4(vec3(0.0), 1.0)` (black)

5. **Custom Node Inside Custom Node** (Nesting):
   - Recursive compilation
   - Each level inlines GLSL
   - Deep nesting (10+ levels) may be slow

6. **Custom Node Self-Reference**:
   - Custom node contains instance of itself
   - Infinite recursion
   - Stack overflow
   - **TODO**: Detect and prevent

7. **Missing glslTemplate**:
   - After JSON deserialization
   - Restored via loadCustomNodes()
   - If restoration fails → compilation error

**Error Scenarios:**
- **GLSL Syntax Error**:
  - Generated code may have syntax errors
  - Three.js shows shader compilation error in console
  - Preview shows error message

- **Variable Name Collision**:
  - Multiple nodes generate var_n123
  - Should never happen (IDs unique)
  - If happens → GLSL redeclaration error

---

### Storage & Persistence

#### localStorage Operations

**Normal Case:**
- State changes saved automatically
- localStorage updated
- Data persists across sessions

**Edge Cases:**
1. **localStorage Disabled**:
   - Private browsing mode
   - setItem throws exception
   - Caught in try/catch
   - console.error logged
   - App still works (no persistence)

2. **localStorage Full** (>5MB):
   - setItem throws QuotaExceededError
   - Caught in try/catch
   - console.error logged
   - Old data remains (no update)
   - **TODO**: Show user warning

3. **Corrupted JSON**:
   - Parse fails
   - Caught in try/catch
   - Returns default state (initialNodesDefault)
   - No data loss (user can manually fix JSON)

4. **Custom Nodes JSON Corrupted**:
   - loadCustomNodes() returns []
   - Custom nodes not loaded
   - User loses custom nodes until fixed

5. **Cross-Tab Editing**:
   - Tab A saves custom node
   - Tab B receives 'storage' event
   - Tab B refreshes custom nodes
   - Both tabs synchronized

**Error Scenarios:**
- **Race Condition** (Multiple Tabs):
  - Tab A and Tab B both save simultaneously
  - Last write wins
  - Earlier changes lost
  - **TODO**: Add conflict detection

- **Browser Crash Mid-Save**:
  - Partial write to localStorage
  - Next load may have corrupted data
  - Handled by try/catch (returns defaults)

---

### Navigation & Context

#### Custom Node Navigation

**Normal Case:**
- Enter custom node → navigation stack grows
- Exit → navigation stack shrinks
- State preserved correctly

**Edge Cases:**
1. **Navigate to Level 0 (Main)**:
   - Restores from navigationStack[0]
   - If stack empty → uses initialNodesDefault

2. **Jump to Middle Level**:
   - Click breadcrumb "Level 2" when at "Level 4"
   - Pops levels 3 and 4
   - Restores Level 2 state

3. **Exit Without Saving**:
   - navigateBack() always saves before exit
   - No "discard changes" option
   - **Auto-save on exit**

4. **Edit Then Immediately Exit**:
   - Changes saved
   - Ports extracted
   - Instances refreshed

5. **Deep Nesting** (10+ levels):
   - Breadcrumb panel may overflow
   - **TODO**: Add scrolling or collapse

**Error Scenarios:**
- **Navigation Stack Corruption**:
  - If stack cleared unexpectedly → can't navigate back
  - Main state lost
  - **TODO**: Persist stack to localStorage

- **Port Extraction Fails**:
  - If extractCustomNodePorts() fails → empty ports
  - Custom node has no handles
  - Compilation fails

---

### Clipboard Operations

#### Copy (Ctrl+C)

**Normal Case:**
- User selects nodes
- Presses Ctrl+C
- Clipboard filled

**Edge Cases:**
1. **No Selection**:
   - Early return (clipboard unchanged)

2. **Copy Single Node**:
   - Clipboard has 1 node, 0 edges

3. **Copy with External Edges**:
   - Only internal edges copied
   - External connections lost

**Error Scenarios:**
- None (simple array filter)

#### Paste (Ctrl+V)

**Normal Case:**
- Clipboard has data
- Presses Ctrl+V
- Nodes pasted with offset

**Edge Cases:**
1. **Empty Clipboard**:
   - Early return (nothing pasted)

2. **Paste Same Selection Multiple Times**:
   - Each paste creates new IDs
   - Offset: +50px X and Y each time
   - Can create many copies

3. **Paste Custom Node Instance**:
   - ✅ Works (copies instance, not definition)
   - All instances use same NODE_REGISTRY[id]

4. **Paste Across Custom Node Contexts**:
   - Copy in Main → Enter custom node → Paste
   - ✅ Works (pastes into current context)

**Error Scenarios:**
- **ID Collision**: Should never happen (new IDs generated)

#### Cut (Ctrl+X)

**Normal Case:**
- Copies then deletes selected

**Edge Cases:**
1. **Cut Last Output Node**:
   - Copy succeeds
   - Delete blocked
   - Output node remains

2. **Cut All Nodes**:
   - Clipboard filled
   - All deleted except last Output
   - Graph nearly empty

---

### Type System Edge Cases

#### Type Validation

**Edge Cases:**
1. **auto → auto**:
   - ✅ Valid
   - Both adapt to first concrete type in chain

2. **float|vec3 → float|vec3**:
   - ✅ Valid (multi-type to multi-type)

3. **float|vec3 → auto**:
   - ✅ Valid
   - auto adapts to actual type (float OR vec3)

4. **Swizzling Multi-Type**:
   - float|vec3.x → ❌ Invalid
   - Can't swizzle multi-type ports

5. **Empty Type String**:
   - Should never happen
   - If happens → validation fails (no match)

**Error Scenarios:**
- **Unknown Type** ('vec5', 'int'):
  - Not in TYPE_COLORS
  - Handle renders with default color (#555)
  - Validation: Exact match only (vec5 → vec5 would work)

---

### UI Edge Cases

#### Context Menu Positioning

**Edge Cases:**
1. **Menu Near Screen Edge**:
   - Auto-adjusts position to stay visible
   - Checks: right, bottom boundaries
   - May open upward or leftward

2. **Submenu Near Right Edge**:
   - Opens on left side instead
   - Calculated via `openLeft` state

3. **Very Small Window**:
   - Menu may still overflow
   - User must scroll or resize window

#### Drag & Drop

**Edge Cases:**
1. **Drop Outside Canvas**:
   - ReactFlow's onDrop not fired
   - No node created

2. **Drop on Existing Node**:
   - Creates at drop position (may overlap)
   - No auto-positioning

3. **Drag Non-Node Element**:
   - dataTransfer has no 'application/reactflow'
   - onDrop early return

#### Keyboard Shortcuts

**Edge Cases:**
1. **Ctrl+S While Input Focused**:
   - Shortcut still fires (useEffect on document)
   - Input loses focus briefly

2. **Multiple Keys Pressed**:
   - Ctrl+Z+Y simultaneously → Last one wins

3. **Shortcuts While Dialog Open**:
   - Dialog has own keyboard handlers
   - May conflict (e.g., Escape closes dialog and menu)

---

### Performance Edge Cases

#### Large Graphs

**Edge Cases:**
1. **100+ Nodes**:
   - ReactFlow handles well
   - Compilation slows (O(n²) topological sort)
   - Rendering: ~60fps

2. **1000+ Nodes**:
   - Browser may lag
   - Compilation: 1-5 seconds
   - Rendering: 10-30fps

3. **Deep Custom Node Nesting** (10+ levels):
   - Recursive compilation overhead
   - Each level adds 10-50ms
   - Total: 100-500ms for deep graphs

**Error Scenarios:**
- **Stack Overflow**:
  - Circular custom node reference
  - Infinite recursion in compiler
  - Browser crashes
  - **TODO**: Add recursion depth limit

- **Out of Memory**:
  - History snapshots too large
  - Browser crashes
  - **TODO**: Compress snapshots or reduce history size

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
| 2026-02-15 | 1.1 | **Iteracja 1**: UI Components Specification (515 lines) |
| 2026-02-15 | 1.2 | **Iteracja 2**: Complete Node Specifications - 24 nodes (771 lines) |
| 2026-02-15 | 1.3 | **Iteracja 3**: State Management & Data Flow (612 lines) |
| 2026-02-15 | 1.4 | **Iteracja 4**: Edge Cases & Error Scenarios - Comprehensive edge cases for all operations: nodes, connections, custom nodes, files, undo/redo, parameters, compilation, storage, navigation, clipboard, type system, UI, performance (580+ lines) |

---

**Last Updated**: 2026-02-15  
**Document Owner**: Development Team  
**Status**: Active  
**Review Cycle**: After major features or every 10 commits
