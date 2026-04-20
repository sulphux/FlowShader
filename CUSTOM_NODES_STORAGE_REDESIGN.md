# Custom Nodes Storage System - Redesign Document

**Created**: 2026-02-15  
**Status**: DRAFT (awaiting implementation)  
**Reason**: Current system has critical bugs - subgraph changes not persisting, type sync broken

---

## Current Problems (Evidence-Based)

### Bug 1: Subgraph Changes Don't Persist
**User report**: "Enter custom node → add Float → exit → re-enter → Float is GONE"

**Root cause**: 
- `navigationStack` stores OLD snapshot of nodes
- On exit: saves `nodes` from state (correct)
- On re-enter: loads from `customDef.subgraph.nodes` (stale!)
- **nodes state ≠ subgraph nodes** (out of sync)

**Code location**: `NodeEditor.tsx` lines 485-540 (navigateBack)

### Bug 2: Type Sync Doesn't Work
**User report**: "Connect Float→CustomInput inside → exit → port outside still purple (auto), not red (float)"

**Root cause**:
- `detectedType` IS set in nodes state (line 860) ✅
- `extractCustomNodePorts` reads it (line 116) ✅
- BUT: When saving subgraph, might use OLD nodes without `detectedType`
- OR: Instance refresh doesn't propagate types correctly

**Code location**: `NodeEditor.tsx` line 527-535 (refresh instances)

### Bug 3: Multiple Contexts Are Confusing
**Problem**: 
- `navigationStack` holds previous states
- `nodes` holds current state
- `customDef.subgraph` holds definition state
- **Which is source of truth?** 🤷

---

## Design Philosophy (User's Analogy)

### Like Functions in C (Single File)

```c
// Everything in ONE file - simple!
void add(int a, int b) { return a + b; }
void multiply(int a, int b) { return a * b; }

int main() {
  int x = add(2, 3);      // Call add()
  int y = multiply(x, 4); // Call multiply()
  return y;
}
```

**Key insight**: 
- Functions are DEFINITIONS (like custom node subgraphs)
- Calls are INSTANCES (like custom node on canvas)
- Everything stored together, compiler figures it out!

### Applied to NodeShader

```typescript
// ONE global nodes array (like one file)
const nodes = [
  // Main context
  { id: 'time-1', context: 'main', ... },
  { id: 'custom-instance-1', context: 'main', type: 'custom_add' },
  
  // Inside custom_add (virtual context)
  { id: 'input-a', context: 'custom_add/definition', ... },
  { id: 'math-add-1', context: 'custom_add/definition', ... },
  { id: 'output-1', context: 'custom_add/definition', ... }
];

// Filter by context when rendering
const visibleNodes = nodes.filter(n => n.context === currentContext);
```

**Benefits**:
- ✅ Single source of truth (nodes array)
- ✅ No sync issues (everything in one place)
- ✅ Easy to save (just save nodes array)
- ✅ Easy to undo (snapshot whole array)

---

## Proposed Architecture: FLAT STRUCTURE

### Data Model

```typescript
interface Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    definition: ShaderNodeDefinition;
    value?: any;
    detectedType?: DataType;
    context: string;  // NEW - 'main' or 'custom_mynode' or 'custom_mynode/nested'
  };
}

interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  context: string;  // NEW - same as nodes
}
```

### Context System

**Main graph**: `context = 'main'`
**Inside custom_add**: `context = 'custom_add'`
**Nested (custom_add inside custom_outer)**: `context = 'custom_outer/custom_add'`

### Rendering (Filter by Context)

```typescript
// Current editing context
const [currentContext, setCurrentContext] = useState('main');

// Filter nodes for current context
const visibleNodes = nodes.filter(n => n.data.context === currentContext);
const visibleEdges = edges.filter(e => e.context === currentContext);

// Pass to ReactFlow
<ReactFlow nodes={visibleNodes} edges={visibleEdges} />
```

### Save to Custom Node Definition

```typescript
function saveCustomNodeDefinition(customNodeId: string) {
  // Extract nodes/edges that belong to this custom node
  const subgraphNodes = nodes.filter(n => n.data.context === customNodeId);
  const subgraphEdges = edges.filter(e => e.context === customNodeId);
  
  // Extract ports
  const ports = extractCustomNodePorts({ nodes: subgraphNodes });
  
  // Update definition
  const updatedDef = {
    ...NODE_REGISTRY[customNodeId],
    inputs: ports.inputs,
    outputs: ports.outputs,
    subgraph: {
      nodes: subgraphNodes.map(n => ({ ...n, data: { ...n.data, context: undefined } })), // Clean context
      edges: subgraphEdges.map(e => ({ ...e, context: undefined }))
    }
  };
  
  // Save
  addCustomNode(updatedDef);
  NODE_REGISTRY[customNodeId] = updatedDef;
}
```

### Navigation (Context Switch)

