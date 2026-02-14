import { describe, it, expect } from 'vitest';
import type { DataType, PortDefinition, ShaderNodeDefinition } from './types';

describe('types', () => {
  describe('DataType', () => {
    it('should accept valid DataType values', () => {
      const validTypes: DataType[] = ['float', 'vec2', 'vec3', 'vec4'];
      
      validTypes.forEach(type => {
        const port: PortDefinition = {
          id: 'test',
          label: 'Test',
          type: type
        };
        expect(port.type).toBe(type);
      });
    });
  });

  describe('PortDefinition', () => {
    it('should create a valid port definition', () => {
      const port: PortDefinition = {
        id: 'test-port',
        label: 'Test Port',
        type: 'vec3'
      };

      expect(port.id).toBe('test-port');
      expect(port.label).toBe('Test Port');
      expect(port.type).toBe('vec3');
    });

    it('should handle different data types', () => {
      const floatPort: PortDefinition = {
        id: 'float-port',
        label: 'Float',
        type: 'float'
      };

      const vec4Port: PortDefinition = {
        id: 'vec4-port',
        label: 'Vec4',
        type: 'vec4'
      };

      expect(floatPort.type).toBe('float');
      expect(vec4Port.type).toBe('vec4');
    });
  });

  describe('ShaderNodeDefinition', () => {
    it('should create a valid node definition', () => {
      const nodeDef: ShaderNodeDefinition = {
        id: 'test-node',
        label: 'Test Node',
        inputs: [
          { id: 'in1', label: 'Input 1', type: 'float' }
        ],
        outputs: [
          { id: 'out1', label: 'Output 1', type: 'vec3' }
        ],
        glslTemplate: (inputs) => `vec3(${inputs.in1})`
      };

      expect(nodeDef.id).toBe('test-node');
      expect(nodeDef.label).toBe('Test Node');
      expect(nodeDef.inputs).toHaveLength(1);
      expect(nodeDef.outputs).toHaveLength(1);
      expect(typeof nodeDef.glslTemplate).toBe('function');
    });

    it('should handle node with no inputs', () => {
      const nodeDef: ShaderNodeDefinition = {
        id: 'source-node',
        label: 'Source',
        inputs: [],
        outputs: [
          { id: 'value', label: 'Value', type: 'float' }
        ],
        glslTemplate: () => '1.0'
      };

      expect(nodeDef.inputs).toHaveLength(0);
      expect(nodeDef.outputs).toHaveLength(1);
    });

    it('should handle node with no outputs', () => {
      const nodeDef: ShaderNodeDefinition = {
        id: 'sink-node',
        label: 'Sink',
        inputs: [
          { id: 'value', label: 'Value', type: 'vec3' }
        ],
        outputs: [],
        glslTemplate: (inputs) => `${inputs.value}`
      };

      expect(nodeDef.inputs).toHaveLength(1);
      expect(nodeDef.outputs).toHaveLength(0);
    });

    it('should handle optional description field', () => {
      const nodeWithDesc: ShaderNodeDefinition = {
        id: 'test',
        label: 'Test',
        inputs: [],
        outputs: [],
        description: 'This is a test node',
        glslTemplate: () => ''
      };

      const nodeWithoutDesc: ShaderNodeDefinition = {
        id: 'test2',
        label: 'Test 2',
        inputs: [],
        outputs: [],
        glslTemplate: () => ''
      };

      expect(nodeWithDesc.description).toBe('This is a test node');
      expect(nodeWithoutDesc.description).toBeUndefined();
    });

    it('should handle compact flag', () => {
      const compactNode: ShaderNodeDefinition = {
        id: 'compact',
        label: 'Compact',
        inputs: [],
        outputs: [],
        compact: true,
        glslTemplate: () => ''
      };

      expect(compactNode.compact).toBe(true);
    });

    it('should handle controls configuration', () => {
      const nodeWithFloat: ShaderNodeDefinition = {
        id: 'float-control',
        label: 'Float',
        inputs: [],
        outputs: [{ id: 'value', label: 'Value', type: 'float' }],
        controls: {
          type: 'float',
          defaultValue: 0.5,
          min: 0.0,
          max: 1.0,
          step: 0.01
        },
        glslTemplate: () => '0.5'
      };

      const nodeWithColor: ShaderNodeDefinition = {
        id: 'color-control',
        label: 'Color',
        inputs: [],
        outputs: [{ id: 'color', label: 'Color', type: 'vec3' }],
        controls: {
          type: 'color',
          defaultValue: '#ff0000'
        },
        glslTemplate: () => 'vec3(1.0, 0.0, 0.0)'
      };

      expect(nodeWithFloat.controls?.type).toBe('float');
      expect(nodeWithFloat.controls?.min).toBe(0.0);
      expect(nodeWithFloat.controls?.max).toBe(1.0);
      expect(nodeWithColor.controls?.type).toBe('color');
    });

    it('should execute glslTemplate function', () => {
      const addNode: ShaderNodeDefinition = {
        id: 'add',
        label: 'Add',
        inputs: [
          { id: 'a', label: 'A', type: 'float' },
          { id: 'b', label: 'B', type: 'float' }
        ],
        outputs: [
          { id: 'result', label: 'Result', type: 'float' }
        ],
        glslTemplate: (inputs) => `(${inputs.a} + ${inputs.b})`
      };

      const result = addNode.glslTemplate({ a: '1.0', b: '2.0' });
      expect(result).toBe('(1.0 + 2.0)');
    });

    it('should handle glslTemplate with data parameter', () => {
      const paramNode: ShaderNodeDefinition = {
        id: 'param',
        label: 'Parameter',
        inputs: [],
        outputs: [
          { id: 'value', label: 'Value', type: 'float' }
        ],
        controls: {
          type: 'float',
          defaultValue: 0.5
        },
        glslTemplate: (_inputs, data) => `${data?.value ?? 0.5}`
      };

      expect(paramNode.glslTemplate({}, { value: 0.8 })).toBe('0.8');
      expect(paramNode.glslTemplate({}, {})).toBe('0.5');
    });

    it('should handle multiple inputs and outputs', () => {
      const mixNode: ShaderNodeDefinition = {
        id: 'mix',
        label: 'Mix',
        inputs: [
          { id: 'a', label: 'A', type: 'vec3' },
          { id: 'b', label: 'B', type: 'vec3' },
          { id: 't', label: 'T', type: 'float' }
        ],
        outputs: [
          { id: 'result', label: 'Result', type: 'vec3' }
        ],
        glslTemplate: (inputs) => `mix(${inputs.a}, ${inputs.b}, ${inputs.t})`
      };

      expect(mixNode.inputs).toHaveLength(3);
      expect(mixNode.outputs).toHaveLength(1);
      
      const code = mixNode.glslTemplate({
        a: 'vec3(1.0)',
        b: 'vec3(0.0)',
        t: '0.5'
      });
      expect(code).toBe('mix(vec3(1.0), vec3(0.0), 0.5)');
    });
  });
});
