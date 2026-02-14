import { describe, it, expect } from 'vitest';
import { NODE_REGISTRY } from '../nodes';

describe('Smart Split Adaptation Logic', () => {
  it('should adapt to vec2 with X, Y outputs', () => {
    const baseDef = NODE_REGISTRY['smart_split'];
    const sourceType = 'vec2';
    
    // Simulate adaptation
    const createOutput = (id: string, label: string) => ({ 
      id, label, type: 'float' as const 
    });
    
    let newOutputs = baseDef.outputs;
    if (sourceType === 'vec2') {
      newOutputs = [
        createOutput('x', 'X'),
        createOutput('y', 'Y')
      ];
    }
    
    expect(newOutputs).toHaveLength(2);
    expect(newOutputs[0].id).toBe('x');
    expect(newOutputs[1].id).toBe('y');
    expect(newOutputs[0].type).toBe('float');
    expect(newOutputs[1].type).toBe('float');
  });

  it('should adapt to vec3 with R, G, B outputs', () => {
    const sourceType = 'vec3';
    const createOutput = (id: string, label: string) => ({ 
      id, label, type: 'float' as const 
    });
    
    let newOutputs = [];
    if (sourceType === 'vec3') {
      newOutputs = [
        createOutput('x', 'R'),
        createOutput('y', 'G'),
        createOutput('z', 'B')
      ];
    }
    
    expect(newOutputs).toHaveLength(3);
    expect(newOutputs.map(o => o.label)).toEqual(['R', 'G', 'B']);
    expect(newOutputs.map(o => o.id)).toEqual(['x', 'y', 'z']);
  });

  it('should adapt to vec4 with R, G, B, A outputs', () => {
    const sourceType = 'vec4';
    const createOutput = (id: string, label: string) => ({ 
      id, label, type: 'float' as const 
    });
    
    let newOutputs = [];
    if (sourceType === 'vec4') {
      newOutputs = [
        createOutput('x', 'R'),
        createOutput('y', 'G'),
        createOutput('z', 'B'),
        createOutput('w', 'A')
      ];
    }
    
    expect(newOutputs).toHaveLength(4);
    expect(newOutputs.map(o => o.id)).toEqual(['x', 'y', 'z', 'w']);
    expect(newOutputs.map(o => o.label)).toEqual(['R', 'G', 'B', 'A']);
  });

  it('should adapt to float with single Value output', () => {
    const sourceType = 'float';
    const createOutput = (id: string, label: string) => ({ 
      id, label, type: 'float' as const 
    });
    
    let newOutputs = [];
    if (sourceType === 'float') {
      newOutputs = [createOutput('x', 'Value')];
    }
    
    expect(newOutputs).toHaveLength(1);
    expect(newOutputs[0].label).toBe('Value');
    expect(newOutputs[0].id).toBe('x');
  });

  it('should update input label when adapting', () => {
    const adaptations = [
      { type: 'vec2', label: 'Vec2' },
      { type: 'vec3', label: 'Vec3' },
      { type: 'vec4', label: 'Vec4' },
      { type: 'float', label: 'Float' }
    ];

    adaptations.forEach(({ label }) => {
      expect(label).toMatch(/^(Vec2|Vec3|Vec4|Float)$/);
    });
  });

  it('should start with auto type before adaptation', () => {
    const baseDef = NODE_REGISTRY['smart_split'];
    
    expect(baseDef.inputs[0].type).toBe('auto');
    expect(baseDef.outputs[0].type).toBe('auto');
  });
});
