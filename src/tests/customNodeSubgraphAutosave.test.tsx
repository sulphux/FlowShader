import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import NodeEditor from '../components/NodeEditor';
import { addCustomNode, type CustomNodeDefinition } from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';
import type { Node } from 'reactflow';

/**
 * Regresja: subgraph edits only persisted into custom_nodes_library on
 * navigateBack/navigateToLevel (NodeEditor.tsx persistCurrentSubgraph). The
 * generic auto-save effect explicitly skipped anything but Main. So entering
 * a custom node, adding something, and refreshing the page WITHOUT first
 * clicking back to Main lost the addition — nav-path restore replayed the
 * pre-edit subgraph straight from storage, since the edit was never written
 * there. persistCurrentSubgraph now also runs on every subgraph change, same
 * cadence as the Main canvas auto-save.
 */

const STORAGE_KEY = 'shader-nodes-save-v1';

describe('Editing inside a custom node subgraph survives a "page refresh"', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.keys(NODE_REGISTRY)
      .filter(key => key.startsWith('custom_') && key !== 'custom_input' && key !== 'custom_output')
      .forEach(key => delete (NODE_REGISTRY as Record<string, unknown>)[key]);
  });

  const seedCustomNode = () => {
    const subgraphNodes: Node[] = [
      { id: 'ci1', type: 'shaderNode', position: { x: 100, y: 200 }, data: { definition: NODE_REGISTRY['custom_input'], label: 'Input' } },
      { id: 'co1', type: 'shaderNode', position: { x: 400, y: 200 }, data: { definition: NODE_REGISTRY['custom_output'], label: 'Output' } },
    ];
    const customNode: CustomNodeDefinition = {
      id: 'custom_glow',
      label: 'Glow',
      description: '',
      compact: false,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
      isCustom: true,
      subgraph: { nodes: subgraphNodes, edges: [] },
      glslTemplate: () => 'vec3(1.0, 0.0, 1.0)',
    };
    (NODE_REGISTRY as Record<string, unknown>)['custom_glow'] = customNode;
    addCustomNode(customNode);

    // Main graph has an instance of it, like a saved project would
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nodes: [
        { id: 'out1', type: 'shaderNode', position: { x: 500, y: 100 }, data: { definition: { id: 'output' } } },
        { id: 'glow1', type: 'shaderNode', position: { x: 100, y: 100 }, data: { definition: { id: 'custom_glow' } } },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }));
  };

  it('adding a node inside the subgraph, then refreshing without navigating back to Main, keeps the addition', async () => {
    seedCustomNode();

    const { container, unmount } = render(<ReactFlowProvider><NodeEditor /></ReactFlowProvider>);

    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0);
    });

    // 1. Enter the "Glow" custom node
    const glowInstance = container.querySelector('[data-id="glow1"]');
    expect(glowInstance).toBeTruthy();
    fireEvent.doubleClick(glowInstance!);
    await waitFor(() => {
      expect(container.querySelector('[data-id="ci1"]')).toBeTruthy();
    });

    // 2. Add something — a node, the same way dragging from the sidebar does
    const pane = container.querySelector('.react-flow');
    expect(pane).toBeTruthy();
    fireEvent.drop(pane!, {
      dataTransfer: { getData: (key: string) => (key === 'application/reactflow' ? 'math_sin' : '') },
      clientX: 300, clientY: 300,
    });

    await waitFor(() => {
      const added = Array.from(container.querySelectorAll('.react-flow__node'))
        .filter(n => n.getAttribute('data-id')?.startsWith('math_sin_'));
      expect(added).toHaveLength(1);
    });

    // 3. "Refresh the page" — unmount + fresh render, reading only from
    // localStorage/NODE_REGISTRY. Deliberately NOT clicking back to Main first.
    unmount();
    cleanup();
    const { container: container2 } = render(<ReactFlowProvider><NodeEditor /></ReactFlowProvider>);

    await waitFor(() => {
      // Still inside "Glow" (nav-path restore) ...
      expect(container2.querySelector('[data-id="ci1"]')).toBeTruthy();
    });
    // ... and what was added is still there
    const survived = Array.from(container2.querySelectorAll('.react-flow__node'))
      .filter(n => n.getAttribute('data-id')?.startsWith('math_sin_'));
    expect(survived).toHaveLength(1);
  });
});
