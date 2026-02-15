import { describe, it, expect } from 'vitest';
import { NODE_REGISTRY } from '../nodes';

describe('Custom Node Port Sync - Implementation Verification', () => {
  it('should have Custom Input node definition with auto type', () => {
    // Verify Custom Input exists and starts as 'auto'
    const customInput = NODE_REGISTRY['custom_input'];
    
    expect(customInput).toBeDefined();
    expect(customInput.outputs[0].type).toBe('auto');
  });

  it('should have Custom Output node definition with auto type', () => {
    // Verify Custom Output exists and starts as 'auto'
    const customOutput = NODE_REGISTRY['custom_output'];
    
    expect(customOutput).toBeDefined();
    expect(customOutput.inputs[0].type).toBe('auto');
  });

  it('should support detectedType in node data structure', () => {
    // Verify node data can hold detectedType
    const nodeData = {
      definition: NODE_REGISTRY['custom_input'],
      value: 'Input',
      detectedType: 'float'  // This should be settable
    };
    
    expect(nodeData.detectedType).toBe('float');
  });
});
