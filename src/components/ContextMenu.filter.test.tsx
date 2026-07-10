import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContextMenu from './ContextMenu';

/**
 * Regresja: przeciągnięcie z WYJŚCIA noda na puste pole pokazywało propozycje
 * bez sensu — np. Float Param (który nie ma wejścia), a nie pokazywało
 * Value Watchera (monitor przyjmuje sygnał przez auto-adapter).
 * Filtr musi znać kierunek: 'source' (z wyjścia) / 'target' (z wejścia).
 */

const defaultProps = {
  x: 100,
  y: 100,
  onClose: vi.fn(),
  onAddNode: vi.fn(),
};

/** Otwiera kategorię (submenu renderuje się na hover) i zwraca jej itemy. */
const openCategory = (name: string) => {
  fireEvent.mouseEnter(screen.getByText(name));
};

describe('ContextMenu - direction-aware filtering', () => {
  describe('dragging FROM an output (filterDirection="source", float)', () => {
    const props = { ...defaultProps, filterType: 'float', filterDirection: 'source' as const };

    it('hides Float Param (it has no inputs — nothing to connect to)', () => {
      render(<ContextMenu {...props} />);
      // Kategoria "Output & Inputs" nie zawiera już param_float;
      // jeśli w ogóle jest widoczna, to bez tego itemu
      const category = screen.queryByText('Output & Inputs');
      if (category) {
        fireEvent.mouseEnter(category);
        expect(screen.queryByText('Float Param')).not.toBeInTheDocument();
      }
    });

    it('hides Time and UV Coord (outputs-only nodes)', () => {
      render(<ContextMenu {...props} />);
      const category = screen.queryByText('Output & Inputs');
      if (category) {
        fireEvent.mouseEnter(category);
        expect(screen.queryByText('Time (iTime)')).not.toBeInTheDocument();
        expect(screen.queryByText('UV Coord')).not.toBeInTheDocument();
      }
    });

    it('shows Value Watcher (float→vec4 przez auto-adapter)', () => {
      render(<ContextMenu {...props} />);
      openCategory('Utils');
      expect(screen.getByText('Value Watcher')).toBeInTheDocument();
    });

    it('shows Preview and Color Preview (accept signal via adapter)', () => {
      render(<ContextMenu {...props} />);
      openCategory('Utils');
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('Color Preview')).toBeInTheDocument();
    });

    it('shows math nodes (float inputs)', () => {
      render(<ContextMenu {...props} />);
      openCategory('Math (Basic)');
      expect(screen.getByText('+')).toBeInTheDocument();
    });
  });

  describe('dragging FROM an input (filterDirection="target", float)', () => {
    const props = { ...defaultProps, filterType: 'float', filterDirection: 'target' as const };

    it('shows Float Param (produces float)', () => {
      render(<ContextMenu {...props} />);
      openCategory('Output & Inputs');
      expect(screen.getByText('Float Param')).toBeInTheDocument();
    });

    it('hides Preview and Color Preview (no outputs — cannot feed an input)', () => {
      render(<ContextMenu {...props} />);
      const category = screen.queryByText('Utils');
      if (category) {
        fireEvent.mouseEnter(category);
        expect(screen.queryByText('Preview')).not.toBeInTheDocument();
        expect(screen.queryByText('Color Preview')).not.toBeInTheDocument();
      }
    });

    it('hides Output (Screen) (no outputs)', () => {
      render(<ContextMenu {...props} />);
      const category = screen.queryByText('Output & Inputs');
      if (category) {
        fireEvent.mouseEnter(category);
        expect(screen.queryByText('Output (Screen)')).not.toBeInTheDocument();
      }
    });
  });

  it('without direction keeps legacy both-ways matching (backward compat)', () => {
    render(<ContextMenu {...defaultProps} filterType="float" />);
    openCategory('Output & Inputs');
    // Stare zachowanie: param widoczny (ma pasujące WYJŚCIE)
    expect(screen.getByText('Float Param')).toBeInTheDocument();
  });
});
