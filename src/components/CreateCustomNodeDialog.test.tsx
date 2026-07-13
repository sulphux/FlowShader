import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CreateCustomNodeDialog from './CreateCustomNodeDialog';

describe('CreateCustomNodeDialog', () => {
  const onClose = vi.fn();
  const onCreate = vi.fn();
  const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

  beforeEach(() => {
    onClose.mockReset();
    onCreate.mockReset();
    alertMock.mockClear();
  });

  afterEach(() => {
    alertMock.mockClear();
  });

  it('should create custom node on Enter and trim name and description', () => {
    render(<CreateCustomNodeDialog onClose={onClose} onCreate={onCreate} />);

    const nameInput = screen.getByPlaceholderText('My Custom Effect');
    const descriptionInput = screen.getByPlaceholderText('What does this custom node do?');

    fireEvent.change(nameInput, { target: { value: '  Fancy Node  ' } });
    fireEvent.change(descriptionInput, { target: { value: '  trims too  ' } });
    fireEvent.keyDown(nameInput, { key: 'Enter' });

    expect(onCreate).toHaveBeenCalledWith('Fancy Node', 'trims too');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close dialog on Escape from name input', () => {
    render(<CreateCustomNodeDialog onClose={onClose} onCreate={onCreate} />);

    const nameInput = screen.getByPlaceholderText('My Custom Effect');
    fireEvent.keyDown(nameInput, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('should close dialog on Escape from description input', () => {
    render(<CreateCustomNodeDialog onClose={onClose} onCreate={onCreate} />);

    const descriptionInput = screen.getByPlaceholderText('What does this custom node do?');
    fireEvent.keyDown(descriptionInput, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('should close on overlay click and not create node', () => {
    const { container } = render(<CreateCustomNodeDialog onClose={onClose} onCreate={onCreate} />);

    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('should not close when clicking inside the dialog body', () => {
    render(<CreateCustomNodeDialog onClose={onClose} onCreate={onCreate} />);

    fireEvent.click(screen.getByText('Create'));

    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('should block creation for blank name and show alert', () => {
    render(<CreateCustomNodeDialog onClose={onClose} onCreate={onCreate} />);

    fireEvent.click(screen.getByText('Create'));

    expect(alertMock).toHaveBeenCalledWith('Please enter a name for the custom node.');
    expect(onCreate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should create node from Create button click', () => {
    render(<CreateCustomNodeDialog onClose={onClose} onCreate={onCreate} />);

    fireEvent.change(screen.getByPlaceholderText('My Custom Effect'), {
      target: { value: 'Milestone Node' }
    });
    fireEvent.change(screen.getByPlaceholderText('What does this custom node do?'), {
      target: { value: 'A stable workflow' }
    });
    fireEvent.click(screen.getByText('Create'));

    expect(onCreate).toHaveBeenCalledWith('Milestone Node', 'A stable workflow');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('explains whether creation is empty or based on selection', () => {
    const { rerender } = render(
      <CreateCustomNodeDialog mode="empty" onClose={onClose} onCreate={onCreate} />
    );
    expect(screen.getByText(/fresh Custom Input and Custom Output/i)).toBeInTheDocument();

    rerender(<CreateCustomNodeDialog mode="selection" onClose={onClose} onCreate={onCreate} />);
    expect(screen.getByText(/currently selected nodes/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /from Selection/i })).toBeInTheDocument();
  });
});
