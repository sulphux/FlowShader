/** Global graph shortcuts must never steal keystrokes from an active editor. */
export const isEditableKeyboardTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
  );
};

