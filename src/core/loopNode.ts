import type { CustomNodeDefinition } from './customNodeManager';

export const LOOP_MAX_ITERATIONS = 2048;
export const LOOP_DEFAULT_ITERATIONS = 16;

const concreteNumericTypes = new Set(['float', 'vec2', 'vec3', 'vec4']);

export const clampLoopIterations = (value: unknown): number => {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return LOOP_DEFAULT_ITERATIONS;
  return Math.min(LOOP_MAX_ITERATIONS, Math.max(1, parsed));
};

/**
 * A visual Custom Node can act as one iteration of a Loop when its first
 * input/output are the state and the optional remaining inputs are scalar
 * Index and Progress values. A second scalar output is interpreted as Stop.
 */
export const loopStepCompatibilityError = (definition: CustomNodeDefinition): string | null => {
  if (definition.inputs.length < 1 || definition.inputs.length > 3) {
    return 'Step needs 1–3 inputs: State, optional Index and optional Progress.';
  }
  if (definition.outputs.length < 1 || definition.outputs.length > 2) {
    return 'Step needs Next State and optionally Stop.';
  }

  const stateInput = definition.inputs[0];
  const stateOutput = definition.outputs[0];
  if (!concreteNumericTypes.has(stateInput.type) || stateOutput.type !== stateInput.type) {
    return 'The first input and first output must have the same concrete numeric type.';
  }
  if (definition.inputs.slice(1).some(port => port.type !== 'float')) {
    return 'Index and Progress inputs must be float.';
  }
  if (definition.outputs[1] && definition.outputs[1].type !== 'float') {
    return 'The optional Stop output must be float.';
  }
  return null;
};

export const isCompatibleLoopStep = (definition: CustomNodeDefinition): boolean =>
  loopStepCompatibilityError(definition) === null;

export const loopStateType = (definition: CustomNodeDefinition): string =>
  definition.inputs[0]?.type || 'float';

