import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import NodeEditor from '../components/NodeEditor';
import { addCustomNode, type CustomNodeDefinition } from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';
import type { Node } from 'reactflow';

/**
 * Regresja: Save (Ctrl+S / przycisk) wewnątrz podgrafu custom noda zapisywał
 * do pliku CANVAS — czyli wnętrze subgrafu (Custom Input/Output, bez noda
 * Output) — nadpisując plik projektu. Tak właśnie Examples/shader_graph.json
 * został podmieniony na bebechy BeautyNode'a. Save zapisuje teraz zawsze
 * graf Main (edycje subgrafu i tak są persystowane do definicji custom noda
 * na bieżąco), niezależnie od tego, gdzie użytkownik aktualnie jest.
 */

const savedJsons: string[] = [];

vi.mock('../core/fileAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/fileAccess')>();
  return {
    ...actual,
    supportsFileSystemAccess: () => true,
    saveProjectFile: (json: string) => {
      savedJsons.push(json);
      return Promise.resolve({ handle: null, fileName: 'mock.json', saved: true });
    },
  };
});

const STORAGE_KEY = 'shader-nodes-save-v1';

describe('Save while inside a custom node subgraph', () => {
  beforeEach(() => {
    localStorage.clear();
    savedJsons.length = 0;
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nodes: [
        { id: 'out1', type: 'shaderNode', position: { x: 500, y: 100 }, data: { definition: { id: 'output' } } },
        { id: 'glow1', type: 'shaderNode', position: { x: 100, y: 100 }, data: { definition: { id: 'custom_glow' } } },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }));
  };

  it('Ctrl+S inside the subgraph saves the Main project, not the subgraph view', async () => {
    seedCustomNode();

    const { container } = render(<ReactFlowProvider><NodeEditor /></ReactFlowProvider>);

    await waitFor(() => {
      expect(container.querySelector('[data-id="glow1"]')).toBeTruthy();
    });

    // Enter the custom node's subgraph
    fireEvent.doubleClick(container.querySelector('[data-id="glow1"]')!);
    await waitFor(() => {
      expect(container.querySelector('[data-id="ci1"]')).toBeTruthy();
    });

    // Save while still inside
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(savedJsons).toHaveLength(1);
    });

    const saved = JSON.parse(savedJsons[0]);
    const savedIds = saved.nodes.map((n: { id: string }) => n.id);
    // The PROJECT graph — with its Output node and the custom node instance
    expect(savedIds).toContain('out1');
    expect(savedIds).toContain('glow1');
    // NOT the subgraph innards
    expect(savedIds).not.toContain('ci1');
    expect(savedIds).not.toContain('co1');
  });

  it('Ctrl+S at Main level still saves the current canvas as before', async () => {
    seedCustomNode();

    const { container } = render(<ReactFlowProvider><NodeEditor /></ReactFlowProvider>);
    await waitFor(() => {
      expect(container.querySelector('[data-id="glow1"]')).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(savedJsons).toHaveLength(1);
    });
    const savedIds = JSON.parse(savedJsons[0]).nodes.map((n: { id: string }) => n.id);
    expect(savedIds).toContain('out1');
    expect(savedIds).toContain('glow1');
  });
});
