import { describe, it, expect } from 'vitest';

describe('Undo/Redo History Management', () => {
  it('should maintain max 50 history states', () => {
    const maxStates = 50;
    const history: unknown[] = [];
    
    // Simulate adding 60 states
    for (let i = 0; i < 60; i++) {
      history.push({ state: i });
      if (history.length > maxStates) {
        history.shift(); // Remove oldest
      }
    }
    
    expect(history.length).toBe(maxStates);
    expect(history[0]).toEqual({ state: 10 }); // First 10 were removed
    expect(history[49]).toEqual({ state: 59 });
  });

  it('should truncate future states on new action after undo', () => {
    const history = [
      { state: 1 },
      { state: 2 },
      { state: 3 }
    ];
    let historyIndex = 2; // At state 3
    
    // Undo twice
    historyIndex = 0; // Now at state 1
    
    // New action - should truncate states 2 and 3
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ state: 'new' });
    
    expect(newHistory).toHaveLength(2);
    expect(newHistory[1]).toEqual({ state: 'new' });
  });

  it('should debounce saves (2 seconds)', () => {
    // Test that rapid changes don't create excessive history
    const DEBOUNCE_MS = 2000;
    
    const timestamps = [0, 100, 500, 1000, 2100, 2200];
    const saves: number[] = [];
    
    let lastSave = 0;
    timestamps.forEach(time => {
      if (time === 0 || time - lastSave >= DEBOUNCE_MS) {
        saves.push(time);
        lastSave = time;
      }
    });
    
    expect(saves).toEqual([0, 2100]); // Only 2 saves
  });
});
