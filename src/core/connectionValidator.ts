import type { DataType } from './types';

export interface ConnectionValidationResult {
  valid: boolean;
  reason?: string;
  requiresSplit?: boolean;
  requiresAdapter?: boolean;  // NEW - triggers Auto-Adapter System
}

/**
 * Parse multi-type string (e.g., "float|vec3") into array of types
 */
function parseMultiType(typeString: string): DataType[] {
  if (typeString.includes('|')) {
    return typeString.split('|') as DataType[];
  }
  return [typeString as DataType];
}

/**
 * Validates if a connection between two port types is allowed.
 * Supports multi-type ports (e.g., "float|vec3" accepts both float and vec3)
 * 
 * Rules (STRICT MODE - Unreal Engine style):
 * 1. Same types always connect: float→float, vec2→vec2, etc.
 * 2. float → vector BLOCKED (triggers Auto-Adapter: inserts Combine node)
 * 3. vector → float BLOCKED (triggers Auto-Adapter: inserts Split node)
 * 4. vector → different vector BLOCKED (triggers Auto-Adapter: inserts Split + Combine)
 * 5. 'auto' type accepts ANY connection and adapts dynamically
 * 6. Multi-type ports (e.g., "float|vec3") accept any of the specified types
 * 
 * This enforces explicit conversions like in Unreal Engine.
 * Auto-Adapter System automatically inserts conversion nodes when requiresAdapter=true.
 */
export function validateConnection(
  sourceType: string,
  targetType: string
): ConnectionValidationResult {
  // Parse multi-type ports
  const sourceTypes = parseMultiType(sourceType);
  const targetTypes = parseMultiType(targetType);

  // Track the last error for better messaging
  let lastError: ConnectionValidationResult = {
    valid: false,
    reason: `Cannot connect ${sourceType} to ${targetType}. No valid type combination found.`
  };

  // Check if any combination of source→target is valid
  for (const src of sourceTypes) {
    for (const tgt of targetTypes) {
      const result = validateSingleConnection(src, tgt);
      if (result.valid) return result;
      lastError = result; // Keep last error for context
    }
  }

  // None of the combinations worked - return the last error
  return lastError;
}

/**
 * Internal validation for single concrete types
 */
function validateSingleConnection(
  sourceType: DataType,
  targetType: DataType
): ConnectionValidationResult {
  // Rule 5: 'auto' type accepts everything
  if (sourceType === 'auto' || targetType === 'auto') {
    return { valid: true };
  }

  // Rule 1: Same types always work
  if (sourceType === targetType) {
    return { valid: true };
  }

  // Rule 2: float → vector BLOCKED (STRICT mode - requires Combine node)
  if (sourceType === 'float' && ['vec2', 'vec3', 'vec4'].includes(targetType)) {
    return {
      valid: false,
      requiresAdapter: true,
      reason: `Cannot connect float to ${targetType} directly. Auto-inserting Combine ${targetType.toUpperCase()} node...`
    };
  }

  // Rule 3: vector → float requires Split node (BLOCKED - triggers Auto-Adapter)
  if (['vec2', 'vec3', 'vec4'].includes(sourceType) && targetType === 'float') {
    return {
      valid: false,
      reason: `Cannot connect ${sourceType} to float directly. Auto-inserting Split ${sourceType.toUpperCase()} node...`,
      requiresSplit: true,
      requiresAdapter: true  // NEW - trigger Auto-Adapter
    };
  }

  // Rule 4: Different vector types cannot connect (BLOCKED - triggers Auto-Adapter)
  if (['vec2', 'vec3', 'vec4'].includes(sourceType) && ['vec2', 'vec3', 'vec4'].includes(targetType)) {
    return {
      valid: false,
      reason: `Cannot connect ${sourceType} to ${targetType} directly. Auto-inserting Split + Combine nodes...`,
      requiresSplit: false,
      requiresAdapter: true  // NEW - trigger Auto-Adapter
    };
  }

  // Fallback: Unknown combination
  return {
    valid: false,
    reason: `Invalid connection: ${sourceType} → ${targetType}`
  };
}

/**
 * Check if connection is valid (simple boolean)
 * Supports multi-type ports
 */
export function isValidConnection(sourceType: string, targetType: string): boolean {
  return validateConnection(sourceType, targetType).valid;
}

/**
 * Get all valid target types for a given source type
 */
export function getValidTargetTypes(sourceType: DataType): DataType[] {
  // 'auto' can connect to anything
  if (sourceType === 'auto') {
    return ['float', 'impulse', 'vec2', 'vec3', 'vec4', 'auto'];
  }

  const allTypes: DataType[] = ['float', 'impulse', 'vec2', 'vec3', 'vec4', 'auto'];
  return allTypes.filter(targetType => isValidConnection(sourceType, targetType));
}

/**
 * Check if swizzling is allowed (accessing .x, .y, .z, .w on vectors)
 */
export function isValidSwizzle(sourceType: DataType | string, component: string): boolean {
  // Multi-type handling
  if (typeof sourceType === 'string' && sourceType.includes('|')) {
    return false; // Can't swizzle multi-type ports
  }

  const validComponents: Record<string, string[]> = {
    'float': [],
    'impulse': [],
    'vec2': ['x', 'y', 'r', 'g'],
    'vec3': ['x', 'y', 'z', 'r', 'g', 'b'],
    'vec4': ['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a'],
    'auto': [] // auto has no swizzling until type is determined
  };

  return validComponents[sourceType]?.includes(component) ?? false;
}
