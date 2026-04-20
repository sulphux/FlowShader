import type { ShaderNodeDefinition } from './types';
import type { Node, Edge } from 'reactflow';
import { NODE_REGISTRY } from '../nodes';

export interface CustomNodeDefinition extends ShaderNodeDefinition {
  isCustom: true;
  subgraph: {
    nodes: Node[];
    edges: Edge[];
  };
}

const CUSTOM_NODES_KEY = 'custom_nodes_library';

/**
 * Load all custom nodes from localStorage
 */
export function loadCustomNodes(): CustomNodeDefinition[] {
  try {
    const stored = localStorage.getItem(CUSTOM_NODES_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    
    // Restore functions and definitions lost during JSON serialization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return parsed.map((customNode: any) => ({
      ...customNode,
      // Restore glslTemplate (functions can't be serialized to JSON)
      glslTemplate: () => {
        // Placeholder - actual compilation happens via recursive subgraph in compiler.ts
        return 'vec3(1.0, 0.0, 1.0)';
      },
      subgraph: {
        ...customNode.subgraph,
        // Restore full node definitions from NODE_REGISTRY
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodes: customNode.subgraph.nodes.map((node: any) => {
          const defId = node.data?.definition?.id;
          const freshDef = defId ? NODE_REGISTRY[defId as keyof typeof NODE_REGISTRY] : undefined;
          
          return {
            ...node,
            data: {
              ...node.data,
              // Use fresh definition from registry (has glslTemplate function)
              // BUT preserve detectedType for Custom Input/Output nodes
              definition: freshDef ? {
                ...freshDef,
                // Preserve detected type from saved node data
                ...(defId === 'custom_input' && node.data.detectedType ? {
                  outputs: [{ id: 'out', type: node.data.detectedType, label: 'Value' }]
                } : {}),
                ...(defId === 'custom_output' && node.data.detectedType ? {
                  inputs: [{ id: 'in', type: node.data.detectedType, label: 'Value' }]
                } : {})
              } : node.data.definition
            }
          };
        })
      }
    }));
  } catch (err) {
    console.error('Error loading custom nodes:', err);
    return [];
  }
}

/**
 * Save all custom nodes to localStorage
 */
export function saveCustomNodes(customNodes: CustomNodeDefinition[]): void {
  try {
    localStorage.setItem(CUSTOM_NODES_KEY, JSON.stringify(customNodes, null, 2));
  } catch (err) {
    console.error('Error saving custom nodes:', err);
  }
}

/**
 * Add a new custom node to the library
 */
export function addCustomNode(customNode: CustomNodeDefinition): void {
  const existing = loadCustomNodes();
  const updated = existing.filter(n => n.id !== customNode.id);
  updated.push(customNode);
  
  console.log('💾 Saving custom node to localStorage:', {
    nodeId: customNode.id,
    subgraphNodesCount: customNode.subgraph.nodes.length,
    firstNodeDetectedType: customNode.subgraph.nodes[0]?.data?.detectedType,
    inputs: customNode.inputs,
    outputs: customNode.outputs
  });
  
  saveCustomNodes(updated);
  
  // Verify it was saved correctly
  const reloaded = loadCustomNodes().find(n => n.id === customNode.id);
  console.log('✅ Verified reload:', {
    found: !!reloaded,
    firstNodeDetectedType: reloaded?.subgraph.nodes[0]?.data?.detectedType
  });
}

/**
 * Delete a custom node from the library
 */
export function deleteCustomNode(nodeId: string): void {
  const existing = loadCustomNodes();
  const updated = existing.filter(n => n.id !== nodeId);
  saveCustomNodes(updated);
}

/**
 * Get a custom node by ID
 */
export function getCustomNode(nodeId: string): CustomNodeDefinition | null {
  const customNodes = loadCustomNodes();
  return customNodes.find(n => n.id === nodeId) || null;
}

/**
 * Extract inputs and outputs from Custom Input/Output nodes in subgraph
 */
export function extractCustomNodePorts(subgraph: { nodes: Node[] }): {
  inputs: Array<{ id: string; label: string; type: string }>;
  outputs: Array<{ id: string; label: string; type: string }>;
} {
  const inputs: Array<{ id: string; label: string; type: string }> = [];
  const outputs: Array<{ id: string; label: string; type: string }> = [];

  subgraph.nodes.forEach(node => {
    // Defensive: Check if node.data exists
    if (!node.data) {
      return;
    }
    
    // Check for Custom Input - by definition.id OR by node.id prefix (fallback)
    const isCustomInput = node.data.definition?.id === 'custom_input' || node.id.startsWith('custom_input');
    const isCustomOutput = node.data.definition?.id === 'custom_output' || node.id.startsWith('custom_output');
    
    if (isCustomInput) {
      const portName = node.data.value || node.data.definition?.controls?.defaultValue || 'Input';
      const detectedType = node.data.detectedType || node.data.definition?.outputs?.[0]?.type || 'auto';
      
      console.log('🔍 extractCustomNodePorts - Custom Input:', {
        nodeId: node.id,
        portName,
        detectedTypeFromData: node.data.detectedType,
        detectedTypeFromDef: node.data.definition?.outputs?.[0]?.type,
        final: detectedType
      });
      
      inputs.push({
        id: node.id,
        label: portName,
        type: detectedType
      });
    }
    if (isCustomOutput) {
      const portName = node.data.value || node.data.definition?.controls?.defaultValue || 'Output';
      const detectedType = node.data.detectedType || node.data.definition?.inputs?.[0]?.type || 'auto';
      
      console.log('🔍 extractCustomNodePorts - Custom Output:', {
        nodeId: node.id,
        portName,
        detectedTypeFromData: node.data.detectedType,
        detectedTypeFromDef: node.data.definition?.inputs?.[0]?.type,
        final: detectedType
      });
      
      outputs.push({
        id: node.id,
        label: portName,
        type: detectedType
      });
    }
  });

  return { inputs, outputs };
}
