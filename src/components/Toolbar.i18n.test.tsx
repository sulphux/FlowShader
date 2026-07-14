import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGE_STORAGE_KEY, setLanguage } from '../core/i18n';
import Toolbar from './Toolbar';

const renderToolbar = () => render(
  <Toolbar
    onSave={vi.fn()} onLoad={vi.fn()} onShowExamples={vi.fn()} onClear={vi.fn()}
    onNew={vi.fn()} onFitView={vi.fn()} onShowCode={vi.fn()}
  />,
);

describe('Toolbar language switch', () => {
  beforeEach(() => localStorage.clear());

  it('uses English by default and persists a switch to Polish', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: '📚 Examples' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Language: English. Switch to Polish' }));
    expect(screen.getByRole('button', { name: '📚 Przykłady' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '📂 Wczytaj' })).toBeInTheDocument();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pl');
  });

  it('reacts to a stored Polish preference and can return to English', () => {
    setLanguage('pl');
    renderToolbar();
    expect(screen.getByRole('button', { name: '📄 Nowy' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Język: polski. Przełącz na angielski' }));
    expect(screen.getByRole('button', { name: '📄 New' })).toBeInTheDocument();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });
});
