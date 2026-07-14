import { beforeEach, describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import { compileGraphToGLSL, type GraphNode } from '../core/compiler';
import { saveCustomNodes, type CustomNodeDefinition } from '../core/customNodeManager';
import { rehydrateGraph, serializeGraph } from '../core/graphRehydration';
import { NODE_REGISTRY } from '../nodes';
import { validateWithGlslangValidator } from './utils/glslangValidate';

const validate = (shader: string) => {
  const result = validateWithGlslangValidator(shader, 'frag');
  expect(result.ok, `${result.output}\n${shader}`).toBe(true);
};

const inputNode = (id: string, y: number, label: string): Node => ({
  id,
  type: 'shaderNode',
  position: { x: 0, y },
  data: {
    value: label,
    forcedType: 'float',
    definition: { ...NODE_REGISTRY.custom_input, outputs: [{ id: 'out', label: 'Value', type: 'float' }] },
  },
});

const outputNode = (id: string, y: number, label: string): Node => ({
  id,
  type: 'shaderNode',
  position: { x: 400, y },
  data: {
    value: label,
    forcedType: 'float',
    definition: { ...NODE_REGISTRY.custom_output, inputs: [{ id: 'in', label: 'Value', type: 'float' }] },
  },
});

const createStep = (withStop = false): CustomNodeDefinition => {
  const nodes: Node[] = [
    inputNode('state', 0, 'State'),
    inputNode('index', 100, 'Index'),
    inputNode('progress', 200, 'Progress'),
    {
      id: 'increment', type: 'shaderNode', position: { x: 200, y: 0 },
      data: { definition: NODE_REGISTRY.param_float, value: 0.1 },
    },
    {
      id: 'add', type: 'shaderNode', position: { x: 300, y: 0 },
      data: { definition: NODE_REGISTRY.math_add },
    },
    outputNode('next', 0, 'Next State'),
    ...(withStop ? [outputNode('stop', 100, 'Stop')] : []),
  ];
  const edges = [
    { id: 'state-add', source: 'state', sourceHandle: 'out', target: 'add', targetHandle: 'a' },
    { id: 'increment-add', source: 'increment', sourceHandle: 'out', target: 'add', targetHandle: 'b' },
    { id: 'add-next', source: 'add', sourceHandle: 'out', target: 'next', targetHandle: 'in' },
    ...(withStop ? [{ id: 'progress-stop', source: 'progress', sourceHandle: 'out', target: 'stop', targetHandle: 'in' }] : []),
  ];

  return {
    id: withStop ? 'custom_loop_step_stop' : 'custom_loop_step_add',
    label: withStop ? 'Loop Step Stop' : 'Loop Step Add',
    isCustom: true,
    inputs: [
      { id: 'state', label: 'State', type: 'float' },
      { id: 'index', label: 'Index', type: 'float' },
      { id: 'progress', label: 'Progress', type: 'float' },
    ],
    outputs: [
      { id: 'next', label: 'Next State', type: 'float' },
      ...(withStop ? [{ id: 'stop', label: 'Stop', type: 'float' }] : []),
    ],
    subgraph: { nodes, edges },
    glslTemplate: () => '0.0',
  };
};

describe('Loop / Iterate node', () => {
  beforeEach(() => localStorage.clear());

  it('compiles a visual Step custom node into a bounded GLSL for-loop', () => {
    const step = createStep();
    saveCustomNodes([step]);
    const loopDefinition = {
      ...NODE_REGISTRY.loop_iterate,
      inputs: [{ id: 'initial', label: 'Initial State', type: 'float' }],
      outputs: [{ id: 'result', label: 'Final State', type: 'float' }],
    };
    const nodes: GraphNode[] = [
      { id: 'initial', type: 'shaderNode', data: { definition: NODE_REGISTRY.param_float, value: 0 } },
      { id: 'loop', type: 'shaderNode', data: { definition: loopDefinition, iterations: 10, loopStepId: step.id } },
      { id: 'out', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'initial', sourceHandle: 'out', target: 'loop', targetHandle: 'initial' },
      { source: 'loop', sourceHandle: 'result', target: 'out', targetHandle: 'color' },
    ]);

    expect(shader).toContain('for (int loop_loop_i = 0; loop_loop_i < 10; loop_loop_i++)');
    expect(shader).toContain('var_loop_state = custom_loop_step_add(var_loop_state, float(loop_loop_i), (float(loop_loop_i) / 9.0));');
    validate(shader);
  });

  it('uses an optional scalar Stop output before updating the next state', () => {
    const step = createStep(true);
    saveCustomNodes([step]);
    const nodes: GraphNode[] = [
      { id: 'loop', type: 'shaderNode', data: { definition: NODE_REGISTRY.loop_iterate, iterations: 4, loopStepId: step.id } },
      { id: 'out', type: 'shaderNode', data: { definition: NODE_REGISTRY.output } },
    ];
    const shader = compileGraphToGLSL(nodes, [
      { source: 'loop', sourceHandle: 'result', target: 'out', targetHandle: 'color' },
    ]);

    const stopIndex = shader.indexOf('if (custom_loop_step_stop_o_stop(');
    const updateIndex = shader.indexOf('var_loop_state = custom_loop_step_stop(');
    expect(stopIndex).toBeGreaterThan(0);
    expect(updateIndex).toBeGreaterThan(stopIndex);
    validate(shader);
  });

  it('persists the selected Step, iteration count and adapted state ports', () => {
    const loop = {
      id: 'loop', type: 'shaderNode', position: { x: 0, y: 0 },
      data: {
        definition: {
          ...NODE_REGISTRY.loop_iterate,
          inputs: [{ id: 'initial', label: 'Initial State', type: 'vec3' }],
          outputs: [{ id: 'result', label: 'Final State', type: 'vec3' }],
        },
        iterations: 128,
        loopStepId: 'custom_vec_step',
      },
    } as Node;
    const restored = rehydrateGraph(serializeGraph([loop], []));

    expect(restored.nodes[0].data.iterations).toBe(128);
    expect(restored.nodes[0].data.loopStepId).toBe('custom_vec_step');
    expect(restored.nodes[0].data.definition.inputs[0].type).toBe('vec3');
    expect(restored.nodes[0].data.definition.outputs[0].type).toBe('vec3');
  });
});

