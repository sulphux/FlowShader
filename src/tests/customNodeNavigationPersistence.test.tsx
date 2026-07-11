import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import NodeEditor from '../components/NodeEditor';
import { addCustomNode, type CustomNodeDefinition } from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';
import type { Node } from 'reactflow';

/**
 * Regresja: będąc wewnątrz podgrafu custom node'a, odświeżenie strony zawsze
 * wracało do Main — navigationStack/currentContext żyły tylko w React state,
 * nigdy nie były zapisywane. NodeEditor.tsx teraz persystuje "ścieżkę"
 * (nazwy custom nodów, od Main w dół) do localStorage i odtwarza ją przy
 * montowaniu.
 */

const NAV_PATH_KEY = 'shader-nodes-nav-path-v1';
const STORAGE_KEY = 'shader-nodes-save-v1';

describe('Custom node navigation survives a "page refresh" (unmount + remount)', () => {
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

    // Seed the main graph with an instance of it, like a saved project would have
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nodes: [
        { id: 'out1', type: 'shaderNode', position: { x: 500, y: 100 }, data: { definition: { id: 'output' } } },
        { id: 'glow1', type: 'shaderNode', position: { x: 100, y: 100 }, data: { definition: { id: 'custom_glow' } } },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }));
  };

  it('double-clicking into a custom node, then remounting, restores the same context', async () => {
    seedCustomNode();

    const { container, unmount } = render(<ReactFlowProvider><NodeEditor /></ReactFlowProvider>);

    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0);
    });

    const glowInstance = container.querySelector('[data-id="glow1"]');
    expect(glowInstance).toBeTruthy();
    fireEvent.doubleClick(glowInstance!);

    // Entering the subgraph swaps the canvas to Custom Input/Output and persists the path
    await waitFor(() => {
      expect(localStorage.getItem(NAV_PATH_KEY)).toBe(JSON.stringify(['Glow']));
    });
    await waitFor(() => {
      expect(container.querySelector('[data-id="ci1"]')).toBeTruthy();
    });

    // Simulate a page refresh: unmount and render a brand-new instance.
    // Custom node registry state (NODE_REGISTRY['custom_glow']) is intentionally
    // left as-is, same as it would be reloaded from localStorage on a real refresh.
    unmount();
    cleanup();
    const { container: container2 } = render(<ReactFlowProvider><NodeEditor /></ReactFlowProvider>);

    await waitFor(() => {
      // Still inside the "Glow" subgraph — Custom Input/Output visible, not the Main graph
      expect(container2.querySelector('[data-id="ci1"]')).toBeTruthy();
      expect(container2.querySelector('[data-id="co1"]')).toBeTruthy();
    });
    // The Main-graph instance (glow1) should NOT be present — we're one level deep
    expect(container2.querySelector('[data-id="glow1"]')).toBeFalsy();
  });

  it('navigating back to Main clears the persisted path', async () => {
    seedCustomNode();
    localStorage.setItem(NAV_PATH_KEY, JSON.stringify(['Glow']));

    const { container } = render(<ReactFlowProvider><NodeEditor /></ReactFlowProvider>);

    await waitFor(() => {
      expect(container.querySelector('[data-id="ci1"]')).toBeTruthy();
    });

    const mainCrumb = [...container.querySelectorAll('button')].find(el => el.textContent?.includes('Main'));
    expect(mainCrumb).toBeTruthy();
    fireEvent.click(mainCrumb!);

    await waitFor(() => {
      expect(localStorage.getItem(NAV_PATH_KEY)).toBeNull();
    });
  });

  it('a stale path (custom node since deleted) falls back to Main without crashing', async () => {
    // No custom node seeded — the registry has nothing called "Ghost"
    localStorage.setItem(NAV_PATH_KEY, JSON.stringify(['Ghost']));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nodes: [{ id: 'out1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: { id: 'output' } } }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }));

    const { container } = render(<ReactFlowProvider><NodeEditor /></ReactFlowProvider>);

    await waitFor(() => {
      expect(container.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0);
    });
    expect(container.querySelector('[data-id="out1"]')).toBeTruthy();
  });
});
