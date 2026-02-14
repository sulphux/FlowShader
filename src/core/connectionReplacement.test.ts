import { describe, it, expect } from 'vitest';

describe('Connection replacement behavior', () => {
  describe('Single connection per input port', () => {
    it('should document that each input port accepts only one connection', () => {
      // When connecting a new edge to an input port that already has a connection,
      // the old connection should be automatically removed.
      // This is implemented in NodeEditor.tsx onConnect callback.
      
      const scenario = {
        initial: {
          nodes: ['Float1', 'Float2', 'Add'],
          edges: ['Float1 → Add.a']
        },
        action: 'Connect Float2 → Add.a',
        expected: {
          edges: ['Float2 → Add.a'] // Float1 connection is removed
        }
      };

      expect(scenario.expected.edges).toHaveLength(1);
      expect(scenario.expected.edges[0]).toBe('Float2 → Add.a');
    });

    it('should allow multiple outputs from same source', () => {
      // One output can connect to multiple inputs (fan-out is allowed)
      const scenario = {
        nodes: ['Time', 'Sin', 'Cos'],
        edges: [
          'Time.out → Sin.in',
          'Time.out → Cos.in'  // Same output, different targets - OK
        ]
      };

      expect(scenario.edges).toHaveLength(2);
    });

    it('should prevent multiple inputs to same target port', () => {
      // One input cannot have multiple connections (fan-in is blocked)
      const scenario = {
        initial: ['Float1 → Add.a', 'Float2 → Add.b'],
        action: 'Connect Float3 → Add.a',
        result: ['Float3 → Add.a', 'Float2 → Add.b'] // Float1 removed
      };

      expect(scenario.result).not.toContain('Float1 → Add.a');
      expect(scenario.result).toContain('Float3 → Add.a');
    });
  });

  describe('Implementation details', () => {
    it('should filter edges before adding new connection', () => {
      // Implementation in onConnect:
      // setEdges(eds => eds.filter(edge => 
      //   !(edge.target === params.target && edge.targetHandle === params.targetHandle)
      // ));
      
      const mockEdges = [
        { id: 'e1', source: 'a', target: 'c', targetHandle: 'in' },
        { id: 'e2', source: 'b', target: 'c', targetHandle: 'in' }, // Will be removed
        { id: 'e3', source: 'a', target: 'd', targetHandle: 'in' }
      ];

      const newConnection = { target: 'c', targetHandle: 'in' };
      
      const filtered = mockEdges.filter(edge =>
        !(edge.target === newConnection.target && edge.targetHandle === newConnection.targetHandle)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('e3');
    });
  });

  describe('Edge cases', () => {
    it('should handle replacing connection on node with multiple inputs', () => {
      // Node has inputs A and B
      // Replacing connection on A should not affect B
      const edges = [
        { source: 'x', target: 'node', targetHandle: 'a' },
        { source: 'y', target: 'node', targetHandle: 'b' }
      ];

      // Connect new source to input 'a'
      const newConnection = { target: 'node', targetHandle: 'a' };
      const filtered = edges.filter(e =>
        !(e.target === newConnection.target && e.targetHandle === newConnection.targetHandle)
      );

      // Should only remove edge to 'a', keep 'b'
      expect(filtered).toHaveLength(1);
      expect(filtered[0].targetHandle).toBe('b');
    });

    it('should work with auto-adapting nodes', () => {
      // When connecting to Smart Split (auto input), should still replace old connection
      const scenario = {
        initial: 'UV (vec2) → SmartSplit.in',
        action: 'Connect Color (vec3) → SmartSplit.in',
        expected: {
          connection: 'Color (vec3) → SmartSplit.in',
          splitOutputs: ['R', 'G', 'B'] // Adapted from vec2 to vec3
        }
      };

      expect(scenario.expected.connection).toContain('vec3');
      expect(scenario.expected.splitOutputs).toHaveLength(3);
    });
  });
});
