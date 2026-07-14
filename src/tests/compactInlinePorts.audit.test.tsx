import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import { ShaderNode } from '../components/ShaderNode';
import { inlinePortHandleId, isVectorType, vectorComponents } from '../core/inlinePortAdapters';
import type { ShaderNodeDefinition } from '../core/types';
import { NODE_REGISTRY } from '../nodes';

const compactDefinitions = Object.values(NODE_REGISTRY)
  .filter(definition => definition.compact)
  .filter(definition => definition.id !== 'smart_split' && definition.id !== 'smart_compose');

const slimAdapterDefinitions = Object.values(NODE_REGISTRY).filter(definition =>
  definition.id.startsWith('split_') || definition.id.startsWith('combine_')
  || definition.id === 'smart_split' || definition.id === 'smart_compose');

const auditedDefinitions = [...compactDefinitions, ...slimAdapterDefinitions];

const definitionsWithVectorPorts = auditedDefinitions.filter(definition =>
  [...definition.inputs, ...definition.outputs].some(port => isVectorType(port.type)));

const renderCompact = (definition: ShaderNodeDefinition) => render(
  <ReactFlowProvider>
    <ReactFlow
      defaultNodes={[{
        id: `audit_${definition.id}`,
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: { definition },
      }]}
      nodeTypes={{ shaderNode: ShaderNode }}
    />
  </ReactFlowProvider>,
);

describe('compact inline port registry audit', () => {
  it('covers every registered compact node that exposes a vector port', () => {
    const coveredIds = definitionsWithVectorPorts.map(definition => definition.id);
    auditedDefinitions.forEach(definition => {
      const hasVectorPort = [...definition.inputs, ...definition.outputs].some(port => isVectorType(port.type));
      expect(coveredIds.includes(definition.id), definition.id).toBe(hasVectorPort);
    });
    expect(coveredIds).toContain('vec_add2');
    expect(coveredIds).toContain('vec_add3');
    expect(coveredIds).toContain('color_add');
    expect(coveredIds).toContain('math_mix');
  });

  it.each(definitionsWithVectorPorts.map(definition => [definition.id, definition] as const))(
    '%s: splits and labels every vector input and output',
    async (_definitionId, definition) => {
      const { container, getByRole } = renderCompact(definition);
      const vectorPorts = [
        ...definition.inputs.filter(port => isVectorType(port.type)).map(port => ({ direction: 'input' as const, port })),
        ...definition.outputs.filter(port => isVectorType(port.type)).map(port => ({ direction: 'output' as const, port })),
      ];

      for (const { direction, port } of vectorPorts) {
        const parent = container.querySelector(`[data-handleid="${port.id}"]`);
        expect(parent, `${definition.id}.${port.id} parent handle`).toBeTruthy();
        fireEvent.contextMenu(parent!);

        const componentNames = vectorComponents(port.type).map(component => component.toUpperCase()).join(' / ');
        fireEvent.click(getByRole('menuitem', { name: `⑂ Split into ${componentNames}` }));

        await waitFor(() => expect(container.querySelector(`[data-handleid="${port.id}"]`)).toBeFalsy());
        vectorComponents(port.type).forEach(component => {
          const handleId = inlinePortHandleId(direction, port.id, component);
          const handle = container.querySelector(`[data-handleid="${handleId}"]`);
          expect(handle, `${definition.id}.${port.id}.${component} handle`).toBeTruthy();
          expect(handle).toHaveClass(direction === 'input' ? 'target' : 'source');
          expect(container.querySelector(`[data-port-label="${port.label}.${component.toUpperCase()}"]`)).toBeTruthy();
        });
      }
    },
  );

  it.each(auditedDefinitions.map(definition => [definition.id, definition] as const))(
    '%s: labels every unsplit compact input and output',
    (_definitionId, definition) => {
      const { container } = renderCompact(definition);
      const labels = [...container.querySelectorAll('[data-port-label]')]
        .map(element => element.getAttribute('data-port-label'));
      expect(labels).toEqual([
        ...definition.inputs.map(port => port.label),
        ...definition.outputs.map(port => port.label),
      ]);
    },
  );
});
