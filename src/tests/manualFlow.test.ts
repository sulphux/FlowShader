/**
 * REAL MANUAL TEST - najprostszy możliwy test flow
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NODE_REGISTRY } from '../nodes';
import { addCustomNode, loadCustomNodes, extractCustomNodePorts, type CustomNodeDefinition } from '../core/customNodeManager';
import type { Node } from 'reactflow';

describe('MANUAL FLOW TEST', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('UV (vec2) → Custom Input → detectedType MUST persist', () => {
    console.log('\n🔥 MANUAL TEST START\n');

    // Krok 1: Custom node z Custom Input
    let nodes: Node[] = [
      {
        id: 'custom_input-1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: {
          definition: NODE_REGISTRY['custom_input'],
          value: 'MyInput'
        }
      }
    ];

    console.log('KROK 1: Custom Input created');

    // Krok 2: Dodaj UV
    nodes.push({
      id: 'uv-1',
      type: 'shaderNode',
      position: { x: 200, y: 0 },
      data: {
        definition: NODE_REGISTRY['uv']
      }
    });

    console.log('KROK 2: UV node added');
    console.log('  UV outputs:', NODE_REGISTRY['uv'].outputs);

    // Krok 3: Symuluj onConnect - UV → Custom Input
    const uvNode = nodes.find(n => n.id === 'uv-1')!;
    const sourceType = uvNode.data.definition.outputs[0].type;
    
    console.log('KROK 3: Connecting UV → Custom Input');
    console.log('  Source type:', sourceType);
    
    expect(sourceType).toBe('vec2');

    // Krok 4: Set detectedType (jak robi onConnect)
    const customInputNode = nodes.find(n => n.id === 'custom_input-1')!;
    customInputNode.data.detectedType = sourceType;
    customInputNode.data.definition = {
      ...NODE_REGISTRY['custom_input'],
      outputs: [{ id: 'out', type: sourceType, label: 'Value' }]
    };

    console.log('KROK 4: detectedType set');
    console.log('  customInputNode.data.detectedType:', customInputNode.data.detectedType);
    console.log('  customInputNode.data.definition.outputs[0].type:', customInputNode.data.definition.outputs[0].type);

    expect(customInputNode.data.detectedType).toBe('vec2');
    expect(customInputNode.data.definition.outputs[0].type).toBe('vec2');

    // Krok 5: Extract ports (jak robi navigateBack)
    const ports = extractCustomNodePorts({ nodes });

    console.log('KROK 5: extractCustomNodePorts');
    console.log('  ports.inputs:', ports.inputs);

    expect(ports.inputs.length).toBe(1);
    console.log('  ⚠️ CRITICAL: ports.inputs[0].type =', ports.inputs[0].type, '(MUST be vec2!)');
    
    expect(ports.inputs[0].type).toBe('vec2');

    // Krok 6: Save custom node
    const customNodeDef: CustomNodeDefinition = {
      id: 'custom_test',
      label: 'Test',
      isCustom: true,
      compact: false,
      inputs: ports.inputs,
      outputs: [{ id: 'out', label: 'Out', type: 'auto' }],
      glslTemplate: () => 'vec3(1.0)',
      subgraph: { nodes, edges: [] }
    };

    addCustomNode(customNodeDef);

    console.log('KROK 6: Custom node saved');
    console.log('  customNodeDef.inputs[0].type:', customNodeDef.inputs[0].type);

    expect(customNodeDef.inputs[0].type).toBe('vec2');

    // Krok 7: Reload z localStorage
    const reloaded = loadCustomNodes();
    const reloadedDef = reloaded.find(n => n.id === 'custom_test')!;

    console.log('KROK 7: Reloaded from localStorage');
    console.log('  reloadedDef.inputs[0].type:', reloadedDef.inputs[0].type);

    expect(reloadedDef.inputs[0].type).toBe('vec2');

    // Krok 8: Check Custom Input w subgraph
    const reloadedCustomInput = reloadedDef.subgraph.nodes.find(n => n.id === 'custom_input-1')!;

    console.log('KROK 8: Custom Input w subgraph po reload');
    console.log('  detectedType:', reloadedCustomInput.data?.detectedType);
    console.log('  definition.outputs[0].type:', reloadedCustomInput.data?.definition?.outputs?.[0]?.type);

    expect(reloadedCustomInput.data?.detectedType).toBe('vec2');
    expect(reloadedCustomInput.data?.definition?.outputs?.[0]?.type).toBe('vec2');

    console.log('\n✅✅✅ TEST PASSED - vec2 persystuje!\n');
  });
});
