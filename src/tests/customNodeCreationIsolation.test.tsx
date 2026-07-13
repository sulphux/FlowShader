import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import NodeEditor from '../components/NodeEditor';
import { addCustomNode, loadCustomNodes, type CustomNodeDefinition } from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';

const STORAGE_KEY = 'shader-nodes-save-v1';

describe('custom node creation isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    Object.keys(NODE_REGISTRY)
      .filter(key => key.startsWith('custom_') && key !== 'custom_input' && key !== 'custom_output')
      .forEach(key => delete (NODE_REGISTRY as Record<string, unknown>)[key]);

    const firstDefinition: CustomNodeDefinition = {
      id: 'custom_first',
      label: 'First',
      description: '',
      compact: false,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
      isCustom: true,
      subgraph: {
        nodes: [
          { id: 'first_input', type: 'shaderNode', position: { x: 100, y: 200 }, data: { definition: NODE_REGISTRY.custom_input } },
          { id: 'first_output', type: 'shaderNode', position: { x: 400, y: 200 }, data: { definition: NODE_REGISTRY.custom_output } },
        ],
        edges: [],
      },
      glslTemplate: () => 'vec3(1.0, 0.0, 1.0)',
    };
    addCustomNode(firstDefinition);
    (NODE_REGISTRY as Record<string, unknown>).custom_first = firstDefinition;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nodes: [
        { id: 'out1', type: 'shaderNode', position: { x: 500, y: 100 }, data: { definition: { id: 'output' } } },
        {
          id: 'first1',
          type: 'shaderNode',
          position: { x: 100, y: 100 },
          selected: true,
          data: { definition: { id: 'custom_first' } },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }));
  });

  const openCreateDialog = async (container: HTMLElement, action: RegExp) => {
    await waitFor(() => expect(container.querySelector('[data-id="first1"]')).toBeTruthy());
    const firstInstance = container.querySelector('[data-id="first1"]');
    fireEvent.click(firstInstance!);
    const pane = container.querySelector('.react-flow__pane');
    expect(pane).toBeTruthy();
    fireEvent.contextMenu(pane!, { clientX: 600, clientY: 400 });
    fireEvent.click(screen.getByText(action));
  };

  it('creates an empty custom node even when another custom node is selected', async () => {
    const { container } = render(<ReactFlowProvider><NodeEditor /></ReactFlowProvider>);
    await openCreateDialog(container, /Create Custom Node \(Empty\)/i);

    fireEvent.change(screen.getByPlaceholderText('My Custom Effect'), { target: { value: 'Second Empty' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create', exact: true }));

    await waitFor(() => {
      expect(loadCustomNodes().some(node => node.id === 'custom_second_empty')).toBe(true);
    });
    const created = loadCustomNodes().find(node => node.id === 'custom_second_empty')!;
    expect(created.subgraph.nodes.map(node => node.data.definition.id)).toEqual(['custom_input', 'custom_output']);
    expect(created.subgraph.nodes.some(node => node.data.definition.id === 'custom_first')).toBe(false);
  });

  it('copies selected nodes only through the explicit selection action', async () => {
    const { container } = render(<ReactFlowProvider><NodeEditor /></ReactFlowProvider>);
    await openCreateDialog(container, /Create Custom Node from Selection/i);

    fireEvent.change(screen.getByPlaceholderText('My Custom Effect'), { target: { value: 'Second Wrapped' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create', exact: true }));

    await waitFor(() => {
      expect(loadCustomNodes().some(node => node.id === 'custom_second_wrapped')).toBe(true);
    });
    const created = loadCustomNodes().find(node => node.id === 'custom_second_wrapped')!;
    expect(created.subgraph.nodes).toHaveLength(1);
    expect(created.subgraph.nodes[0].data.definition.id).toBe('custom_first');
    expect(created.subgraph.nodes[0].selected).toBe(false);
  });
});
