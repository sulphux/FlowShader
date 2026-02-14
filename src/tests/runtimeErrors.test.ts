import { describe, it, expect } from 'vitest';
import { compileGraphToGLSL } from '../core/compiler';
import type { GraphNode } from '../core/compiler';
import { NODE_REGISTRY } from '../nodes';

describe('Runtime Error Prevention', () => {
  it('should handle nodes with missing definitions gracefully', () => {
    const nodes: GraphNode[] = [
      {
        id: 'output-1',
        type: 'output',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { definition: null as any } // Broken node
      }
    ];

    // Compiler will skip nodes with null definitions
    // Should not throw - def check: if (!def) return;
    const result = compileGraphToGLSL(nodes, []);
    expect(result).toBeTruthy();
  });

  it('should handle missing edge source/target', () => {
    const nodes: GraphNode[] = [
      {
        id: 'output-1',
        type: 'output',
        data: { definition: NODE_REGISTRY.output }
      }
    ];
    
    const edges = [
      {
        source: 'missing-node',
        target: 'output-1',
        sourceHandle: 'out',
        targetHandle: 'color'
      }
    ];

    // Should handle gracefully - edge to missing node is skipped
    expect(() => {
      compileGraphToGLSL(nodes, edges);
    }).not.toThrow();
  });

  it('should handle empty graph without crash', () => {
    const nodes: GraphNode[] = [];
    const edges: never[] = [];

    expect(() => {
      compileGraphToGLSL(nodes, edges);
    }).not.toThrow();
  });
});
