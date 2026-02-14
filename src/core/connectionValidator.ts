import type { DataType } from './types';

export interface ConnectionValidationResult {
  valid: boolean;
  reason?: string;
  requiresSplit?: boolean;
}

/**
 * Validates if a connection between two port types is allowed.
 * 
 * Rules:
 * 1. Same types always connect: float→float, vec2→vec2, etc.
 * 2. float can connect to any vector type (will be expanded)
 * 3. Vectors CANNOT directly connect to float (requires explicit Split node)
 * 4. Vectors CANNOT connect to different vector types (no implicit casting)
 * 5. 'auto' type accepts ANY connection and adapts dynamically
 * 
 * This enforces explicit conversions like in Unreal Engine.
 */
export function validateConnection(
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

  // Rule 2: float → vector is allowed (expansion)
  if (sourceType === 'float' && ['vec2', 'vec3', 'vec4'].includes(targetType)) {
    return { valid: true };
  }

  // Rule 3: vector → float requires Split node (BLOCKED)
  if (['vec2', 'vec3', 'vec4'].includes(sourceType) && targetType === 'float') {
    return {
      valid: false,
      reason: `Cannot connect ${sourceType} to float directly. Use Split node to extract components.`,
      requiresSplit: true
    };
  }

  // Rule 4: Different vector types cannot connect (BLOCKED)
  if (['vec2', 'vec3', 'vec4'].includes(sourceType) && ['vec2', 'vec3', 'vec4'].includes(targetType)) {
    return {
      valid: false,
      reason: `Cannot connect ${sourceType} to ${targetType}. Use Split and Combine nodes for explicit conversion.`,
      requiresSplit: false
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
 */
export function isValidConnection(sourceType: DataType, targetType: DataType): boolean {
  return validateConnection(sourceType, targetType).valid;
}

/**
 * Get all valid target types for a given source type
 */
export function getValidTargetTypes(sourceType: DataType): DataType[] {
  // 'auto' can connect to anything
  if (sourceType === 'auto') {
    return ['float', 'vec2', 'vec3', 'vec4', 'auto'];
  }

  const allTypes: DataType[] = ['float', 'vec2', 'vec3', 'vec4', 'auto'];
  return allTypes.filter(targetType => isValidConnection(sourceType, targetType));
}

/**
 * Check if swizzling is allowed (accessing .x, .y, .z, .w on vectors)
 */
export function isValidSwizzle(sourceType: DataType, component: string): boolean {
  const validComponents: Record<DataType, string[]> = {
    'float': [], // float has no components
    'vec2': ['x', 'y', 'r', 'g'],
    'vec3': ['x', 'y', 'z', 'r', 'g', 'b'],
    'vec4': ['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a']
  };

  return validComponents[sourceType]?.includes(component) ?? false;
}
