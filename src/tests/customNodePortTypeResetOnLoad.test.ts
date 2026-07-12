import { describe, it, expect, beforeEach } from 'vitest';
import { loadCustomNodes, saveCustomNodes, type CustomNodeDefinition } from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';

/**
 * Regresja: COMPILATION ERROR "cannot convert from 'vec3' to 'vec2'" after
 * loading a fresh project with a working custom node (BeautyNode). Root
 * cause found by reproducing the real Examples/shader_graph.json subgraph:
 * loadCustomNodes() rebuilt each Custom Input/Output node's definition from
 * NODE_REGISTRY (generic, type 'auto') and only overrode it with the
 * resolved type when node.data.forcedType/detectedType was present. Those
 * two fields are set live by onConnect while wiring INSIDE the subgraph
 * editor, but a save that went through a file (Save writes
 * definition.inputs/outputs but not detectedType/forcedType — confirmed on
 * the real file) or an older save format doesn't have them — so on the very
 * next load, EVERY Custom Input/Output silently reset to 'auto', discarding
 * a type that was already resolved and sitting right there in
 * node.data.definition.
 */

describe('loadCustomNodes preserves resolved port types without detectedType', () => {
  beforeEach(() => localStorage.clear());

  it('a Custom Output whose resolved type lives only in definition.inputs (no detectedType) keeps that type', () => {
    const customNode: CustomNodeDefinition = {
      id: 'custom_beautynode',
      label: 'BeautyNode',
      description: '',
      compact: false,
      isCustom: true,
      inputs: [],
      outputs: [{ id: 'co1', label: 'Color OUT', type: 'vec3' }],
      glslTemplate: () => 'vec3(1.0, 0.0, 1.0)',
      subgraph: {
        nodes: [
          // No detectedType/forcedType on data — exactly what a file
          // round-trip (or a pre-fix save) produces.
          { id: 'ci1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: { ...NODE_REGISTRY['custom_input'], outputs: [{ id: 'out', type: 'vec2', label: 'Value' }] } } },
          { id: 'co1', type: 'shaderNode', position: { x: 300, y: 0 }, data: { definition: { ...NODE_REGISTRY['custom_output'], inputs: [{ id: 'in', type: 'vec3', label: 'Value' }] } } },
        ],
        edges: [],
      },
    };
    saveCustomNodes([customNode]);

    const loaded = loadCustomNodes();
    const ci1 = loaded[0].subgraph.nodes.find(n => n.id === 'ci1');
    const co1 = loaded[0].subgraph.nodes.find(n => n.id === 'co1');

    expect((ci1!.data.definition as { outputs: { type: string }[] }).outputs[0].type).toBe('vec2');
    expect((co1!.data.definition as { inputs: { type: string }[] }).inputs[0].type).toBe('vec3');
  });

  it('forcedType still wins over a stale saved definition type', () => {
    const customNode: CustomNodeDefinition = {
      id: 'custom_x',
      label: 'X',
      description: '',
      compact: false,
      isCustom: true,
      inputs: [],
      outputs: [{ id: 'co1', label: 'Out', type: 'float' }],
      glslTemplate: () => 'vec3(0.0)',
      subgraph: {
        nodes: [
          {
            id: 'co1', type: 'shaderNode', position: { x: 0, y: 0 },
            data: { definition: { ...NODE_REGISTRY['custom_output'], inputs: [{ id: 'in', type: 'vec3', label: 'Value' }] }, forcedType: 'float' },
          },
        ],
        edges: [],
      },
    };
    saveCustomNodes([customNode]);

    const loaded = loadCustomNodes();
    const co1 = loaded[0].subgraph.nodes.find(n => n.id === 'co1');
    expect((co1!.data.definition as { inputs: { type: string }[] }).inputs[0].type).toBe('float');
  });

  it('a genuinely unresolved port (saved type is auto) stays auto, not silently vec3', () => {
    const customNode: CustomNodeDefinition = {
      id: 'custom_y',
      label: 'Y',
      description: '',
      compact: false,
      isCustom: true,
      inputs: [{ id: 'ci1', label: 'In', type: 'auto' }],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
      glslTemplate: () => 'vec3(0.0)',
      subgraph: {
        nodes: [
          { id: 'ci1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: NODE_REGISTRY['custom_input'] } },
        ],
        edges: [],
      },
    };
    saveCustomNodes([customNode]);

    const loaded = loadCustomNodes();
    const ci1 = loaded[0].subgraph.nodes.find(n => n.id === 'ci1');
    expect((ci1!.data.definition as { outputs: { type: string }[] }).outputs[0].type).toBe('auto');
  });
});
