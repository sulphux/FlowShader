import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import NodeEditor from '../components/NodeEditor';

const STORAGE_KEY = 'shader-nodes-save-v1';

/**
 * Regression: deleting a node via the trash button used to leave any edges
 * connected to it behind (deleteSelected() only filtered out edges that were
 * THEMSELVES selected, not edges touching the removed node) — corrupting the
 * saved graph with edges pointing at a node id that no longer exists.
 */
describe('Deleting a node removes its connected edges (not just the node)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      // time1 seeded pre-selected (selected: true) — clicking to select a
      // ReactFlow node isn't a reliable gesture to synthesize in jsdom, and
      // other tests in this suite use the same seeded-selection approach.
      nodes: [
        { id: 'time1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: { id: 'time' } }, selected: true },
        { id: 'out1', type: 'shaderNode', position: { x: 300, y: 0 }, data: { definition: { id: 'output' } } },
      ],
      edges: [
        { id: 'e1', source: 'time1', sourceHandle: 't', target: 'out1', targetHandle: 'color' },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    }));
  });

  it('deleting the source node also removes the edge from the saved graph', async () => {
    const { container } = render(<ReactFlowProvider><NodeEditor /></ReactFlowProvider>);

    await waitFor(() => {
      expect(container.querySelector('[data-id="time1"]')).toBeTruthy();
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).edges).toHaveLength(1);

    const trash = document.querySelector('[title="Delete Selected (Del)"]');
    expect(trash).toBeTruthy();
    fireEvent.click(trash!);

    await waitFor(() => {
      expect(container.querySelector('[data-id="time1"]')).toBeFalsy();
    });

    // The dangling edge must be gone too, not just the node
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(saved.edges).toHaveLength(0);
    });
  });
});
