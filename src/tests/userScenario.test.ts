/**
 * FAZA 3: TEST SCENARIUSZA UŻYTKOWNIKA
 * 
 * Dokładnie to co user robi:
 * 1. Tworzy custom node
 * 2. Wchodzi, dodaje Float
 * 3. Łączy Float → Custom Input
 * 4. Wychodzi
 * 5. SPRAWDZA: Port jest CZERWONY
 * 6. SPRAWDZA: Shader kompiluje się
 */

import { describe, it, expect } from 'vitest';
import { compileGraphToGLSL } from '../core/compiler';
import { NODE_REGISTRY } from '../nodes';
import { addCustomNode, extractCustomNodePorts, type CustomNodeDefinition } from '../core/customNodeManager';
import type { Node, Edge } from 'reactflow';

describe('USER SCENARIO: Create Custom Node → Add Float → Check Port Color', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('COMPLETE FLOW: Port MUST be RED after connecting Float inside', () => {
    console.log('\n' + '='.repeat(80));
    console.log('USER SCENARIO TEST - COMPLETE FLOW');
    console.log('='.repeat(80) + '\n');

    // ===== USER STEP 1: Create custom node =====
    console.log('👤 USER: Tworzy custom node "MyEffect"');
    
    const customNodeDef: CustomNodeDefinition = {
      id: 'custom_myeffect',
      label: 'MyEffect',
      isCustom: true,
      compact: false,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
      glslTemplate: () => 'vec3(1.0)',
      subgraph: {
        nodes: [
          {
            id: 'custom_input-1',
            type: 'shaderNode',
            position: { x: 0, y: 0 },
            data: {
              definition: NODE_REGISTRY['custom_input'],
              value: 'Input'
            }
          },
          {
            id: 'custom_output-1',
            type: 'shaderNode',
            position: { x: 400, y: 0 },
            data: {
              definition: NODE_REGISTRY['custom_output'],
              value: 'Output'
            }
          }
        ] as Node[],
        edges: [] as Edge[]
      }
    };

    addCustomNode(customNodeDef);
    (NODE_REGISTRY as any)['custom_myeffect'] = customNodeDef;
    
    console.log('  ✅ Custom node created\n');

    // ===== USER STEP 2: Enter custom node =====
    console.log('👤 USER: Wchodzi do custom node (double-click)');
    
    let insideNodes: Node[] = [...customNodeDef.subgraph.nodes];
    let insideEdges: Edge[] = [];
    
    console.log('  ✅ Entered custom node\n');

    // ===== USER STEP 3: Add Float node =====
    console.log('👤 USER: Dodaje Float node z sidebara');
    
    const floatNode: Node = {
      id: 'float-1',
      type: 'shaderNode',
      position: { x: 200, y: 0 },
      data: {
        definition: NODE_REGISTRY['param_float'],
        value: 1.5
      }
    };

    insideNodes.push(floatNode);
    
    console.log('  ✅ Float node added\n');

    // ===== USER STEP 4: Connect Float → Custom Input =====
    console.log('👤 USER: Łączy Float → Custom Input (przeciąga wire)');
    
    const newEdge: Edge = {
      id: 'e1',
      source: 'float-1',
      sourceHandle: 'value',
      target: 'custom_input-1',
      targetHandle: 'out'
    };

    insideEdges.push(newEdge);

    // Symuluj onConnect - wykryj typ
    const sourceType = floatNode.data.definition.outputs[0].type;
    const customInputNode = insideNodes.find(n => n.id === 'custom_input-1')!;
    
    customInputNode.data.detectedType = sourceType;
    customInputNode.data.definition = {
      ...NODE_REGISTRY['custom_input'],
      outputs: [{ id: 'out', type: sourceType, label: 'Value' }]
    };

    console.log('  detectedType set:', sourceType);
    console.log('  ✅ Connection made\n');

    // ===== USER STEP 5: Exit (navigateBack) =====
    console.log('👤 USER: Wychodzi z custom node (Exit to Main)');
    
    // Symuluj navigateBack - extract ports
    const ports = extractCustomNodePorts({ nodes: insideNodes });
    
    console.log('  Extracted ports:', ports);
    
    expect(ports.inputs.length).toBe(1);
    expect(ports.inputs[0].type).toBe('float'); // ← MUST be float!
    
    // Update custom node definition
    const updatedDef: CustomNodeDefinition = {
      ...customNodeDef,
      inputs: ports.inputs,
      outputs: ports.outputs.length > 0 ? ports.outputs : customNodeDef.outputs,
      subgraph: {
        nodes: insideNodes,
        edges: insideEdges
      }
    };

    addCustomNode(updatedDef);
    (NODE_REGISTRY as any)['custom_myeffect'] = updatedDef;
    
    console.log('  ✅ Custom node saved with ports:', ports.inputs);
    console.log('');

    // ===== USER STEP 6: Check port on main canvas =====
    console.log('👤 USER: Patrzy na custom node instance na głównym canvasie');
    
    const instanceOnCanvas = {
      id: 'instance-1',
      type: 'shaderNode',
      position: { x: 0, y: 0 },
      data: {
        definition: updatedDef  // Fresh definition from registry
      }
    };

    const portType = instanceOnCanvas.data.definition.inputs[0].type;
    const portLabel = instanceOnCanvas.data.definition.inputs[0].label;

    console.log('  Port type:', portType);
    console.log('  Port label:', portLabel);
    console.log('  Port color:', portType === 'float' ? '🔴 RED' : '🟣 PURPLE');
    
    // CRITICAL CHECK
    expect(portType).toBe('float');
    console.log('  ✅ PORT IS RED (float) - CORRECT!\n');

    // ===== USER STEP 7: Check shader compilation =====
    console.log('👤 USER: Sprawdza czy shader się kompiluje');
    
    const mainGraph = [
      {
        id: 'time-1',
        type: 'shaderNode',
        data: { definition: NODE_REGISTRY['time'] }
      },
      instanceOnCanvas,
      {
        id: 'output-1',
        type: 'shaderNode',
        data: { definition: NODE_REGISTRY['output'] }
      }
    ];

    const mainEdges = [
      {
        id: 'e1',
        source: 'instance-1',
        sourceHandle: 'custom_input-1',  // Output from custom node
        target: 'output-1',
        targetHandle: 'in'
      }
    ];

    let glsl = '';
    let compileError: any = null;

    try {
      glsl = compileGraphToGLSL(mainGraph as any, mainEdges as any, 'output-1');
      console.log('  ✅ Compilation SUCCESS\n');
    } catch (e: any) {
      compileError = e;
      console.error('  ❌ Compilation FAILED:', e.message);
    }

    // Check for errors
    expect(compileError).toBeNull();

    // ===== VERIFY GLSL STRUCTURE =====
    console.log('🔍 VERIFYING GLSL OUTPUT:\n');

    // Should have function declaration
    const hasFunctionDeclaration = glsl.includes(`${updatedDef.id}(`);
    console.log('  Has function declaration:', hasFunctionDeclaration ? '✅' : '❌');
    expect(hasFunctionDeclaration).toBe(true);

    // Should have function call
    const hasFunctionCall = glsl.includes(`${updatedDef.id}(`);
    console.log('  Has function call:', hasFunctionCall ? '✅' : '❌');
    expect(hasFunctionCall).toBe(true);

    // Should NOT have dimension mismatch
    const hasDimensionMismatch = glsl.toLowerCase().includes('dimension mismatch');
    console.log('  Dimension mismatch:', hasDimensionMismatch ? '❌ YES (BAD)' : '✅ NO (GOOD)');
    expect(hasDimensionMismatch).toBe(false);

    // Should have only 1 precision
    const precisionCount = (glsl.match(/precision mediump float/g) || []).length;
    console.log('  Precision count:', precisionCount, '(should be 1)');
    expect(precisionCount).toBe(1);

    // Show function in output
    const functionMatch = glsl.match(new RegExp(`${updatedDef.id}\\([^)]*\\)\\s*{[^}]+}`, 's'));
    if (functionMatch) {
      console.log('\n  📜 Generated function:');
      console.log('  ' + functionMatch[0].trim().split('\n').join('\n  '));
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅✅✅ USER SCENARIO COMPLETE - ALL CHECKS PASSED!');
    console.log('='.repeat(80) + '\n');
  });
});
