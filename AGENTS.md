# Notes for AI Agents Working on NodeShader

## Manual Testing Limitations

### Problem: "Fire and forget is disabled"

When you try to run `npm run dev` to manually test the app, you'll get:
```
Error: Fire and forget is disabled. Background processes must be enabled 
in settings or with the --allow-background-processes flag.
```

**Why**: Dev servers run indefinitely. Agent can't "fire and forget" processes in background.

### Solution: DON'T try to manually test the app

Instead:

1. **Write comprehensive E2E tests** that simulate user workflows
2. **Code review** - read the implementation carefully
3. **Ask user for specific repro steps** - they can manually test
4. **Add debug logging** - user can check browser console
5. **Use existing test patterns** - follow `customNodeWorkflows.test.tsx`

### When User Reports "It doesn't work"

**DO**:
- ✅ Ask for EXACT reproduction steps
- ✅ Ask what they see (color, text, console errors)
- ✅ Add targeted console.log to suspected code
- ✅ Write E2E test that reproduces the issue
- ✅ Review code flow carefully (data flow, state updates)

**DON'T**:
- ❌ Try to run `npm run dev` (will fail)
- ❌ Assume tests passing = feature works (tests may be wrong)
- ❌ Give up when you can't manually test
- ❌ Make random changes hoping they fix it

### Example: Port Synchronization Bug

**User says**: "Port sync doesn't work - I connect Float → Custom Input, exit, port is still auto"

**Wrong approach**:
```bash
npm run dev  # FAILS - background processes disabled
```

**Right approach**:
1. Ask: "What color do you see on the port? (red=float, purple=auto)"
2. Ask: "Can you check browser console - any errors or logs?"
3. Review code:
   - Where is `detectedType` set? (NodeEditor.tsx line 860)
   - Where is it read? (customNodeManager.ts line 116)
   - Where is port extraction called? (navigateBack line 499)
4. Add debug logging:
   ```typescript
   console.log('🔍 detectedType:', node.data.detectedType);
   ```
5. Write E2E test that simulates EXACT user workflow
6. Commit with note: "User to verify in browser"

### TypeScript Build Errors vs Runtime

**Note**: TypeScript `npm run build` may fail with type errors, but Vitest tests still pass.

This is OK during development. Fix TypeScript errors before production, but don't block on them during debugging.

---

## Port Synchronization Implementation (Current Understanding)

### Flow (should work, but user reports it doesn't):

1. **User connects Float → Custom Input** (inside custom node)
   - `onConnect` triggered (NodeEditor.tsx line 599)
   - Detects sourceType = 'float' (line 846-870)
   - Sets `node.data.detectedType = 'float'` (line 860)
   - Updates node in state ✅

2. **User clicks "Up One Level"**
   - `navigateBack` called (line 485)
   - Calls `extractCustomNodePorts({ nodes })` (line 499)
   - Reads `node.data.detectedType` (customNodeManager.ts line 116)
   - Creates port with type 'float'
   - Saves to custom node definition (line 502-510)
   - Updates NODE_REGISTRY (line 515)
   - Refreshes instances on canvas (line 527-535)

3. **Expected**: Port shows red (float)
4. **User reports**: Port shows purple (auto)

### Possible Root Causes (if user is correct):

**Hypothesis 1**: `nodes` in navigateBack is stale (old state without detectedType)
- Fix: Use `nodes` from state, not from navigationStack

**Hypothesis 2**: Instance refresh doesn't propagate ports correctly
- Fix: Check line 527-535 - does it update `data.definition.inputs`?

**Hypothesis 3**: React doesn't re-render port colors after update
- Fix: Force re-render or check Handle component

**Hypothesis 4**: User is checking wrong thing
- Fix: Ask them to check NODE_REGISTRY in console

### Debug Commands for User

Ask user to run in browser console:
```javascript
// Check if custom node definition has correct ports
console.log(NODE_REGISTRY['custom_testnode'].inputs);
// Should show: [{ id: '...', label: 'Input', type: 'float' }]

// Check if detectedType was set
// (Can't access directly - need to check during connection)
```

---

## When All Else Fails

If you've:
- ✅ Reviewed code thoroughly
- ✅ Added debug logging
- ✅ Written E2E tests (all pass)
- ✅ But user still reports bug

**Do this**:
1. Commit your changes with note: "Code review shows this should work - user to verify"
2. Ask user to test manually and provide:
   - Screenshot before/after
   - Browser console output (with your debug logs)
   - Exact steps they did
3. Based on their feedback, make targeted fix (1-5 lines max)

**Remember**: You can't see the app yourself. Trust the user's feedback, but verify code logic is sound.

---

**Created**: 2026-02-15  
**Last Updated**: 2026-02-15
