import { describe, it, expect } from 'vitest';
import { insertAutoAdapter } from './autoAdapterSystem';
import type { Node, Edge } from 'reactflow';
import { NODE_REGISTRY } from '../nodes';

describe('autoAdapterSystem', () => {
  const mockNodes: Node[] = [
    {
      id: 'time-1',
      type: 'shaderNode',
      position: { x: 0, y: 0 },
      data: { definition: NODE_REGISTRY.param_time }
    },
    {
      id: 'color-1',
      type: 'shaderNode',
      position: { x: 400, y: 0 },
      data: { definition: NODE_REGISTRY.param_color }
    }
  ];

  const mockEdges: Edge[] = [];

  describe('insertAutoAdapter - float → vec3 (Combine)', () => {
    it('should insert Combine Vec3 node', () => {
      const result = insertAutoAdapter(
        mockNodes,
        mockEdges,
        { source: 'time-1', sourceHandle: 'value', target: 'color-1', targetHandle: 'color' },
        'float',
        'vec3'
      );

      // Should create 1 new node (Combine Vec3)
      expect(result.newNodes).toHaveLength(1);
      expect(result.newNodes[0].data.definition.id).toBe('combine_vec3');

      // Should create 2 new edges (time→combine, combine→color)
      expect(result.newEdges).toHaveLength(2);
      expect(result.newEdges[0].target).toBe(result.newNodes[0].id);
      expect(result.newEdges[0].targetHandle).toBe('x'); // float → .x input
      expect(result.newEdges[1].source).toBe(result.newNodes[0].id);
    });

    it('should position Combine at midpoint', () => {
      const result = insertAutoAdapter(
        mockNodes,
        mockEdges,
        { source: 'time-1', sourceHandle: 'value', target: 'color-1', targetHandle: 'color' },
        'float',
        'vec3'
      );

      const combineNode = result.newNodes[0];
      expect(combineNode.position.x).toBe(200); // midpoint of 0 and 400
      expect(combineNode.position.y).toBe(0);
    });
  });

  describe('insertAutoAdapter - vec3 → float (Split)', () => {
    it('should insert Split Vec3 node', () => {
      const result = insertAutoAdapter(
        mockNodes,
        mockEdges,
        { source: 'color-1', sourceHandle: 'color', target: 'time-1', targetHandle: 'dummy' },
        'vec3',
        'float'
      );

      // Should create 1 new node (Split Vec3)
      expect(result.newNodes).toHaveLength(1);
      expect(result.newNodes[0].data.definition.id).toBe('split_vec3');

      // Should create 2 new edges (color→split, split.x→time)
      expect(result.newEdges).toHaveLength(2);
      expect(result.newEdges[0].target).toBe(result.newNodes[0].id);
      expect(result.newEdges[1].sourceHandle).toBe('x'); // default to .x output
    });
  });

  describe('insertAutoAdapter - vec2 → vec3 (Split + Combine)', () => {
    it('should insert Split Vec2 + Combine Vec3 nodes', () => {
      const uvNode: Node = {
        id: 'uv-1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: { definition: NODE_REGISTRY.uv }
      };

      const result = insertAutoAdapter(
        [uvNode, mockNodes[1]],
        mockEdges,
        { source: 'uv-1', sourceHandle: 'uv', target: 'color-1', targetHandle: 'color' },
        'vec2',
        'vec3'
      );

      // Should create 2 new nodes (Split Vec2, Combine Vec3)
      expect(result.newNodes).toHaveLength(2);
      expect(result.newNodes[0].data.definition.id).toBe('split_vec2');
      expect(result.newNodes[1].data.definition.id).toBe('combine_vec3');

      // Should create 4 edges:
      // 1. uv → split.in
      // 2. split.x → combine.x
      // 3. split.y → combine.y
      // 4. combine.out → color
      expect(result.newEdges).toHaveLength(4);
    });

    it('should connect matching components (x→x, y→y)', () => {
      const uvNode: Node = {
        id: 'uv-1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: { definition: NODE_REGISTRY.uv }
      };

      const result = insertAutoAdapter(
        [uvNode, mockNodes[1]],
        mockEdges,
        { source: 'uv-1', sourceHandle: 'uv', target: 'color-1', targetHandle: 'color' },
        'vec2',
        'vec3'
      );

      const edges = result.newEdges;
      const splitId = result.newNodes[0].id;
      const combineId = result.newNodes[1].id;

      // Check component mapping
      const xEdge = edges.find(e => e.sourceHandle === 'x' && e.source === splitId);
      const yEdge = edges.find(e => e.sourceHandle === 'y' && e.source === splitId);

      expect(xEdge?.target).toBe(combineId);
      expect(xEdge?.targetHandle).toBe('x');
      expect(yEdge?.target).toBe(combineId);
      expect(yEdge?.targetHandle).toBe('y');
    });
  });

  describe('Edge cases', () => {
    it('should return empty result for same types', () => {
      const result = insertAutoAdapter(
        mockNodes,
        mockEdges,
        { source: 'time-1', sourceHandle: 'value', target: 'color-1', targetHandle: 'dummy' },
        'float',
        'float'
      );

      expect(result.newNodes).toHaveLength(0);
      expect(result.newEdges).toHaveLength(0);
    });

    it('should return empty result for auto type', () => {
      const result = insertAutoAdapter(
        mockNodes,
        mockEdges,
        { source: 'time-1', sourceHandle: 'value', target: 'color-1', targetHandle: 'dummy' },
        'float',
        'auto'
      );

      expect(result.newNodes).toHaveLength(0);
      expect(result.newEdges).toHaveLength(0);
    });

    it('should handle missing source node gracefully', () => {
      const result = insertAutoAdapter(
        mockNodes,
        mockEdges,
        { source: 'nonexistent', sourceHandle: 'value', target: 'color-1', targetHandle: 'color' },
        'float',
        'vec3'
      );

      expect(result.newNodes).toHaveLength(0);
      expect(result.newEdges).toHaveLength(0);
    });
  });
});
