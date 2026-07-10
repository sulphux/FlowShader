// src/tests/compiler.glsl.test.ts
// Testy kompilatora GLSL - URUCHOM BEZ APLIKACJI!
//
// Komenda: npm test compiler.glsl.test
//
// Te testy weryfikują że:
// 1. Shader ma tylko jeden precision/uniform/main
// 2. Subgraphs nie duplikują boilerplate
// 3. Custom nodes kompilują się poprawnie
// 4. Zagnieżdżone custom nodes działają

import { describe, it, expect } from 'vitest';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { NODE_REGISTRY } from '../nodes';
import type { CustomNodeDefinition } from '../core/customNodeManager';

describe('GLSL Compiler - Custom Nodes Fix', () => {
  
  describe('PRIORITY 1: Shader Boilerplate (uniforms, precision)', () => {
    
    it('should have exactly ONE precision directive', () => {
      const nodes: GraphNode[] = [
        {
          id: 'uv1',
          type: 'shaderNode',
          data: { definition: NODE_REGISTRY['uv'] }
        },
        {
          id: 'out1',
          type: 'shaderNode',
          data: { definition: NODE_REGISTRY['output'] }
        }
      ];
      
      const edges = [
        { source: 'uv1', target: 'out1', sourceHandle: 'out', targetHandle: 'color' }
      ];
      
      const glsl = compileGraphToGLSL(nodes, edges);
      
      const precisionCount = (glsl.match(/precision mediump float/g) || []).length;
      
      expect(precisionCount).toBe(1);
      if (precisionCount !== 1) {
        console.error('❌ Found', precisionCount, 'precision directives (expected 1)');
        console.error('Generated GLSL:', glsl);
      }
    });
    
    it('should have exactly ONE uniform float iTime', () => {
      const nodes: GraphNode[] = [
        { id: 'time1', type: 'shaderNode', data: { definition: NODE_REGISTRY['time'] } },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } }
      ];
      
      const edges = [
        { source: 'time1', target: 'out1', sourceHandle: 'out', targetHandle: 'color' }
      ];
      
      const glsl = compileGraphToGLSL(nodes, edges);
      const uniformTimeCount = (glsl.match(/uniform float iTime/g) || []).length;
      
      expect(uniformTimeCount).toBe(1);
    });
    
    it('should have exactly ONE uniform vec2 iResolution', () => {
      const nodes: GraphNode[] = [
        { id: 'uv1', type: 'shaderNode', data: { definition: NODE_REGISTRY['uv'] } },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } }
      ];
      
      const edges = [
        { source: 'uv1', target: 'out1', sourceHandle: 'out', targetHandle: 'color' }
      ];
      
      const glsl = compileGraphToGLSL(nodes, edges);
      const uniformResCount = (glsl.match(/uniform vec2 iResolution/g) || []).length;
      
      expect(uniformResCount).toBe(1);
    });
    
    it('should have exactly ONE void main() function', () => {
      const nodes: GraphNode[] = [
        { id: 'uv1', type: 'shaderNode', data: { definition: NODE_REGISTRY['uv'] } },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } }
      ];
      
      const edges = [
        { source: 'uv1', target: 'out1', sourceHandle: 'out', targetHandle: 'color' }
      ];
      
      const glsl = compileGraphToGLSL(nodes, edges);
      const mainCount = (glsl.match(/void main\(\)/g) || []).length;
      
      expect(mainCount).toBe(1);
    });
    
    it('should have exactly ONE palette() function', () => {
      const nodes: GraphNode[] = [
        { id: 'uv1', type: 'shaderNode', data: { definition: NODE_REGISTRY['uv'] } },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } }
      ];
      
      const edges = [
        { source: 'uv1', target: 'out1', sourceHandle: 'out', targetHandle: 'color' }
      ];
      
      const glsl = compileGraphToGLSL(nodes, edges);
      const paletteCount = (glsl.match(/vec3 palette\s*\(/g) || []).length;
      
      expect(paletteCount).toBe(1);
    });
  });
  
  describe('PRIORITY 2: Subgraph Compilation', () => {
    
    it('should return ONLY mainBody when isSubgraph=true', () => {
      const nodes: GraphNode[] = [
        { id: 'uv1', type: 'shaderNode', data: { definition: NODE_REGISTRY['uv'] } }
      ];
      
      const edges = [];
      
      // Call with isSubgraph = true
      const glsl = compileGraphToGLSL(nodes, edges, undefined, true);
      
      // Should NOT contain any boilerplate
      expect(glsl).not.toContain('precision mediump float');
      expect(glsl).not.toContain('uniform float iTime');
      expect(glsl).not.toContain('uniform vec2 iResolution');
      expect(glsl).not.toContain('vec3 palette');
      expect(glsl).not.toContain('void main()');
      expect(glsl).not.toContain('gl_FragColor');
      
      // Should only contain variable declarations
      expect(glsl).toMatch(/vec\d+\s+var_\w+\s*=/);
    });
    
    it('should return full shader when isSubgraph=false (default)', () => {
      const nodes: GraphNode[] = [
        { id: 'uv1', type: 'shaderNode', data: { definition: NODE_REGISTRY['uv'] } },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } }
      ];
      
      const edges = [
        { source: 'uv1', target: 'out1', sourceHandle: 'out', targetHandle: 'color' }
      ];
      
      const glsl = compileGraphToGLSL(nodes, edges);
      
      // MUST contain boilerplate
      expect(glsl).toContain('precision mediump float');
      expect(glsl).toContain('uniform float iTime');
      expect(glsl).toContain('uniform vec2 iResolution');
      expect(glsl).toContain('vec3 palette');
      expect(glsl).toContain('void main()');
    });
  });
  
  describe('PRIORITY 3: Custom Node Compilation', () => {
    
    it('should compile simple custom node without duplicating uniforms', () => {
      // Create a simple custom node
      const customNode: CustomNodeDefinition = {
        id: 'custom_simple',
        label: 'Simple Custom',
        description: 'Test',
        compact: false,
        isCustom: true,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        subgraph: {
          nodes: [
            {
              id: 'custom_input_1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: { definition: NODE_REGISTRY['custom_input'], value: 'Input' }
            },
            {
              id: 'custom_output_1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: { definition: NODE_REGISTRY['custom_output'], value: 'Output' }
            }
          ],
          edges: [
            { source: 'custom_input_1', target: 'custom_output_1', sourceHandle: 'out', targetHandle: 'in' }
          ]
        },
        glslTemplate: () => 'vec3(1.0)'
      };
      
      // Use custom node in main graph
      const nodes: GraphNode[] = [
        { id: 'custom1', type: 'shaderNode', data: { definition: customNode } },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } }
      ];
      
      const edges = [
        { source: 'custom1', target: 'out1', sourceHandle: 'out', targetHandle: 'color' }
      ];
      
      const glsl = compileGraphToGLSL(nodes, edges);
      
      // CRITICAL: Each should appear EXACTLY ONCE
      const precisionCount = (glsl.match(/precision mediump float/g) || []).length;
      const uniformTimeCount = (glsl.match(/uniform float iTime/g) || []).length;
      const uniformResCount = (glsl.match(/uniform vec2 iResolution/g) || []).length;
      const paletteCount = (glsl.match(/vec3 palette/g) || []).length;
      const mainCount = (glsl.match(/void main\(\)/g) || []).length;
      
      expect(precisionCount).toBe(1);
      expect(uniformTimeCount).toBe(1);
      expect(uniformResCount).toBe(1);
      expect(paletteCount).toBe(1);
      expect(mainCount).toBe(1);
      
      if (precisionCount !== 1 || uniformTimeCount !== 1 || mainCount !== 1) {
        console.error('❌ CRITICAL: Boilerplate duplication detected!');
        console.error('precision:', precisionCount, 'uniform iTime:', uniformTimeCount, 'main():', mainCount);
        console.error('\nGenerated GLSL:\n', glsl);
      }
    });
    
    it('should include custom node comment marker', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_marker_test',
        label: 'Marker Test Node',
        description: 'Test',
        compact: false,
        isCustom: true,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        subgraph: {
          nodes: [
            { id: 'input1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_input'] } },
            { id: 'output1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_output'] } }
          ],
          edges: [
            { source: 'input1', target: 'output1', sourceHandle: 'out', targetHandle: 'in' }
          ]
        },
        glslTemplate: () => 'vec3(1.0)'
      };
      
      const nodes: GraphNode[] = [
        { id: 'custom1', type: 'shaderNode', data: { definition: customNode } },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } }
      ];
      
      const edges = [
        { source: 'custom1', target: 'out1', sourceHandle: 'out', targetHandle: 'color' }
      ];
      
      const glsl = compileGraphToGLSL(nodes, edges);
      
      // Function-based compilation: check for function declaration instead of inline comment
      expect(glsl).toContain('custom_marker_test(');
    });
  });
  
  describe('PRIORITY 4: Nested Custom Nodes (3 levels)', () => {
    
    it('should handle 3-level nested custom nodes without duplication', () => {
      // Level 3 (innermost)
      const customNodeC: CustomNodeDefinition = {
        id: 'custom_c',
        label: 'C',
        description: 'Level 3',
        compact: false,
        isCustom: true,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        subgraph: {
          nodes: [
            { id: 'input_c', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_input'] } },
            { id: 'output_c', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_output'] } }
          ],
          edges: [{ source: 'input_c', target: 'output_c', sourceHandle: 'out', targetHandle: 'in' }]
        },
        glslTemplate: () => 'vec3(1.0)'
      };
      
      // Level 2 (middle) - contains C
      const customNodeB: CustomNodeDefinition = {
        id: 'custom_b',
        label: 'B',
        description: 'Level 2',
        compact: false,
        isCustom: true,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        subgraph: {
          nodes: [
            { id: 'input_b', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_input'] } },
            { id: 'custom_c_inst', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: customNodeC } },
            { id: 'output_b', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_output'] } }
          ],
          edges: [
            { source: 'input_b', target: 'custom_c_inst' },
            { source: 'custom_c_inst', target: 'output_b', sourceHandle: 'out', targetHandle: 'in' }
          ]
        },
        glslTemplate: () => 'vec3(1.0)'
      };
      
      // Level 1 (outer) - contains B (which contains C)
      const customNodeA: CustomNodeDefinition = {
        id: 'custom_a',
        label: 'A',
        description: 'Level 1',
        compact: false,
        isCustom: true,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        subgraph: {
          nodes: [
            { id: 'input_a', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_input'] } },
            { id: 'custom_b_inst', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: customNodeB } },
            { id: 'output_a', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_output'] } }
          ],
          edges: [
            { source: 'input_a', target: 'custom_b_inst' },
            { source: 'custom_b_inst', target: 'output_a', sourceHandle: 'out', targetHandle: 'in' }
          ]
        },
        glslTemplate: () => 'vec3(1.0)'
      };
      
      // Main graph - uses A (which contains B which contains C)
      const nodes: GraphNode[] = [
        { id: 'custom_a_inst', type: 'shaderNode', data: { definition: customNodeA } },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } }
      ];
      
      const edges = [
        { source: 'custom_a_inst', target: 'out1', sourceHandle: 'out', targetHandle: 'color' }
      ];
      
      const glsl = compileGraphToGLSL(nodes, edges);
      
      // CRITICAL: Should have EXACTLY one of each boilerplate
      const precisionCount = (glsl.match(/precision mediump float/g) || []).length;
      const uniformTimeCount = (glsl.match(/uniform float iTime/g) || []).length;
      const uniformResCount = (glsl.match(/uniform vec2 iResolution/g) || []).length;
      const paletteCount = (glsl.match(/vec3 palette/g) || []).length;
      const mainCount = (glsl.match(/void main\(\)/g) || []).length;
      
      expect(precisionCount).toBe(1);
      expect(uniformTimeCount).toBe(1);
      expect(uniformResCount).toBe(1);
      expect(paletteCount).toBe(1);
      expect(mainCount).toBe(1);
      
      // Function-based compilation: check for function declarations instead of inline comments
      expect(glsl).toContain('custom_a(');
      expect(glsl).toContain('custom_b(');
      expect(glsl).toContain('custom_c(');
      
      if (precisionCount !== 1 || uniformTimeCount !== 1 || mainCount !== 1) {
        console.error('❌ CRITICAL: Nested custom nodes cause duplication!');
        console.error('This means the compiler is NOT passing isSubgraph=true correctly');
        console.error('precision:', precisionCount, 'uniform:', uniformTimeCount, 'main:', mainCount);
      }
    });
  });
  
  describe('CRITICAL: Syntax Validation', () => {
    
    it('should NOT have "uniform" keyword inside void main()', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_syntax_test',
        label: 'Syntax Test',
        description: 'Test',
        compact: false,
        isCustom: true,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        subgraph: {
          nodes: [
            { id: 'input1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_input'] } },
            { id: 'output1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_output'] } }
          ],
          edges: [{ source: 'input1', target: 'output1', sourceHandle: 'out', targetHandle: 'in' }]
        },
        glslTemplate: () => 'vec3(1.0)'
      };
      
      const nodes: GraphNode[] = [
        { id: 'custom1', type: 'shaderNode', data: { definition: customNode } },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } }
      ];
      
      const edges = [
        { source: 'custom1', target: 'out1', sourceHandle: 'out', targetHandle: 'color' }
      ];
      
      const glsl = compileGraphToGLSL(nodes, edges);
      
      // Extract content inside void main()
      const mainMatch = glsl.match(/void main\(\)\s*{([\s\S]*)$/);
      expect(mainMatch).toBeTruthy();
      
      const mainBody = mainMatch![1];
      
      // Critical checks - inside main() should NOT contain:
      const hasUniformInside = mainBody.includes('uniform float iTime') || mainBody.includes('uniform vec2 iResolution');
      const hasPrecisionInside = mainBody.includes('precision mediump float');
      const hasNestedMain = mainBody.match(/void main\s*\(/);
      const hasNestedPalette = mainBody.match(/vec3 palette\s*\(/);
      
      if (hasUniformInside) {
        console.error('❌ CRITICAL: Found "uniform" inside void main()!');
        console.error('This will cause: ERROR: uniform only allowed at global scope');
        console.error('\nInside main():\n', mainBody.substring(0, 500));
      }
      
      expect(hasUniformInside).toBe(false);
      expect(hasPrecisionInside).toBe(false);
      expect(hasNestedMain).toBeFalsy();
      expect(hasNestedPalette).toBeFalsy();
    });
    
    it('should produce valid GLSL structure', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_valid',
        label: 'Valid',
        description: 'Test',
        compact: false,
        isCustom: true,
        inputs: [],
        outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
        subgraph: {
          nodes: [
            { id: 'input1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_input'] } },
            { id: 'output1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_output'] } }
          ],
          edges: [{ source: 'input1', target: 'output1', sourceHandle: 'out', targetHandle: 'in' }]
        },
        glslTemplate: () => 'vec3(1.0)'
      };
      
      const nodes: GraphNode[] = [
        { id: 'custom1', type: 'shaderNode', data: { definition: customNode } },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } }
      ];
      
      const edges = [
        { source: 'custom1', target: 'out1', sourceHandle: 'out', targetHandle: 'color' }
      ];
      
      const glsl = compileGraphToGLSL(nodes, edges);
      
      // Verify correct order (top to bottom):
      const precisionIndex = glsl.indexOf('precision mediump float');
      const uniformTimeIndex = glsl.indexOf('uniform float iTime');
      const uniformResIndex = glsl.indexOf('uniform vec2 iResolution');
      const paletteIndex = glsl.indexOf('vec3 palette');
      const mainIndex = glsl.indexOf('void main()');
      
      expect(precisionIndex).toBeGreaterThan(-1);
      expect(uniformTimeIndex).toBeGreaterThan(precisionIndex);
      expect(uniformResIndex).toBeGreaterThan(uniformTimeIndex);
      expect(paletteIndex).toBeGreaterThan(uniformResIndex);
      expect(mainIndex).toBeGreaterThan(paletteIndex);
    });
  });
  
  describe('PRIORITY 5: AI regression cases', () => {
    it('should cast vec3 custom output to float when parent output expects float', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_vec3_to_float',
        label: 'Vec3 to Float',
        description: 'AI regression cast test',
        compact: false,
        isCustom: true,
        inputs: [{ id: 'input_1', label: 'Input', type: 'vec3' }],
        outputs: [{ id: 'output_1', label: 'Output', type: 'float' }],
        subgraph: {
          nodes: [
            {
              id: 'custom_input_1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: {
                definition: {
                  ...NODE_REGISTRY['custom_input'],
                  outputs: [{ id: 'out', type: 'vec3', label: 'Value' }],
                },
                detectedType: 'vec3',
              },
            },
            {
              id: 'custom_output_1',
              type: 'shaderNode',
              position: { x: 200, y: 0 },
              data: {
                definition: {
                  ...NODE_REGISTRY['custom_output'],
                  inputs: [{ id: 'in', type: 'float', label: 'Value' }],
                },
                detectedType: 'float',
              },
            },
          ],
          edges: [
            { source: 'custom_input_1', target: 'custom_output_1', sourceHandle: 'out', targetHandle: 'in' },
          ],
        },
        glslTemplate: () => '0.0',
      };

      const nodes: GraphNode[] = [
        { id: 'uv1', type: 'shaderNode', data: { definition: NODE_REGISTRY['uv'] } },
        { id: 'custom1', type: 'shaderNode', data: { definition: customNode } },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
      ];

      const edges = [
        { source: 'uv1', target: 'custom1', sourceHandle: 'out', targetHandle: 'input_1' },
        { source: 'custom1', target: 'out1', sourceHandle: 'output_1', targetHandle: 'color' },
      ];

      const glsl = compileGraphToGLSL(nodes, edges);

      expect(glsl).toContain('float custom_vec3_to_float(vec3 input_1)');
      expect(glsl).toContain('float var_custom_output_1 = (custom_input_1).x;');
      expect(glsl).not.toMatch(/float\s+var_custom_output_1\s*=\s*custom_input_1\s*;/);
    });

    it('should sanitize hyphenated custom input ids in generated function signatures and calls', () => {
      const customNode: CustomNodeDefinition = {
        id: 'custom_hyphen_case',
        label: 'Hyphen Case',
        description: 'AI regression identifier test',
        compact: false,
        isCustom: true,
        inputs: [{ id: 'input-port', label: 'Input', type: 'float' }],
        outputs: [{ id: 'output-port', label: 'Output', type: 'float' }],
        subgraph: {
          nodes: [
            {
              id: 'custom-input-1',
              type: 'shaderNode',
              position: { x: 0, y: 0 },
              data: {
                definition: {
                  ...NODE_REGISTRY['custom_input'],
                  outputs: [{ id: 'out', type: 'float', label: 'Value' }],
                },
                detectedType: 'float',
              },
            },
            {
              id: 'custom-output-1',
              type: 'shaderNode',
              position: { x: 200, y: 0 },
              data: {
                definition: {
                  ...NODE_REGISTRY['custom_output'],
                  inputs: [{ id: 'in', type: 'float', label: 'Value' }],
                },
                detectedType: 'float',
              },
            },
          ],
          edges: [
            { source: 'custom-input-1', target: 'custom-output-1', sourceHandle: 'out', targetHandle: 'in' },
          ],
        },
        glslTemplate: () => '0.0',
      };

      const nodes: GraphNode[] = [
        { id: 'float1', type: 'shaderNode', data: { definition: NODE_REGISTRY['param_float'], value: 0.5 } },
        { id: 'custom1', type: 'shaderNode', data: { definition: customNode } },
        { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
      ];

      const edges = [
        { source: 'float1', target: 'custom1', sourceHandle: 'value', targetHandle: 'input-port' },
        { source: 'custom1', target: 'out1', sourceHandle: 'output-port', targetHandle: 'color' },
      ];

      const glsl = compileGraphToGLSL(nodes, edges);

      expect(glsl).toContain('float custom_hyphen_case(float input_port)');
      expect(glsl).toContain('float var_custom_output_1 = custom_input_1;');
      expect(glsl).not.toContain('custom-input-1');
      expect(glsl).not.toContain('custom-output-1');
    });
  });
});

// Export for worker
export { };
