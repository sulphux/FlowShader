import { compileGraphToGLSL, type GraphEdge, type GraphNode } from './compiler';
import { feedbackUniformName, isFeedbackNode } from './runtimeResources';
import { buildImpulseEventTokenGLSL } from './impulseTiming';
import type { ShaderNodeDefinition } from './types';

export interface FeedbackPassDefinition {
  nodeId: string;
  uniform: string;
  shader: string;
}

const outputDefinition: ShaderNodeDefinition = {
  id: 'output',
  label: 'Frame Buffer Pass Output',
  inputs: [{ id: 'color', label: 'Color + snapshot gate', type: 'vec4' }],
  outputs: [],
  glslTemplate: inputs => inputs.color || 'vec4(0.0)',
};

/**
 * Builds one off-screen shader per Feedback node. Each pass evaluates In from
 * the current graph while every Feedback output is a sampler containing its
 * previous snapshot. This is the multi-pass half of Feedback's semantics.
 */
export function compileFeedbackPasses(nodes: GraphNode[], edges: GraphEdge[]): FeedbackPassDefinition[] {
  return nodes.filter(isFeedbackNode).map(feedbackNode => {
    const uniform = feedbackUniformName(feedbackNode.id);
    const safeNodeId = feedbackNode.id.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+/, '') || 'node';
    const writerId = `feedback_writer_${safeNodeId}`;
    const outputId = `feedback_output_${safeNodeId}`;
    const eventTokenId = `feedback_event_${safeNodeId}`;

    const writerDefinition: ShaderNodeDefinition = {
      id: 'feedback_writer',
      label: 'Frame Buffer Writer',
      inputs: [
        { id: 'in', label: 'In', type: 'vec3' },
        { id: 'impulse', label: 'Snapshot', type: 'float' },
      ],
      outputs: [{ id: 'state', label: 'RGBA state', type: 'vec4' }],
      glslTemplate: inputs => {
        const nextValue = inputs.in || 'vec3(0.0)';
        // Alpha stores the previous trigger state. Ordinary Snapshot signals
        // retain 0 -> 1 semantics. Impulse connections are compiled to a
        // persistent event token >= 2 which changes once per interval, so a
        // narrow pulse cannot disappear between rendered frames.
        // With no Snapshot connection the documented behavior stays useful:
        // capture Image In every frame.
        if (!inputs.impulse) return `vec4(${nextValue}, 0.0)`;
        const previous = `texture2D(${uniform}, screenUv)`;
        const eventMode = `step(1.5, ${inputs.impulse})`;
        const snapshotHigh = `step(0.000001, ${inputs.impulse})`;
        const risingEdge = `((1.0 - ${eventMode}) * ${snapshotHigh} * (1.0 - step(0.000001, ${previous}.a)))`;
        const eventChanged = `(${eventMode} * step(0.000001, abs(${inputs.impulse} - ${previous}.a)))`;
        const capture = `max(${risingEdge}, ${eventChanged})`;
        const storedTrigger = `mix(${snapshotHigh}, ${inputs.impulse}, ${eventMode})`;
        return `vec4(mix(${previous}.rgb, ${nextValue}, ${capture}), ${storedTrigger})`;
      },
    };

    const writerNode: GraphNode = {
      id: writerId,
      type: 'shaderNode',
      data: { definition: writerDefinition },
    };
    const outputNode: GraphNode = {
      id: outputId,
      type: 'shaderNode',
      data: { definition: outputDefinition },
    };

    const passEdges: GraphEdge[] = [...edges];
    const passNodes: GraphNode[] = [...nodes, writerNode, outputNode];
    const inEdge = edges.find(edge => edge.target === feedbackNode.id && edge.targetHandle === 'in');
    const impulseEdge = edges.find(edge => edge.target === feedbackNode.id && edge.targetHandle === 'impulse');
    if (inEdge) passEdges.push({ ...inEdge, target: writerId, targetHandle: 'in' });
    if (impulseEdge) {
      const impulseNode = nodes.find(node => node.id === impulseEdge.source);
      if (impulseNode?.data?.definition?.id === 'impulse') {
        const tokenDefinition: ShaderNodeDefinition = {
          id: 'impulse_event_token',
          label: 'Latched Impulse Event',
          inputs: [{ id: 'interval', label: 'Interval', type: 'float' }],
          outputs: [{ id: 'token', label: 'Event token', type: 'float' }],
          glslTemplate: inputs => buildImpulseEventTokenGLSL(inputs.interval || '1.0'),
        };
        passNodes.push({
          id: eventTokenId,
          type: 'shaderNode',
          data: { definition: tokenDefinition },
        });
        const intervalEdge = edges.find(edge => edge.target === impulseNode.id && edge.targetHandle === 'interval');
        if (intervalEdge) passEdges.push({ ...intervalEdge, target: eventTokenId, targetHandle: 'interval' });
        passEdges.push({ source: eventTokenId, sourceHandle: 'token', target: writerId, targetHandle: 'impulse' });
      } else {
        passEdges.push({ ...impulseEdge, target: writerId, targetHandle: 'impulse' });
      }
    }
    passEdges.push({ source: writerId, sourceHandle: 'state', target: outputId, targetHandle: 'color' });

    return {
      nodeId: feedbackNode.id,
      uniform,
      shader: compileGraphToGLSL(passNodes, passEdges, outputId),
    };
  });
}
