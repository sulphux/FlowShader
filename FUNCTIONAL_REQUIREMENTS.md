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

## Node Categories

### Output & Inputs
- `output` - Final shader output (accepts float|vec3)
- `time` - Animation time (outputs float)
- `param_float` - Float parameter with slider
- `param_color` - Color picker (outputs vec3)
- `uv` - UV coordinates (outputs vec2)

### Custom Nodes
- `custom_input` - Input port for custom nodes (auto type)
- `custom_output` - Output port for custom nodes (auto type)
- User-created custom nodes (dynamic)

### Math (Basic)
- `math_add`, `math_sub`, `math_mult`, `math_div` - Basic operations
- `math_negate` - Negate value
- `math_pow` - Power function

### Math (Trig/Func)
- `math_sin`, `math_cos` - Trigonometry
- `math_abs` - Absolute value
- `math_exp` - Exponential

### Vector & Space
- `uv_scale` - Scale UV coordinates
- `uv_shift` - Offset UV coordinates
- `vec_length` - Vector length
- `vec_fract` - Fractional part
- `math_mix` - Linear interpolation
- `relay_auto` - Universal relay node (auto type)

### Utils
- `special_note` - Text annotation
- `special_group` - Visual grouping
- `smart_split` - Auto-detect split (float/vec2/vec3/vec4 → components)
- `smart_compose` - Auto-detect compose (components → vec2/vec3/vec4)
- `monitor` - Value monitoring
- `preview` - In-graph shader preview

### Color & Shapes
- `palette` - Color palette generator
- `color_add` - Add colors
- `color_mult` - Multiply colors
- `sdf_circle` - Circle signed distance function

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
| 2026-02-15 | 1.1 | **Iteracja 1**: Added "UI Components Specification" - Complete specs for NodeEditor, ShaderNode, Sidebar, Toolbar, NavigationPanel, ContextMenu, CreateCustomNodeDialog (334 new lines) |

---

**Last Updated**: 2026-02-15  
**Document Owner**: Development Team  
**Status**: Active  
**Review Cycle**: After major features or every 10 commits
