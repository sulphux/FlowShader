export type DataType = 'float' | 'vec2' | 'vec3' | 'vec4';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  glslTemplate: (inputs: Record<string, string>, data?: any) => string;
  
  compact?: boolean;
  
  controls?: {
    type: 'float' | 'color' | 'text';
    defaultValue: any;
    min?: number;
    max?: number;
    step?: number;
  };
}