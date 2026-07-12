import { describe, it, expect, beforeEach } from 'vitest';
import { rehydrateGraph, serializeGraph } from '../core/graphRehydration';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { addCustomNode, getCustomNode, type CustomNodeDefinition } from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';
import { hasGlslangValidator, validateWithGlslangValidator } from './utils/glslangValidate';
import type { Node } from 'reactflow';

/**
 * Feature: sharing a saved project with a custom node used to only carry a
 * bare {id: "custom_x"} reference — opening it anywhere the recipient's
 * browser didn't already have that exact custom node in localStorage
 * (custom_nodes_library, never part of the file) showed "Missing node"
 * instead of working, even though the file compiled fine for the original
 * author. serializeGraph now embeds the full definition of every custom
 * node used (including nested ones), and rehydrateGraph imports any that
 * are missing locally before resolving the graph.
 */

const glslangAvailable = hasGlslangValidator();
const toGraphNodes = (nodes: Node[]): GraphNode[] =>
  nodes.map(n => ({ id: n.id, type: n.type || 'shaderNode', data: n.data }));

describe('Custom nodes travel with a saved project', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.keys(NODE_REGISTRY)
      .filter(key => key.startsWith('custom_') && key !== 'custom_input' && key !== 'custom_output')
      .forEach(key => delete (NODE_REGISTRY as Record<string, unknown>)[key]);
  });

  const buildGlowCustomNode = (): CustomNodeDefinition => ({
    id: 'custom_glow',
    label: 'Glow',
    description: '',
    compact: false,
    inputs: [{ id: 'ci1', label: 'Amount', type: 'float' }],
    outputs: [{ id: 'co1', label: 'Out', type: 'vec3' }],
    isCustom: true,
    glslTemplate: () => 'vec3(1.0, 0.0, 1.0)',
    subgraph: {
      nodes: [
        { id: 'ci1', type: 'shaderNode', position: { x: 0, y: 0 }, data: { definition: { ...NODE_REGISTRY['custom_input'], outputs: [{ id: 'out', type: 'float', label: 'Value' }] }, detectedType: 'float' } },
        { id: 'mono1', type: 'shaderNode', position: { x: 150, y: 0 }, data: { definition: NODE_REGISTRY['mono'] } },
        { id: 'co1', type: 'shaderNode', position: { x: 300, y: 0 }, data: { definition: { ...NODE_REGISTRY['custom_output'], inputs: [{ id: 'in', type: 'vec3', label: 'Value' }] }, detectedType: 'vec3' } },
      ],
      edges: [
        { id: 'e1', source: 'ci1', sourceHandle: 'out', target: 'mono1', targetHandle: 'in' },
        { id: 'e2', source: 'mono1', sourceHandle: 'out', target: 'co1', targetHandle: 'in' },
      ],
    },
  });

  it('serializeGraph embeds the used custom node definition', () => {
    addCustomNode(buildGlowCustomNode());
    (NODE_REGISTRY as Record<string, unknown>)['custom_glow'] = buildGlowCustomNode();

    const nodes: Node[] = [
      { id: 'out1', type: 'shaderNode', position: { x: 500, y: 0 }, data: { definition: NODE_REGISTRY['output'] } },
      { id: 'glow1', type: 'shaderNode', position: { x: 100, y: 0 }, data: { definition: { id: 'custom_glow' } } },
    ];
    const edges = [{ id: 'e1', source: 'glow1', sourceHandle: 'co1', target: 'out1', targetHandle: 'color' }];

    const serialized = serializeGraph(nodes, edges);
    expect(serialized.customNodes).toBeDefined();
    expect(serialized.customNodes!.map(c => c.id)).toEqual(['custom_glow']);
    expect(serialized.customNodes![0].subgraph.nodes.map(n => n.id)).toEqual(['ci1', 'mono1', 'co1']);
  });

  it('rehydrateGraph on a FRESH browser (empty custom_nodes_library) imports the embedded node and compiles', () => {
    // Author's session: create + save
    addCustomNode(buildGlowCustomNode());
    (NODE_REGISTRY as Record<string, unknown>)['custom_glow'] = buildGlowCustomNode();
    const nodes: Node[] = [
      { id: 'out1', type: 'shaderNode', position: { x: 500, y: 0 }, data: { definition: NODE_REGISTRY['output'] } },
      { id: 'glow1', type: 'shaderNode', position: { x: 100, y: 0 }, data: { definition: { id: 'custom_glow' } } },
    ];
    const edges = [{ id: 'e1', source: 'glow1', sourceHandle: 'co1', target: 'out1', targetHandle: 'color' }];
    const fileContent = JSON.parse(JSON.stringify(serializeGraph(nodes, edges)));

    // Recipient's fresh browser: nothing in storage, nothing in the registry
    localStorage.clear();
    delete (NODE_REGISTRY as Record<string, unknown>)['custom_glow'];
    expect(getCustomNode('custom_glow')).toBeNull();

    const restored = rehydrateGraph(fileContent);
    const glowNode = restored.nodes.find(n => n.id === 'glow1')!;

    // Resolved to the real thing, not the "Missing node" placeholder
    expect(glowNode.data.definition.id).toBe('custom_glow');
    expect('isCustom' in glowNode.data.definition).toBe(true);
    // And it's now in the recipient's own library for next time
    expect(getCustomNode('custom_glow')).not.toBeNull();

    const shader = compileGraphToGLSL(toGraphNodes(restored.nodes), restored.edges);
    if (glslangAvailable) {
      const result = validateWithGlslangValidator(shader, 'frag');
      expect(result.ok, result.output).toBe(true);
    }
  });

  it('does not overwrite a custom node the recipient already has under the same id', () => {
    const theirOwnVersion: CustomNodeDefinition = {
      ...buildGlowCustomNode(),
      description: 'This is MY version, not theirs',
    };
    addCustomNode(theirOwnVersion);
    (NODE_REGISTRY as Record<string, unknown>)['custom_glow'] = theirOwnVersion;

    const embedded = { ...buildGlowCustomNode(), description: 'Embedded from the file' };
    rehydrateGraph({
      nodes: [{ id: 'out1', data: { definition: { id: 'output' } } }],
      edges: [],
      customNodes: [embedded],
    });

    expect(getCustomNode('custom_glow')!.description).toBe('This is MY version, not theirs');
  });
});
