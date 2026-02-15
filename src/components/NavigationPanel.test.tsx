import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NavigationPanel from './NavigationPanel';

describe('NavigationPanel - Breadcrumbs Navigation', () => {
  const defaultProps = {
    breadcrumbs: ['Main'],
    currentContext: 'Main',
    onNavigateToLevel: vi.fn(),
    onNavigateBack: vi.fn(),
    onNavigateToMain: vi.fn(),
  };

  describe('Rendering tests', () => {
    it('should render breadcrumbs when inside custom node', () => {
      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'CustomNode1']}
          currentContext="CustomNode1"
        />
      );

      // Check that the editing banner is visible
      expect(screen.getByText(/EDITING: CustomNode1/i)).toBeInTheDocument();

      // Check that breadcrumbs are visible (use getAllByRole to find buttons)
      const buttons = screen.getAllByRole('button');
      const mainBreadcrumb = buttons.find(btn => btn.textContent?.includes('Main') && btn.title?.includes('Jump to'));
      const customBreadcrumb = buttons.find(btn => btn.textContent?.includes('CustomNode1') && btn.title?.includes('Jump to'));
      
      expect(mainBreadcrumb).toBeDefined();
      expect(customBreadcrumb).toBeDefined();
    });

    it('should NOT render when at main level', () => {
      const { container } = render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main']}
          currentContext="Main"
        />
      );

      // Panel should not be visible when currentContext is 'Main'
      expect(container.firstChild).toBeNull();
    });

    it('should render multiple breadcrumb levels', () => {
      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'Level1', 'Level2']}
          currentContext="Level2"
        />
      );

      expect(screen.getByText(/EDITING: Level2/i)).toBeInTheDocument();
      
      // Check breadcrumbs using button titles
      const buttons = screen.getAllByRole('button');
      expect(buttons.some(btn => btn.title === 'Jump to Main')).toBe(true);
      expect(buttons.some(btn => btn.title === 'Jump to Level1')).toBe(true);
      expect(buttons.some(btn => btn.title === 'Jump to Level2')).toBe(true);
    });

    it('should show breadcrumb separators', () => {
      const { container } = render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'Level1', 'Level2']}
          currentContext="Level2"
        />
      );

      // Check for breadcrumb separators (›)
      const separators = container.querySelectorAll('[style*="color"]');
      const hasSeparator = Array.from(separators).some(
        el => el.textContent === '›'
      );
      expect(hasSeparator).toBe(true);
    });
  });

  describe('Navigation buttons', () => {
    it('should show "Up One Level" button when nested', () => {
      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'CustomNode1']}
          currentContext="CustomNode1"
        />
      );

      const upButton = screen.getByText(/Up One Level/i);
      expect(upButton).toBeInTheDocument();
      expect(upButton).toBeVisible();
    });

    it('should NOT show "Up One Level" button at first level', () => {
      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main']}
          currentContext="CustomNode1"
        />
      );

      // When breadcrumbs.length is 1, "Up One Level" should not be shown
      expect(screen.queryByText(/Up One Level/i)).not.toBeInTheDocument();
    });

    it('should show "Exit to Main" button when inside custom node', () => {
      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'CustomNode1']}
          currentContext="CustomNode1"
        />
      );

      const exitButton = screen.getByText(/Exit to Main/i);
      expect(exitButton).toBeInTheDocument();
      expect(exitButton).toBeVisible();
    });

    it('should always show "Exit to Main" button even at first level inside custom node', () => {
      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'CustomNode1']}
          currentContext="CustomNode1"
        />
      );

      // Exit to Main is always visible when not in Main context
      const exitButton = screen.getByText(/Exit to Main/i);
      expect(exitButton).toBeInTheDocument();
    });
  });

  describe('Click interactions', () => {
    it('should navigate up when clicking "Up One Level"', () => {
      const onNavigateBack = vi.fn();

      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'Level1', 'Level2']}
          currentContext="Level2"
          onNavigateBack={onNavigateBack}
        />
      );

      const upButton = screen.getByText(/Up One Level/i);
      fireEvent.click(upButton);

      expect(onNavigateBack).toHaveBeenCalledTimes(1);
    });

    it('should navigate to main when clicking "Exit to Main"', () => {
      const onNavigateToMain = vi.fn();

      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'Level1']}
          currentContext="Level1"
          onNavigateToMain={onNavigateToMain}
        />
      );

      const exitButton = screen.getByText(/Exit to Main/i);
      fireEvent.click(exitButton);

      expect(onNavigateToMain).toHaveBeenCalledTimes(1);
    });

    it('should navigate to level when clicking breadcrumb', () => {
      const onNavigateToLevel = vi.fn();

      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'Level1', 'Level2']}
          currentContext="Level2"
          onNavigateToLevel={onNavigateToLevel}
        />
      );

      // Click on "Level1" breadcrumb (index 1)
      const breadcrumbs = screen.getAllByRole('button');
      const level1Button = breadcrumbs.find(btn => btn.textContent?.includes('Level1'));
      
      expect(level1Button).toBeDefined();
      fireEvent.click(level1Button!);

      expect(onNavigateToLevel).toHaveBeenCalledTimes(1);
      expect(onNavigateToLevel).toHaveBeenCalledWith(1);
    });

    it('should navigate to Main when clicking Main breadcrumb', () => {
      const onNavigateToLevel = vi.fn();

      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'Level1', 'Level2']}
          currentContext="Level2"
          onNavigateToLevel={onNavigateToLevel}
        />
      );

      // Click on "Main" breadcrumb (index 0)
      const breadcrumbs = screen.getAllByRole('button');
      const mainButton = breadcrumbs.find(btn => btn.textContent?.includes('🏠') && btn.textContent?.includes('Main'));
      
      expect(mainButton).toBeDefined();
      fireEvent.click(mainButton!);

      expect(onNavigateToLevel).toHaveBeenCalledTimes(1);
      expect(onNavigateToLevel).toHaveBeenCalledWith(0);
    });
  });

  describe('Visual indicators and styling', () => {
    it('should highlight current breadcrumb differently', () => {
      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'Level1', 'Level2']}
          currentContext="Level2"
        />
      );

      const breadcrumbs = screen.getAllByRole('button');
      const currentBreadcrumb = breadcrumbs.find(btn => btn.title === 'Jump to Level2');
      
      // Current breadcrumb should have purple background (as rgb)
      expect(currentBreadcrumb).toBeDefined();
      expect(currentBreadcrumb?.style.background).toContain('rgb(138, 43, 226)');
      expect(currentBreadcrumb?.style.fontWeight).toBe('bold');
    });

    it('should show location pin icon in breadcrumbs trail', () => {
      const { container } = render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'CustomNode1']}
          currentContext="CustomNode1"
        />
      );

      // Check for location pin emoji (📍)
      const hasLocationIcon = container.textContent?.includes('📍');
      expect(hasLocationIcon).toBe(true);
    });

    it('should show home icon for Main breadcrumb', () => {
      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'CustomNode1']}
          currentContext="CustomNode1"
        />
      );

      const breadcrumbs = screen.getAllByRole('button');
      const mainButton = breadcrumbs.find(btn => btn.textContent?.includes('Main'));
      
      // Main breadcrumb should have home icon (🏠)
      expect(mainButton?.textContent).toContain('🏠');
    });

    it('should show box icon for custom node breadcrumbs', () => {
      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'CustomNode1', 'CustomNode2']}
          currentContext="CustomNode2"
        />
      );

      const breadcrumbs = screen.getAllByRole('button');
      const customNodeButton = breadcrumbs.find(btn => btn.textContent?.includes('CustomNode1'));
      
      // Custom node breadcrumbs should have box icon (🔲)
      expect(customNodeButton?.textContent).toContain('🔲');
    });
  });

  describe('Panel styling and layout', () => {
    it('should have proper banner with editing context', () => {
      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'MyCustomNode']}
          currentContext="MyCustomNode"
        />
      );

      const banner = screen.getByText(/EDITING: MyCustomNode/i);
      expect(banner).toBeInTheDocument();
      expect(banner.textContent).toContain('✏️');
    });

    it('should position panel at top-left area', () => {
      const { container } = render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'CustomNode1']}
          currentContext="CustomNode1"
        />
      );

      const panel = container.firstChild as HTMLElement;
      expect(panel).toBeDefined();
      expect(panel.style.position).toBe('absolute');
      expect(panel.style.top).toBe('80px');
      expect(panel.style.left).toBe('10px');
    });

    it('should have purple-themed styling', () => {
      const { container } = render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['Main', 'CustomNode1']}
          currentContext="CustomNode1"
        />
      );

      const panel = container.firstChild as HTMLElement;
      expect(panel.style.border).toContain('rgb(138, 43, 226)');
      expect(panel.style.background).toContain('138, 43, 226'); // RGB for #8a2be2
    });
  });

  describe('Edge cases', () => {
    it('should handle empty breadcrumbs array gracefully', () => {
      const { container } = render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={[]}
          currentContext="SomeNode"
        />
      );

      // Should still render if currentContext is not 'Main'
      expect(container.firstChild).not.toBeNull();
    });

    it('should handle single breadcrumb (not Main) gracefully', () => {
      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={['CustomNode1']}
          currentContext="CustomNode1"
        />
      );

      // Should render panel
      expect(screen.getByText(/EDITING: CustomNode1/i)).toBeInTheDocument();
      
      // Should not show "Up One Level" (breadcrumbs.length = 1)
      expect(screen.queryByText(/Up One Level/i)).not.toBeInTheDocument();
      
      // Should show "Exit to Main"
      expect(screen.getByText(/Exit to Main/i)).toBeInTheDocument();
    });

    it('should handle deeply nested breadcrumbs', () => {
      const deepBreadcrumbs = ['Main', 'Level1', 'Level2', 'Level3', 'Level4', 'Level5'];
      
      render(
        <NavigationPanel
          {...defaultProps}
          breadcrumbs={deepBreadcrumbs}
          currentContext="Level5"
        />
      );

      // Check all breadcrumbs are rendered by checking button titles
      const buttons = screen.getAllByRole('button');
      deepBreadcrumbs.forEach(crumb => {
        expect(buttons.some(btn => btn.title === `Jump to ${crumb}`)).toBe(true);
      });

      // Should show "Up One Level" button
      expect(screen.getByText(/Up One Level/i)).toBeInTheDocument();
    });
  });
});