```typescript
function enterCustomNode(customNodeId: string) {
  // Load subgraph nodes into main nodes array
  const customDef = NODE_REGISTRY[customNodeId];
  
  // Add subgraph nodes to global array with context
  const subgraphNodesWithContext = customDef.subgraph.nodes.map(n => ({
    ...n,
    data: { ...n.data, context: customNodeId }
  }));
  
  const subgraphEdgesWithContext = customDef.subgraph.edges.map(e => ({
    ...e,
    context: customNodeId
  }));
  
  setNodes(prev => [...prev, ...subgraphNodesWithContext]);
  setEdges(prev => [...prev, ...subgraphEdgesWithContext]);
  setCurrentContext(customNodeId);
}

function exitCustomNode() {
  // Save current context
  saveCustomNodeDefinition(currentContext);
  
  // Remove nodes from this context
  setNodes(prev => prev.filter(n => n.data.context !== currentContext));
  setEdges(prev => prev.filter(e => e.context !== currentContext));
  
  // Return to parent context
  setCurrentContext('main');
}
```

---

## Alternative: Keep Nested (Fix Current System)

If flat structure is too risky, fix current system properly:

### Fix 1: Use Fresh Nodes on Save
```typescript
// navigateBack - line 506
subgraph: {
  nodes: nodes,  // Use nodes from STATE, not navigationStack!
  edges: edges   // Use edges from STATE
}
```

### Fix 2: Deep Clone on Navigation
```typescript
// When entering custom node, deep clone subgraph
const clonedNodes = JSON.parse(JSON.stringify(customDef.subgraph.nodes));
setNodes(clonedNodes);
```

### Fix 3: Save on Every Change (Debounced)
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    if (currentContext !== 'main') {
      saveCustomNodeDefinition(currentContext);
    }
  }, 500); // Debounce 500ms
  
  return () => clearTimeout(timer);
}, [nodes, edges, currentContext]);
```

---

## Decision Matrix

| Approach | Pros | Cons | Effort | Risk |
|----------|------|------|--------|------|
| **Flat Structure** | Simple, single source of truth | Breaking change, all tests need update | 6-8h | HIGH |
| **Fix Nested** | Less breaking, safer | Band-aid fix, complexity remains | 2-3h | MEDIUM |
| **Hybrid** | Best of both | Complex architecture | 4-5h | MEDIUM |

**Recommendation**: Start with **Fix Nested** (safer), migrate to Flat later if needed.

---

## Implementation Plan (Fix Nested - SAFE)

### Step 1: Write E2E Tests (HARD) (~1h)

`customNodeStorageE2E.test.ts`:

```typescript
it('E2E: should persist node added inside custom node', () => {
  // 1. Create custom node
  const customNode = createCustomNode('TestNode');
  NODE_REGISTRY['custom_testnode'] = customNode;
  
  // 2. Enter (load subgraph)
  const initialNodes = [...customNode.subgraph.nodes];
  setNodes(initialNodes);
  
  // 3. Add Float node
  const floatNode = { id: 'float-new', type: 'param_float', ... };
  setNodes(prev => [...prev, floatNode]);
  
  // 4. Exit (save)
  const updatedDef = saveOnExit(customNode.id, nodes, edges);
  
  // 5. Verify saved
  expect(updatedDef.subgraph.nodes.length).toBe(initialNodes.length + 1);
  expect(updatedDef.subgraph.nodes.find(n => n.id === 'float-new')).toBeDefined();
  
  // 6. Re-enter (load again)
  const reloadedNodes = updatedDef.subgraph.nodes;
  
  // 7. VERIFY: Float still there!
  expect(reloadedNodes.find(n => n.id === 'float-new')).toBeDefined();
});
```

**MUST test REAL flow**: enter → modify → exit → re-enter → verify!

### Step 2: Fix navigateBack to Use Fresh State (~30min)

```typescript
// Line 506 - use CURRENT state, not old
subgraph: {
  nodes: nodes,  // Current state (has detectedType!)
  edges: edges   // Current state
}
```

### Step 3: Fix Instance Refresh (~30min)

```typescript
// Line 527-535 - ensure ports are updated
data: {
  ...node.data,
  definition: freshDef  // Fresh definition with new ports!
}
```

### Step 4: Add Auto-Save on Change (Optional) (~30min)

Debounced save when editing inside custom node.

---

## Success Criteria (MUST ALL PASS)

1. ✅ Enter custom node → add Float → exit → **Float persists**
2. ✅ Re-enter → **Float still there**
3. ✅ localStorage updated correctly
4. ✅ NODE_REGISTRY updated correctly
5. ✅ Connect Float→CustomInput → exit → **parent port is red (float)**
6. ✅ Instance on canvas updates immediately
7. ✅ All 419 tests still pass
8. ✅ New E2E tests pass (10+)
9. ✅ **User manually verifies it works**

---

## Next Steps

1. I write E2E tests (HARD - real flow)
2. Delegate implementation to worker
3. Supervise worker closely
4. You test manually
5. Iterate until it REALLY works
6. Commit only after your approval

Start with E2E tests now?
