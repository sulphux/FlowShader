import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ExamplesDialog from './ExamplesDialog';
import { setLanguage } from '../core/i18n';

describe('ExamplesDialog', () => {
  it('selects a card before explicitly opening it', async () => {
    const onOpen = vi.fn();
    render(<ExamplesDialog onClose={vi.fn()} onOpen={onOpen} />);

    expect(screen.getByRole('dialog', { name: 'Start from an example' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Game of Life/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Raymarch Sphere/ }));
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open Raymarch Sphere' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
    expect(onOpen.mock.calls[0][1]).toBe('Raymarch Sphere');
    expect(JSON.parse(onOpen.mock.calls[0][0]).nodes).toHaveLength(5);
  }, 15_000);

  it('closes on Escape without opening a graph', () => {
    const onClose = vi.fn();
    const onOpen = vi.fn();
    render(<ExamplesDialog onClose={onClose} onOpen={onOpen} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('translates the gallery after switching to Polish', () => {
    setLanguage('pl');
    render(<ExamplesDialog onClose={vi.fn()} onOpen={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Zacznij od przykładu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Otwórz Gra w życie/ })).toBeInTheDocument();
    expect(screen.getByText('Galeria FlowShader')).toBeInTheDocument();
  });
});
