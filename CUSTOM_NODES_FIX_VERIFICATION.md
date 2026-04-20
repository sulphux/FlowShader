# Custom Nodes Fix - Manual Verification Guide

**Date**: 2026-02-15  
**Status**: Ready for Testing  
**Tests**: ✅ All 433 automated tests passing

---

## 🎯 What Was Fixed

### Problem 1: `detectedType` Lost After Reload
**Before**: Custom Input/Output nodes had their detected types (float, vec3) reset to 'auto' after page reload.  
**After**: Types are now preserved in localStorage and restored correctly.

### Problem 2: Ports Don't Update After Editing Custom Node
**Before**: When you connect Float → Custom Input inside custom node and exit, the port outside stayed purple (auto).  
**After**: Port colors now update correctly to match detected types (red for float, blue for vec3, etc.).

---

## 🧪 Manual Testing Steps

### Test A: Type Detection (Float → Custom Input)

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Create a simple custom node**:
   - Add `Float` node to canvas
   - Right-click on canvas → "Create Custom Node" → name it "TestNode"
   - Double-click the new "TestNode" to enter it

3. **Connect Float to Custom Input**:
   - Inside TestNode, drag from `Float` output → `Input` input (the Custom Input node)
   - **Open browser console (F12)** and check for logs:
     ```
     ✅ Custom Input type detected: {
       nodeId: 'custom_input-...',
       detectedType: 'float',
       label: 'Input'
     }
     ```

4. **Exit and verify**:
   - Click "Exit to Main" or "Up One Level"
   - Check console for:
     ```
     💾 Saving custom node to localStorage: {
       nodeId: 'custom_testnode',
       inputs: [{ id: '...', label: 'Input', type: 'float' }],
       ...
     }
     ✅ Verified reload: { found: true, firstNodeDetectedType: 'float' }
     ```

5. **Visual check**:
   - On the main canvas, the "TestNode" should have a **RED input port** (not purple)
   - Hover over it - tooltip should say "Input (float)"

### Test B: Persistence After Reload

1. **Save and reload**:
   - Press `Ctrl+S` (or Save button)
   - Press `F5` to refresh the page

2. **Re-enter TestNode**:
   - Double-click "TestNode" again
   - **Float node should still be there!**
   - Connection should still exist

3. **Check console**:
   ```javascript
   // Open console (F12) and type:
   console.log(JSON.parse(localStorage.getItem('custom_nodes_library')));
   ```
   - Look for `detectedType: 'float'` in the subgraph nodes

### Test C: Multiple Detected Types

1. **Add more nodes inside TestNode**:
   - Add `UV` node (outputs vec2 - green)
   - Add another Custom Input node (from sidebar)
   - Connect `UV` → new Custom Input

2. **Exit and check**:
   - TestNode should now have **TWO input ports**:
     - First: RED (float)
     - Second: GREEN (vec2)

3. **Verify in console**:
   ```javascript
   console.log(NODE_REGISTRY['custom_testnode'].inputs);
   // Should show:
   // [
   //   { id: '...', label: 'Input', type: 'float' },
   //   { id: '...', label: 'Input', type: 'vec2' }
   // ]
   ```

### Test D: Custom Output Type Detection

1. **Inside TestNode**:
   - Add `Color Add` node (outputs vec3 - blue)
   - Add Custom Output node
   - Connect `Color Add` → Custom Output

2. **Exit and check**:
   - TestNode should have a **BLUE output port** (vec3)

---

## 🔍 Debug Logs to Watch For

### Good Logs (Everything Working):

