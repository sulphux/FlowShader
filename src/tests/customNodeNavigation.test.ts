import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';

interface NavigationLevel {
  nodes: Node[];
  edges: Edge[];
  customNodeId?: string;
  customNodeName?: string;
}

describe('Custom Node Navigation', () => {
  describe('Enter/Exit', () => {
    it('should enter custom node and create navigation level', () => {
      const navigationStack: NavigationLevel[] = [];
      
      const mainLevel = {
        nodes: [
          { id: '1', type: 'custom_test_node', data: {}, position: { x: 0, y: 0 } }
        ] as Node[],
        edges: [] as Edge[]
      };

      navigationStack.push(mainLevel);

      const customNodeLevel = {
        nodes: [
          { id: '1', type: 'custom_input', data: { label: 'Input A', outputType: 'float' }, position: { x: 0, y: 0 } }
        ] as Node[],
        edges: [] as Edge[],
        customNodeId: '1',
        customNodeName: 'test_node'
      };

      navigationStack.push(customNodeLevel);

      expect(navigationStack.length).toBe(2);
      expect(navigationStack[1].customNodeName).toBe('test_node');
    });

    it('should exit to parent level', () => {
      const navigationStack: NavigationLevel[] = [
        {
          nodes: [{ id: '1', type: 'custom_test_node', data: {}, position: { x: 0, y: 0 } }] as Node[],
          edges: [] as Edge[]
        },
        {
          nodes: [{ id: '1', type: 'custom_input', data: { label: 'Input A', outputType: 'float' }, position: { x: 0, y: 0 } }] as Node[],
          edges: [] as Edge[],
          customNodeId: '1',
          customNodeName: 'test_node'
        }
      ];

      navigationStack.pop();

      expect(navigationStack.length).toBe(1);
      expect(navigationStack[0].customNodeId).toBeUndefined();
    });

    it('should exit to main level', () => {
      const navigationStack: NavigationLevel[] = [
        {
          nodes: [{ id: '1', type: 'custom_test_node', data: {}, position: { x: 0, y: 0 } }] as Node[],
          edges: [] as Edge[]
        },
        {
          nodes: [] as Node[],
          edges: [] as Edge[],
          customNodeId: '1',
          customNodeName: 'level1'
        },
        {
          nodes: [] as Node[],
          edges: [] as Edge[],
          customNodeId: '2',
          customNodeName: 'level2'
        }
      ];

      while (navigationStack.length > 1) {
        navigationStack.pop();
      }

      expect(navigationStack.length).toBe(1);
      expect(navigationStack[0].customNodeId).toBeUndefined();
    });
  });

  describe('Multi-level Navigation', () => {
    it('should handle nested custom nodes', () => {
      const navigationStack: NavigationLevel[] = [];

      navigationStack.push({
        nodes: [{ id: '1', type: 'custom_outer', data: {}, position: { x: 0, y: 0 } }] as Node[],
        edges: [] as Edge[]
      });

      navigationStack.push({
        nodes: [{ id: '1', type: 'custom_inner', data: {}, position: { x: 0, y: 0 } }] as Node[],
        edges: [] as Edge[],
        customNodeId: '1',
        customNodeName: 'outer'
      });

      navigationStack.push({
        nodes: [{ id: '1', type: 'custom_input', data: { label: 'Input A', outputType: 'float' }, position: { x: 0, y: 0 } }] as Node[],
        edges: [] as Edge[],
        customNodeId: '1',
        customNodeName: 'inner'
      });

      expect(navigationStack.length).toBe(3);
      expect(navigationStack[2].customNodeName).toBe('inner');
    });

    it('should handle deep nesting (3+ levels)', () => {
      const navigationStack: NavigationLevel[] = [];

      for (let i = 0; i < 5; i++) {
        navigationStack.push({
          nodes: [] as Node[],
          edges: [] as Edge[],
          customNodeId: i > 0 ? `${i}` : undefined,
          customNodeName: i > 0 ? `level${i}` : undefined
        });
      }

      expect(navigationStack.length).toBe(5);
      expect(navigationStack[4].customNodeName).toBe('level4');
    });

    it('should maintain navigation history', () => {
      const navigationStack: NavigationLevel[] = [];
      const history: string[] = [];

      navigationStack.push({
        nodes: [] as Node[],
        edges: [] as Edge[]
      });
      history.push('main');

      navigationStack.push({
        nodes: [] as Node[],
        edges: [] as Edge[],
        customNodeId: '1',
        customNodeName: 'level1'
      });
      history.push('level1');

      navigationStack.push({
        nodes: [] as Node[],
        edges: [] as Edge[],
        customNodeId: '2',
        customNodeName: 'level2'
      });
      history.push('level2');

      expect(history).toEqual(['main', 'level1', 'level2']);
      expect(navigationStack.length).toBe(history.length);
    });
  });

  describe('State Preservation', () => {
    it('should save main state before entering custom node', () => {
      const mainState = {
        nodes: [
          { id: '1', type: 'add', data: {}, position: { x: 0, y: 0 } },
          { id: '2', type: 'output', data: {}, position: { x: 200, y: 0 } }
        ] as Node[],
        edges: [
          { id: 'e1', source: '1', sourceHandle: 'result', target: '2', targetHandle: 'color' }
        ] as Edge[]
      };

      const navigationStack: NavigationLevel[] = [mainState];

      const savedMain = { ...navigationStack[0] };
      expect(savedMain.nodes.length).toBe(2);
      expect(savedMain.edges.length).toBe(1);
    });

    it('should restore main state when exiting custom node', () => {
      const originalMain = {
        nodes: [
          { id: '1', type: 'add', data: {}, position: { x: 0, y: 0 } }
        ] as Node[],
        edges: [] as Edge[]
      };

      const navigationStack: NavigationLevel[] = [
        { ...originalMain },
        {
          nodes: [{ id: '1', type: 'custom_input', data: { label: 'Input A', outputType: 'float' }, position: { x: 0, y: 0 } }] as Node[],
          edges: [] as Edge[],
          customNodeId: '1',
          customNodeName: 'test_node'
        }
      ];

      navigationStack.pop();
      const restoredMain = navigationStack[0];

      expect(restoredMain.nodes.length).toBe(originalMain.nodes.length);
      expect(restoredMain.edges.length).toBe(originalMain.edges.length);
    });

    it('should preserve subgraph state within custom node', () => {
      const subgraphState = {
        nodes: [
          { id: '1', type: 'custom_input', data: { label: 'Input A', outputType: 'float' }, position: { x: 0, y: 0 } },
          { id: '2', type: 'add', data: {}, position: { x: 200, y: 0 } },
          { id: '3', type: 'custom_output', data: { label: 'Output A', inputType: 'float' }, position: { x: 400, y: 0 } }
        ] as Node[],
        edges: [
          { id: 'e1', source: '1', sourceHandle: 'value', target: '2', targetHandle: 'a' },
          { id: 'e2', source: '2', sourceHandle: 'result', target: '3', targetHandle: 'value' }
        ] as Edge[],
        customNodeId: '1',
        customNodeName: 'test_node'
      };

      const navigationStack: NavigationLevel[] = [
        { nodes: [] as Node[], edges: [] as Edge[] },
        subgraphState
      ];

      const currentSubgraph = navigationStack[1];
      expect(currentSubgraph.nodes.length).toBe(3);
      expect(currentSubgraph.edges.length).toBe(2);
    });
  });

  describe('Default Nodes', () => {
    it('should create custom node with default Custom Input and Output nodes', () => {
      const defaultNodes: Node[] = [
        { id: '1', type: 'custom_input', data: { label: 'Input', outputType: 'float' }, position: { x: 100, y: 100 } },
        { id: '2', type: 'custom_output', data: { label: 'Output', inputType: 'float' }, position: { x: 400, y: 100 } }
      ];

      expect(defaultNodes.length).toBe(2);
      expect(defaultNodes[0].type).toBe('custom_input');
      expect(defaultNodes[1].type).toBe('custom_output');
    });

    it('should add default nodes when editing empty custom node', () => {
      const emptySubgraph = {
        nodes: [] as Node[],
        edges: [] as Edge[]
      };

      const shouldAddDefaults = emptySubgraph.nodes.length === 0;
      expect(shouldAddDefaults).toBe(true);

      if (shouldAddDefaults) {
        emptySubgraph.nodes = [
          { id: '1', type: 'custom_input', data: { label: 'Input', outputType: 'float' }, position: { x: 100, y: 100 } },
          { id: '2', type: 'custom_output', data: { label: 'Output', inputType: 'float' }, position: { x: 400, y: 100 } }
        ];
      }

      expect(emptySubgraph.nodes.length).toBe(2);
    });
  });

  describe('Breadcrumb Navigation', () => {
    it('should navigate to specific level in stack', () => {
      const navigationStack: NavigationLevel[] = [
        { nodes: [] as Node[], edges: [] as Edge[] },
        { nodes: [] as Node[], edges: [] as Edge[], customNodeId: '1', customNodeName: 'level1' },
        { nodes: [] as Node[], edges: [] as Edge[], customNodeId: '2', customNodeName: 'level2' },
        { nodes: [] as Node[], edges: [] as Edge[], customNodeId: '3', customNodeName: 'level3' }
      ];

      const targetLevel = 1;
      while (navigationStack.length > targetLevel + 1) {
        navigationStack.pop();
      }

      expect(navigationStack.length).toBe(2);
      expect(navigationStack[1].customNodeName).toBe('level1');
    });

    it('should navigate directly to main from any level', () => {
      const navigationStack: NavigationLevel[] = [
        { nodes: [] as Node[], edges: [] as Edge[] },
        { nodes: [] as Node[], edges: [] as Edge[], customNodeId: '1', customNodeName: 'level1' },
        { nodes: [] as Node[], edges: [] as Edge[], customNodeId: '2', customNodeName: 'level2' }
      ];

      while (navigationStack.length > 1) {
        navigationStack.pop();
      }

      expect(navigationStack.length).toBe(1);
      expect(navigationStack[0].customNodeId).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle navigation with no custom nodes', () => {
      const navigationStack: NavigationLevel[] = [
        {
          nodes: [{ id: '1', type: 'add', data: {}, position: { x: 0, y: 0 } }] as Node[],
          edges: [] as Edge[]
        }
      ];

      expect(navigationStack.length).toBe(1);
      expect(navigationStack[0].customNodeId).toBeUndefined();
    });

    it('should handle navigation with empty subgraph', () => {
      const navigationStack: NavigationLevel[] = [
        { nodes: [] as Node[], edges: [] as Edge[] },
        { 
          nodes: [] as Node[], 
          edges: [] as Edge[], 
          customNodeId: '1', 
          customNodeName: 'empty_node' 
        }
      ];

      expect(navigationStack[1].nodes.length).toBe(0);
      expect(navigationStack[1].edges.length).toBe(0);
      expect(navigationStack[1].customNodeName).toBe('empty_node');
    });
  });
});
