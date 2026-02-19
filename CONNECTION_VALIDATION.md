# Connection Validation System

## Overview

This system implements strict type checking for node connections, similar to Unreal Engine's Blueprint system. It prevents invalid type conversions and requires explicit type conversions through Split and Combine nodes.

## Connection Rules

### ✅ Valid Connections

1. **Same Type Connections** - Always allowed
   - `float → float`
   - `vec2 → vec2`
   - `vec3 → vec3`
   - `vec4 → vec4`

2. **Float Expansion** - Allowed (implicit upcast)
   - `float → vec2` (expands to `vec2(float)`)
   - `float → vec3` (expands to `vec3(float)`)
   - `float → vec4` (expands to `vec4(float, float, float, 1.0)`)

### ❌ Blocked Connections

3. **Vector to Float** - BLOCKED (requires Split node)
   - `vec2 → float` ❌
   - `vec3 → float` ❌
   - `vec4 → float` ❌
   - **Why**: Prevents accidental data loss. Use Split node to explicitly extract components.

4. **Different Vector Types** - BLOCKED (requires Split + Combine)
   - `vec2 → vec3` ❌
   - `vec2 → vec4` ❌
   - `vec3 → vec2` ❌
   - `vec3 → vec4` ❌
   - `vec4 → vec2` ❌
   - `vec4 → vec3` ❌
   - **Why**: No implicit conversions between vector types.

## Usage

### In Code

```typescript
import { validateConnection, isValidConnection } from '@core/connectionValidator';

// Check if connection is valid
const result = validateConnection('vec3', 'float');
console.log(result.valid); // false
console.log(result.reason); // "Cannot connect vec3 to float directly..."
console.log(result.requiresSplit); // true

// Simple boolean check
if (isValidConnection('float', 'vec3')) {
  // Create connection
}
```

### Explicit Type Conversions

To convert between incompatible types:

**Vector → Float:**
```
vec3 → Split Node → float (x component)
```

**Vec2 → Vec3:**
```
vec2 → Split → float (x), float (y)
      ↓
Combine Vec3 ← float (0.0)
```

## Examples

### Valid Workflows

```
Time (float) → Sin (float) ✅
Time (float) → Color Add (vec3) ✅ (auto-expanded)
UV (vec2) → UV Scale (vec2) ✅
```

### Invalid Workflows (Blocked)

```
UV (vec2) → Sin (float) ❌
Use: UV → Split Vec2 → X → Sin

Color (vec3) → Output (vec4) ❌  
Use: Color → Split Vec3 → Combine Vec4 (with alpha)
```

## Testing

Run comprehensive connection tests:

```bash
npm test -- connectionValidator
```

**Test Coverage:**
- ✅ 54 comprehensive tests
- ✅ All 16 type combinations (4x4 matrix)
- ✅ Swizzling validation (.x, .y, .z, .w)
- ✅ Real-world scenarios
- ✅ Edge cases

**Part of the 230-test suite** - all passing!

## Integration

The validator is integrated into `NodeEditor.tsx`:
- Blocks invalid connections with user-friendly error messages
- Suggests using Split nodes when appropriate
- Smart Split node automatically adapts to input type

## Benefits

1. **Type Safety** - Prevents runtime shader compilation errors
2. **Explicit Conversions** - Clear visual representation of data flow
3. **Better UX** - Clear error messages guide users
4. **Consistent Behavior** - Matches industry-standard tools (Unreal Engine)
