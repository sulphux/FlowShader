export type DataType = 'float' | 'vec2' | 'vec3' | 'vec4' | 'auto';

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
  
  controls?: {
    type: 'float' | 'color' | 'text';
    defaultValue: string | number;
    min?: number;
    max?: number;
    step?: number;
  };
}