import { describe, expect, it } from 'vitest';
import { isEditableKeyboardTarget } from './keyboardTarget';

describe('isEditableKeyboardTarget', () => {
  it('protects all common editable controls from graph shortcuts', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const nested = document.createElement('span');
    editable.appendChild(nested);

    expect(isEditableKeyboardTarget(input)).toBe(true);
    expect(isEditableKeyboardTarget(textarea)).toBe(true);
    expect(isEditableKeyboardTarget(nested)).toBe(true);
    expect(isEditableKeyboardTarget(document.createElement('div'))).toBe(false);
  });
});