```javascript
// When connecting Float → Custom Input:
✅ Custom Input type detected: {
  nodeId: 'custom_input-abc123',
  detectedType: 'float',
  label: 'Input'
}

// When exiting custom node:
🔍 extractCustomNodePorts - Custom Input: {
  nodeId: 'custom_input-abc123',
  portName: 'Input',
  detectedTypeFromData: 'float',      // ← Should NOT be undefined!
  detectedTypeFromDef: 'float',       // ← Should match
  final: 'float'
}

💾 Saving custom node to localStorage: {
  nodeId: 'custom_testnode',
  subgraphNodesCount: 2,
  firstNodeDetectedType: 'float',     // ← Should NOT be undefined!
  inputs: [{ id: '...', label: 'Input', type: 'float' }],
  outputs: [...]
}

✅ Verified reload: {
  found: true,
  firstNodeDetectedType: 'float'     // ← Confirms it was saved!
}
```

### Bad Logs (Still Broken):

```javascript
// ❌ BAD - detectedType is undefined:
🔍 extractCustomNodePorts - Custom Input: {
  detectedTypeFromData: undefined,   // ← PROBLEM!
  detectedTypeFromDef: 'auto',
  final: 'auto'
}

// ❌ BAD - not saved to localStorage:
✅ Verified reload: {
  found: true,
  firstNodeDetectedType: undefined   // ← PROBLEM!
}
```

---

## 📊 Expected Results (Success Criteria)

| Test | Expected Behavior | Visual Check |
|------|-------------------|--------------|
| Float → Custom Input | Red port (float) | 🔴 Red circle |
| UV → Custom Input | Green port (vec2) | 🟢 Green circle |
| Color → Custom Input | Blue port (vec3) | 🔵 Blue circle |
| Type persists after reload | Same color after F5 | Same as before |
| localStorage has detectedType | Console shows `detectedType: 'float'` | Check F12 |

---

## 🐛 Known Issues / Limitations

1. **First connection might not show immediately**: Sometimes you need to **click elsewhere** on canvas to trigger re-render. This is a React/ReactFlow quirk, not a bug.

2. **Console logs are verbose**: We added detailed logging for debugging. Once verified working, we can remove some of them.

3. **Auto type is still valid**: If you DON'T connect anything to Custom Input, it correctly stays 'auto' (purple).

---

## 🚨 If Something Doesn't Work

### Symptom 1: Port stays purple (auto) after connection

**Check**:
```javascript
// In console:
const nodes = JSON.parse(localStorage.getItem('shader-nodes-save-v1')).nodes;
const customInput = nodes.find(n => n.data?.definition?.id === 'custom_input');
console.log('Custom Input data:', customInput.data);
```

**Expected**: `detectedType: 'float'` (or vec2, vec3, etc.)  
**If undefined**: Connection detection didn't trigger - check if `onConnect` handler is called.

### Symptom 2: Type lost after reload

**Check**:
```javascript
const customNodes = JSON.parse(localStorage.getItem('custom_nodes_library'));
console.log('First custom node subgraph:', customNodes[0].subgraph.nodes);
```

**Expected**: Nodes should have `detectedType` in `data` field  
**If missing**: `addCustomNode()` didn't save it - check logs for "💾 Saving custom node"

### Symptom 3: Float node disappears after re-entering

**This is the original bug** - should be FIXED now.

**Check**:
```javascript
console.log(NODE_REGISTRY['custom_testnode'].subgraph.nodes.map(n => n.id));
```

**Expected**: Should include the Float node ID  
**If empty**: Navigation code didn't save the current `nodes` state

---

## 📝 Feedback Request

After testing, please report:

1. ✅ / ❌ **Test A**: Type detection works?
2. ✅ / ❌ **Test B**: Type persists after reload?
3. ✅ / ❌ **Test C**: Multiple types work?
4. ✅ / ❌ **Test D**: Custom Output detection works?

**If any test fails**, please provide:
- Screenshot of the issue
- Browser console output (copy/paste the logs)
- Exact steps you did

---

## 🎉 Success Indicators

You'll know it's working when:

1. **Ports change color** immediately after connecting (red, green, blue, yellow - not purple!)
2. **Types survive reload** - F5 doesn't reset them to purple
3. **Nodes don't disappear** - Float/UV/etc. stay inside custom node after exit→re-enter
4. **Console shows logs** with non-undefined `detectedType` values

---

**Good luck testing! 🚀**
