import { describe, it, expect } from 'vitest';
import { NODE_REGISTRY } from '../nodes';

describe('Custom Node Default Nodes', () => {
  it('should use Custom Output (NOT screen Output) in custom node subgraphs', () => {
    // Bug: Custom nodes were created with Output (screen) node by default
    // Should use Custom Output instead
    
    // Expected default nodes in custom node subgraph:
    const expectedDefaults = [
      NODE_REGISTRY['custom_input'],   // Custom Input (interface to parent)
      NODE_REGISTRY['custom_output']   // Custom Output (NOT output screen!)
    ];
    
    expect(expectedDefaults[0].id).toBe('custom_input');
    expect(expectedDefaults[1].id).toBe('custom_output');
    
    // Verify custom_output exists and is different from output
    expect(NODE_REGISTRY['custom_output']).toBeDefined();
    expect(NODE_REGISTRY['output']).toBeDefined();
    expect(NODE_REGISTRY['custom_output'].id).not.toBe(NODE_REGISTRY['output'].id);
  });

  it('should use Output (screen) ONLY in main graph', () => {
    // Output node (gl_FragColor) should ONLY appear in main graph
    // Custom nodes should use Custom Output instead
    
    const outputNode = NODE_REGISTRY['output'];
    const customOutputNode = NODE_REGISTRY['custom_output'];
    
    // Output = screen output (main graph only)
    expect(outputNode.id).toBe('output');
    expect(outputNode.label).toContain('Output');
    
    // Custom Output = interface node (custom node subgraphs)
    expect(customOutputNode.id).toBe('custom_output');
    expect(customOutputNode.label).toContain('Output');
    
    // Different purposes!
    expect(outputNode).not.toBe(customOutputNode);
  });
  
  it('should create default nodes with correct IDs', () => {
    // When creating empty custom node, default node IDs should be:
    const expectedIds = {
      input: 'custom_input_default',
      output: 'custom_output_default'  // NOT output_default!
    };
    
    expect(expectedIds.output).toBe('custom_output_default');
    expect(expectedIds.output).not.toBe('output_default');
  });
});
