/**
 * Regression tests for 5 bugs fixed in the custom node type detection system.
 *
 * Run: npx vitest run customNodeTypeBugs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { compileGraphToGLSL, type GraphNode, type GraphEdge } from '../core/compiler';
import { autoCast } from '../core/functionGenerator';
import { NODE_REGISTRY } from '../nodes';
import type { CustomNodeDefinition } from '../core/customNodeManager';
import type { ShaderNodeDefinition } from '../core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCustomNode(
  id: string,
  subgraphNodes: GraphNode[],
  subgraphEdges: GraphEdge[],
  inputs: { id: string; label: string; type: string }[],
  outputs: { id: string; label: string; type: string }[]
): CustomNodeDefinition {
  return {
    id,
    label: id,
    description: '',
    compact: false,
    isCustom: true,
    inputs,
    outputs,
    subgraph: { nodes: subgraphNodes as never, edges: subgraphEdges as never },
    glslTemplate: () => 'vec3(0.0)',
  };
}

// ---------------------------------------------------------------------------
// Bug 1 fix: custom_output detectedType is read from node.data.detectedType
// and from definition.inputs[0].type after the correct onConnect fires.
// We test at the compiler level: custom_output node with detectedType='float'
// causes the subgraph function to return float.
// ---------------------------------------------------------------------------

describe('Bug 1 – Custom Output type drives GLSL return type', () => {
  it('returns float when custom_output.detectedType = float', () => {
    const customOutputNode: GraphNode = {
      id: 'cout1',
      type: 'shaderNode',
      data: {
        definition: {
          ...NODE_REGISTRY['custom_output'],
          inputs: [{ id: 'in', type: 'float', label: 'Value' }],
        },
        detectedType: 'float',
      },
    };

    const customInputNode: GraphNode = {
      id: 'cin1',
      type: 'shaderNode',
      data: {
        definition: {
          ...NODE_REGISTRY['custom_input'],
          outputs: [{ id: 'out', type: 'float', label: 'Value' }],
        },
        detectedType: 'float',
      },
    };

    const subgraphEdge: GraphEdge = {
      source: 'cin1',
      target: 'cout1',
      sourceHandle: 'out',
      targetHandle: 'in',
    };

    const customDef = makeCustomNode(
      'custom_float_passthrough',
      [customInputNode, customOutputNode],
      [subgraphEdge],
      [{ id: 'cin1', label: 'In', type: 'float' }],
      [{ id: 'cout1', label: 'Out', type: 'float' }]
    );

    const mainNodes: GraphNode[] = [
      { id: 'cn1', type: 'shaderNode', data: { definition: customDef } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
    ];

    const mainEdges: GraphEdge[] = [
      { source: 'cn1', target: 'out1', sourceHandle: 'cout1', targetHandle: 'color' },
    ];

    const glsl = compileGraphToGLSL(mainNodes, mainEdges);

    // The GLSL function should declare 'float custom_float_passthrough(float ...)'
    expect(glsl).toContain('float custom_float_passthrough(');
  });
});

// ---------------------------------------------------------------------------
// Bug 2 fix: custom_input type is inferred from its downstream connection.
// We test that when a custom_input node has detectedType='vec3', the
// function parameter is declared as vec3.
// ---------------------------------------------------------------------------

describe('Bug 2 – Custom Input detectedType drives GLSL parameter type', () => {
  it('declares vec3 parameter when custom_input.detectedType = vec3', () => {
    const customInputNode: GraphNode = {
      id: 'cin_vec3',
      type: 'shaderNode',
      data: {
        definition: {
          ...NODE_REGISTRY['custom_input'],
          outputs: [{ id: 'out', type: 'vec3', label: 'Value' }],
        },
        detectedType: 'vec3',
      },
    };

    const customOutputNode: GraphNode = {
      id: 'cout_vec3',
      type: 'shaderNode',
      data: {
        definition: {
          ...NODE_REGISTRY['custom_output'],
          inputs: [{ id: 'in', type: 'vec3', label: 'Value' }],
        },
        detectedType: 'vec3',
      },
    };

    const subgraphEdge: GraphEdge = {
      source: 'cin_vec3',
      target: 'cout_vec3',
      sourceHandle: 'out',
      targetHandle: 'in',
    };

    const customDef = makeCustomNode(
      'custom_vec3_passthrough',
      [customInputNode, customOutputNode],
      [subgraphEdge],
      [{ id: 'cin_vec3', label: 'Color', type: 'vec3' }],
      [{ id: 'cout_vec3', label: 'Out', type: 'vec3' }]
    );

    const mainNodes: GraphNode[] = [
      { id: 'cn1', type: 'shaderNode', data: { definition: customDef } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
    ];

    const mainEdges: GraphEdge[] = [
      { source: 'cn1', target: 'out1', sourceHandle: 'cout_vec3', targetHandle: 'color' },
    ];

    const glsl = compileGraphToGLSL(mainNodes, mainEdges);

    expect(glsl).toContain('vec3 custom_vec3_passthrough(');
    expect(glsl).toContain('vec3 cin_vec3');
  });
});

// ---------------------------------------------------------------------------
// Bug 3 fix: node IDs with hyphens must be sanitized to underscores in GLSL.
// ---------------------------------------------------------------------------

describe('Bug 3 – GLSL identifier sanitization (hyphens → underscores)', () => {
  it('produces valid GLSL identifiers when node ID contains hyphens', () => {
    const hyphenId = 'cin-abc-123';

    const customInputNode: GraphNode = {
      id: hyphenId,
      type: 'shaderNode',
      data: {
        definition: {
          ...NODE_REGISTRY['custom_input'],
          outputs: [{ id: 'out', type: 'float', label: 'Value' }],
        },
        detectedType: 'float',
      },
    };

    const customOutputNode: GraphNode = {
      id: 'cout-xyz',
      type: 'shaderNode',
      data: {
        definition: {
          ...NODE_REGISTRY['custom_output'],
          inputs: [{ id: 'in', type: 'float', label: 'Value' }],
        },
        detectedType: 'float',
      },
    };

    const subgraphEdge: GraphEdge = {
      source: hyphenId,
      target: 'cout-xyz',
      sourceHandle: 'out',
      targetHandle: 'in',
    };

    const customDef = makeCustomNode(
      'custom_hyphen_test',
      [customInputNode, customOutputNode],
      [subgraphEdge],
      [{ id: hyphenId, label: 'In', type: 'float' }],
      [{ id: 'cout-xyz', label: 'Out', type: 'float' }]
    );

    const mainNodes: GraphNode[] = [
      { id: 'cn1', type: 'shaderNode', data: { definition: customDef } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
    ];

    const mainEdges: GraphEdge[] = [
      { source: 'cn1', target: 'out1', sourceHandle: 'cout-xyz', targetHandle: 'color' },
    ];

    const glsl = compileGraphToGLSL(mainNodes, mainEdges);

    // Must not contain a hyphenated identifier
    expect(glsl).not.toMatch(/\bcin-abc-123\b/);
    // Must contain the sanitized version
    expect(glsl).toContain('cin_abc_123');
    // Must not contain a hyphenated output variable either
    expect(glsl).not.toMatch(/var_cout-xyz/);
    expect(glsl).toContain('var_cout_xyz');
  });
});

// ---------------------------------------------------------------------------
// Bug 4 fix: collectCustomNodes must not loop when a custom node references
// itself (or when the same type appears multiple times).
// ---------------------------------------------------------------------------

describe('Bug 4 – Recursion guard in collectCustomNodes', () => {
  it('does not loop when the same custom node type appears multiple times', () => {
    // Build a custom node definition that appears twice in the main graph
    const ciNode: GraphNode = {
      id: 'ci_dup',
      type: 'shaderNode',
      data: { definition: NODE_REGISTRY['custom_input'], detectedType: 'vec3' },
    };
    const coNode: GraphNode = {
      id: 'co_dup',
      type: 'shaderNode',
      data: {
        definition: {
          ...NODE_REGISTRY['custom_output'],
          inputs: [{ id: 'in', type: 'vec3', label: 'Value' }],
        },
        detectedType: 'vec3',
      },
    };
    const customDef = makeCustomNode(
      'custom_dup',
      [ciNode, coNode],
      [{ source: 'ci_dup', target: 'co_dup', sourceHandle: 'out', targetHandle: 'in' }],
      [{ id: 'ci_dup', label: 'In', type: 'vec3' }],
      [{ id: 'co_dup', label: 'Out', type: 'vec3' }]
    );

    // Two instances of the SAME custom node
    const mainNodes: GraphNode[] = [
      { id: 'inst1', type: 'shaderNode', data: { definition: customDef } },
      { id: 'inst2', type: 'shaderNode', data: { definition: customDef } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
    ];

    const mainEdges: GraphEdge[] = [
      { source: 'inst2', target: 'out1', sourceHandle: 'co_dup', targetHandle: 'color' },
    ];

    // Should complete without hanging — the function should only appear ONCE
    const glsl = compileGraphToGLSL(mainNodes, mainEdges);

    const functionCount = (glsl.match(/vec3 custom_dup\s*\(/g) || []).length;
    expect(functionCount).toBe(1);
  });

  it('does not infinite-loop when a custom node subgraph contains itself', () => {
    // Create a self-referencing custom node by injecting a circular subgraph reference.
    // After the fix, processedCustomNodes prevents re-entry.
    const selfRefDef: CustomNodeDefinition = {
      id: 'custom_self',
      label: 'SelfRef',
      description: '',
      compact: false,
      isCustom: true,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
      subgraph: { nodes: [], edges: [] },
      glslTemplate: () => 'vec3(0.0)',
    };

    // Inject itself as a child — this would cause infinite recursion before the fix
    (selfRefDef.subgraph.nodes as unknown[]).push({
      id: 'self_child',
      type: 'shaderNode',
      data: { definition: selfRefDef },
    });

    const mainNodes: GraphNode[] = [
      { id: 'inst_self', type: 'shaderNode', data: { definition: selfRefDef } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
    ];

    // The compiler should return (not hang) and produce a valid shader string
    const glsl = compileGraphToGLSL(mainNodes, []);
    expect(typeof glsl).toBe('string');
    expect(glsl).toContain('void main()');
  });
});

// ---------------------------------------------------------------------------
// Bug 5 fix: autoCast() and the inline casting block must produce identical
// results. After the fix there is only autoCast(), so this tests that
// autoCast() handles all type pairs correctly.
// ---------------------------------------------------------------------------

describe('Bug 5 – autoCast covers all type conversions', () => {
  const cases: [string, string, string, string][] = [
    ['x', 'float', 'vec2',  'vec2(x)'],
    ['x', 'float', 'vec3',  'vec3(x)'],
    ['x', 'float', 'vec4',  'vec4(x)'],
    ['v', 'vec2',  'float', '(v).x'],
    ['v', 'vec3',  'float', '(v).x'],
    ['v', 'vec4',  'float', '(v).x'],
    ['v', 'vec2',  'vec3',  'vec3(v, 0.0)'],
    ['v', 'vec3',  'vec2',  '(v).xy'],
    ['v', 'vec3',  'vec4',  'vec4(v, 1.0)'],
    ['v', 'vec4',  'vec3',  '(v).xyz'],
  ];

  cases.forEach(([expr, from, to, expected]) => {
    it(`autoCast ${from} → ${to} produces "${expected}"`, () => {
      expect(autoCast(expr, from, to)).toBe(expected);
    });
  });

  it('same-type cast is identity (no wrapping)', () => {
    expect(autoCast('myVar', 'float', 'float')).toBe('myVar');
    expect(autoCast('myVar', 'vec3', 'vec3')).toBe('myVar');
  });
});

// ---------------------------------------------------------------------------
// Bug 6 fix: 'auto' type must never appear in GLSL function signatures.
// When ports have type 'auto' (not yet resolved), the generator must fall
// back to 'vec3'.
// ---------------------------------------------------------------------------

describe('Bug 6 – auto type not emitted in GLSL function signatures', () => {
  it('uses vec3 fallback when custom_input/output have type auto', () => {
    const cinAuto: GraphNode = {
      id: 'cin_auto',
      type: 'shaderNode',
      data: {
        definition: NODE_REGISTRY['custom_input'], // type: auto
        // no detectedType set — fresh node
      },
    };

    const coutAuto: GraphNode = {
      id: 'cout_auto',
      type: 'shaderNode',
      data: {
        definition: NODE_REGISTRY['custom_output'], // type: auto
        // no detectedType set
      },
    };

    const customDef = makeCustomNode(
      'custom_auto_test',
      [cinAuto, coutAuto],
      [{ source: 'cin_auto', target: 'cout_auto', sourceHandle: 'out', targetHandle: 'in' }],
      [{ id: 'cin_auto', label: 'In', type: 'auto' }],
      [{ id: 'cout_auto', label: 'Out', type: 'auto' }]
    );

    const mainNodes: GraphNode[] = [
      { id: 'cn1', type: 'shaderNode', data: { definition: customDef } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
    ];

    const glsl = compileGraphToGLSL(mainNodes, []);

    // 'auto' must never appear anywhere in the GLSL output
    expect(glsl).not.toContain(' auto ');
    expect(glsl).not.toMatch(/\bauto\b/);

    // The function should use vec3 as fallback
    expect(glsl).toContain('vec3 custom_auto_test(');
    expect(glsl).toContain('vec3 cin_auto');
  });
});

// ---------------------------------------------------------------------------
// Bug 7 fix: CustomInput glslTemplate must return a type-appropriate
// placeholder so the live preview inside a subgraph doesn't produce a
// dimension mismatch (e.g. float var = vec3(0.5)).
// ---------------------------------------------------------------------------

describe('Bug 7 – CustomInput glslTemplate returns correct type placeholder', () => {
  it('returns 0.0 for detectedType=float', () => {
    const glslFn = NODE_REGISTRY['custom_input'].glslTemplate;
    expect(glslFn({}, { detectedType: 'float' })).toBe('0.0');
  });

  it('returns vec2(0.5) for detectedType=vec2', () => {
    const glslFn = NODE_REGISTRY['custom_input'].glslTemplate;
    expect(glslFn({}, { detectedType: 'vec2' })).toBe('vec2(0.5)');
  });

  it('returns vec3(0.5) for detectedType=vec3', () => {
    const glslFn = NODE_REGISTRY['custom_input'].glslTemplate;
    expect(glslFn({}, { detectedType: 'vec3' })).toBe('vec3(0.5)');
  });

  it('returns vec3(0.5) for auto/undefined detectedType', () => {
    const glslFn = NODE_REGISTRY['custom_input'].glslTemplate;
    expect(glslFn({}, {})).toBe('vec3(0.5)');
    expect(glslFn({}, { detectedType: 'auto' })).toBe('vec3(0.5)');
  });

  it('no dimension mismatch: float nodeType gets float placeholder', () => {
    // Simulate the inner-subgraph compilation: custom_input with detectedType=float
    // connected to math_add (which expects float inputs)
    const cinNode: GraphNode = {
      id: 'cin1',
      type: 'shaderNode',
      data: {
        definition: {
          ...NODE_REGISTRY['custom_input'],
          outputs: [{ id: 'out', type: 'float', label: 'Value' }],
        },
        detectedType: 'float',
      },
    };

    const addNode: GraphNode = {
      id: 'add1',
      type: 'shaderNode',
      data: { definition: NODE_REGISTRY['math_add'] },
    };

    const outNode: GraphNode = {
      id: 'out1',
      type: 'shaderNode',
      data: { definition: NODE_REGISTRY['output'] },
    };

    const edges: GraphEdge[] = [
      { source: 'cin1', target: 'add1', sourceHandle: 'out', targetHandle: 'a' },
      { source: 'add1', target: 'out1', sourceHandle: 'out', targetHandle: 'color' },
    ];

    const glsl = compileGraphToGLSL([cinNode, addNode, outNode], edges);

    // The custom_input variable must be declared as float, not vec3
    expect(glsl).toContain('float var_cin1 = 0.0');
    // Must not attempt float var = vec3(...)
    expect(glsl).not.toMatch(/float\s+var_cin1\s*=\s*vec3/);
  });
});

// ---------------------------------------------------------------------------
// Bug B fix: call-site defaults must match parameter type.
// Before fix: unconnected vec3 param → '0.0' (float) → "no matching overload".
// After fix:  unconnected vec3 param → 'vec3(0.0)'.
// ---------------------------------------------------------------------------

describe('Bug B – Type-appropriate default values at custom node call site', () => {
  function makeCustomNodeWithInputType(inputType: string): CustomNodeDefinition {
    const cinNode: GraphNode = {
      id: 'cin1',
      type: 'shaderNode',
      data: {
        definition: {
          ...NODE_REGISTRY['custom_input'],
          outputs: [{ id: 'out', type: inputType, label: 'Value' }],
        },
        detectedType: inputType,
      },
    };
    const coutNode: GraphNode = {
      id: 'cout1',
      type: 'shaderNode',
      data: {
        definition: NODE_REGISTRY['custom_output'],
        detectedType: inputType,
      },
    };
    return makeCustomNode(
      `custom_type_${inputType}`,
      [cinNode, coutNode],
      [{ source: 'cin1', target: 'cout1', sourceHandle: 'out', targetHandle: 'in' }],
      [{ id: 'cin1', label: 'In', type: inputType }],
      [{ id: 'cout1', label: 'Out', type: inputType }]
    );
  }

  it('uses vec3(0.0) as default for unconnected vec3 input', () => {
    const customDef = makeCustomNodeWithInputType('vec3');
    (NODE_REGISTRY as Record<string, ShaderNodeDefinition>)[customDef.id] = customDef;

    const mainNodes: GraphNode[] = [
      { id: 'cn1', type: 'shaderNode', data: { definition: customDef } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
    ];
    const glsl = compileGraphToGLSL(mainNodes, []);

    // Call must use vec3(0.0), not 0.0
    expect(glsl).toContain(`custom_type_vec3(vec3(0.0))`);
    expect(glsl).not.toContain(`custom_type_vec3(0.0)`);
  });

  it('uses 0.0 as default for unconnected float input', () => {
    const customDef = makeCustomNodeWithInputType('float');
    (NODE_REGISTRY as Record<string, ShaderNodeDefinition>)[customDef.id] = customDef;

    const mainNodes: GraphNode[] = [
      { id: 'cn2', type: 'shaderNode', data: { definition: customDef } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
    ];
    const glsl = compileGraphToGLSL(mainNodes, []);

    expect(glsl).toContain(`custom_type_float(0.0)`);
    expect(glsl).not.toContain(`custom_type_float(vec3`);
  });

  it('uses vec2(0.0) as default for unconnected vec2 input', () => {
    const customDef = makeCustomNodeWithInputType('vec2');
    (NODE_REGISTRY as Record<string, ShaderNodeDefinition>)[customDef.id] = customDef;

    const mainNodes: GraphNode[] = [
      { id: 'cn3', type: 'shaderNode', data: { definition: customDef } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
    ];
    const glsl = compileGraphToGLSL(mainNodes, []);

    expect(glsl).toContain(`custom_type_vec2(vec2(0.0))`);
  });
});

// ---------------------------------------------------------------------------
// Feature D: compilation guard — custom nodes with empty / unresolvable
// subgraphs must be silently skipped rather than emitting broken GLSL.
// ---------------------------------------------------------------------------

describe('Feature D – Compilation guard skips unready custom nodes', () => {
  it('does not emit a call for a custom node with empty subgraph', () => {
    const emptyDef = makeCustomNode(
      'custom_empty_guard',
      [], // empty subgraph — no nodes at all
      [],
      [{ id: 'in1', label: 'In', type: 'vec3' }],
      [{ id: 'out1', label: 'Out', type: 'vec3' }]
    );
    (NODE_REGISTRY as Record<string, ShaderNodeDefinition>)[emptyDef.id] = emptyDef;

    const mainNodes: GraphNode[] = [
      { id: 'cn_empty', type: 'shaderNode', data: { definition: emptyDef } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
    ];

    // Should compile without throwing and produce no call to the unready node
    const glsl = compileGraphToGLSL(mainNodes, []);
    expect(glsl).not.toContain('custom_empty_guard(');
  });

  it('does not emit a function declaration for an empty subgraph', () => {
    const emptyDef = makeCustomNode(
      'custom_no_func',
      [],
      [],
      [],
      [{ id: 'out1', label: 'Out', type: 'vec3' }]
    );
    (NODE_REGISTRY as Record<string, ShaderNodeDefinition>)[emptyDef.id] = emptyDef;

    const mainNodes: GraphNode[] = [
      { id: 'cn_nf', type: 'shaderNode', data: { definition: emptyDef } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
    ];

    const glsl = compileGraphToGLSL(mainNodes, []);
    // No function declaration should appear
    expect(glsl).not.toMatch(/custom_no_func\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// Root cause fix: fresh custom node (no selected nodes) used to emit
//   vec3 fn(vec3 param) { ... }   ← declared with 1 parameter (from subgraph)
//   fn()                          ← called with 0 arguments (from customDef.inputs=[])
// This is because extractCustomNodePorts was called on selectedNodes=[]
// BEFORE defaultSubgraphNodes was built, so customDef.inputs was always empty.
// After the fix, both declaration and call use customDef.inputs as one source of truth.
// ---------------------------------------------------------------------------

describe('Arg-count mismatch fix – declaration and call site must agree', () => {
  it('function declaration param count equals call site arg count for auto-typed node', () => {
    // Simulate a freshly-created custom node: customDef.inputs has 1 entry with type 'auto'
    const freshDef = makeCustomNode(
      'custom_fresh_argcount',
      [
        { id: 'custom_input_default', type: 'shaderNode', data: { definition: NODE_REGISTRY['custom_input'] } } as GraphNode,
        { id: 'custom_output_default', type: 'shaderNode', data: { definition: NODE_REGISTRY['custom_output'] } } as GraphNode,
      ],
      [],
      [{ id: 'custom_input_default', label: 'Input', type: 'auto' }],  // 1 input (after Fix 1)
      [{ id: 'custom_output_default', label: 'Output', type: 'auto' }]
    );
    (NODE_REGISTRY as Record<string, ShaderNodeDefinition>)[freshDef.id] = freshDef;

    const mainNodes: GraphNode[] = [
      { id: 'cn_fresh', type: 'shaderNode', data: { definition: freshDef } },
      { id: 'out1', type: 'shaderNode', data: { definition: NODE_REGISTRY['output'] } },
    ];

    const glsl = compileGraphToGLSL(mainNodes, []);

    // Function declared with exactly 1 vec3 parameter (auto → vec3)
    expect(glsl).toContain('vec3 custom_fresh_argcount(vec3 custom_input_default)');
    // Call site must use exactly 1 argument (vec3(0.0) for auto-typed param)
    expect(glsl).toContain('custom_fresh_argcount(vec3(0.0))');
    // Must NOT call with 0 arguments
    expect(glsl).not.toContain('custom_fresh_argcount()');
  });
});
