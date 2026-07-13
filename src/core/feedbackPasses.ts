import { compileGraphToGLSL, type GraphEdge, type GraphNode } from './compiler';
import { feedbackUniformName, isFeedbackNode } from './runtimeResources';
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
        // Alpha stores whether Snapshot was HIGH in the previous frame. This
        // turns a pulse of any width into one write on its 0 -> 1 edge; while
        // it remains HIGH, RGB is retained instead of being processed again.
        // With no Snapshot connection the documented behavior stays useful:
        // capture Image In every frame.
        if (!inputs.impulse) return `vec4(${nextValue}, 0.0)`;
        const previous = `texture2D(${uniform}, screenUv)`;
        const snapshotHigh = `step(0.000001, ${inputs.impulse})`;
        const risingEdge = `(${snapshotHigh} * (1.0 - step(0.000001, ${previous}.a)))`;
        return `vec4(mix(${previous}.rgb, ${nextValue}, ${risingEdge}), ${snapshotHigh})`;
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
    const inEdge = edges.find(edge => edge.target === feedbackNode.id && edge.targetHandle === 'in');
    const impulseEdge = edges.find(edge => edge.target === feedbackNode.id && edge.targetHandle === 'impulse');
    if (inEdge) passEdges.push({ ...inEdge, target: writerId, targetHandle: 'in' });
    if (impulseEdge) passEdges.push({ ...impulseEdge, target: writerId, targetHandle: 'impulse' });
    passEdges.push({ source: writerId, sourceHandle: 'state', target: outputId, targetHandle: 'color' });

    return {
      nodeId: feedbackNode.id,
      uniform,
      shader: compileGraphToGLSL([...nodes, writerNode, outputNode], passEdges, outputId),
    };
  });
}
