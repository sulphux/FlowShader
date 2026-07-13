/**
 * `impulse` is an event signal. It is represented as a float in GLSL, but is
 * intentionally a separate graph type so it cannot be mistaken for an
 * ordinary numeric value or silently connected to float inputs.
 */
export type DataType = 'float' | 'impulse' | 'vec2' | 'vec3' | 'vec4' | 'auto';

export interface PortDefinition {
  id: string;
  label: string;
  type: DataType;
}

export interface ShaderNodeDefinition {
  id: string;
  label: string;
  inputs: { id: string; label: string; type: string }[];
  outputs: { id: string; label: string; type: string }[];
  description?: string;
  glslTemplate: (inputs: Record<string, string>, data?: Record<string, unknown>) => string;

  compact?: boolean;

  /**
   * Override typu zmiennej emitowanej przez kompilator (domyślnie typ pierwszego
   * wyjścia). Potrzebne, gdy node ma wiele wyjść float czytanych swizzlem
   * z jednej zmiennej wektorowej (np. audio_input: vec4 → x/y/z/w).
   */
  varType?: DataType;

  controls?: {
    type: 'float' | 'color' | 'text';
    defaultValue: string | number;
    min?: number;
    max?: number;
    step?: number;
  };

  /**
   * Set when this definition is a stand-in for a node type that couldn't be
   * resolved on load (e.g. a custom node saved in a different browser
   * profile, or one that was since deleted from the library). Holds the
   * original definition id so the UI can point at what's actually missing.
   */
  missingOriginalId?: string;
}
