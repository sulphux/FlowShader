import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * Nowa funkcja: przycisk chowania głównego podglądu (✕) — edytor zajmuje
 * wtedy 100% szerokości, a przy prawej krawędzi zostaje zakładka ◀
 * przywracająca podgląd.
 */

vi.mock('../components/NodeEditor', () => ({
  default: () => <div data-testid="node-editor" />,
}));
vi.mock('../components/ShaderPreview', () => ({
  default: () => <div data-testid="shader-preview" />,
}));

import App from '../App';

describe('App - main preview hide/show toggle', () => {
  it('shows the preview with a Hide Preview button by default', () => {
    render(<App />);
    expect(screen.getByTestId('shader-preview')).toBeInTheDocument();
    expect(screen.getByTitle('Hide Preview')).toBeInTheDocument();
    expect(screen.queryByTitle('Show Preview')).not.toBeInTheDocument();
  });

  it('hides the preview after clicking ✕ and shows the restore tab', async () => {
    render(<App />);
    fireEvent.click(screen.getByTitle('Hide Preview'));

    await waitFor(() => {
      expect(screen.queryByTestId('shader-preview')).not.toBeInTheDocument();
    });
    expect(screen.getByTitle('Show Preview')).toBeInTheDocument();
    // Suwak (resizer) też znika
    expect(document.querySelector('.resizer')).not.toBeInTheDocument();
  });

  it('restores the preview after clicking the ◀ tab', async () => {
    render(<App />);
    fireEvent.click(screen.getByTitle('Hide Preview'));
    await waitFor(() => expect(screen.getByTitle('Show Preview')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Show Preview'));

    await waitFor(() => {
      expect(screen.getByTestId('shader-preview')).toBeInTheDocument();
    });
    expect(screen.queryByTitle('Show Preview')).not.toBeInTheDocument();
    expect(document.querySelector('.resizer')).toBeInTheDocument();
  });

  it('editor pane takes full width while preview is hidden', async () => {
    render(<App />);
    const editorPane = screen.getByTestId('node-editor').parentElement as HTMLElement;
    expect(editorPane.style.width).toBe('60%');

    fireEvent.click(screen.getByTitle('Hide Preview'));

    await waitFor(() => {
      expect(editorPane.style.width).toBe('100%');
    });
  });
});
