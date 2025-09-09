import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Sidebar from '../../src/app/Components/Sidebar';

const mockOnClose = jest.fn();
const mockOnViewSchedule = jest.fn();

describe('Sidebar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders sidebar when open', () => {
    render(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        onViewSchedule={mockOnViewSchedule}
      />
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('View Schedule')).toBeInTheDocument();
    expect(screen.getByText('See upcoming posts')).toBeInTheDocument();
    expect(screen.getByText('Preferences')).toBeInTheDocument();
    expect(screen.getByText('App Info')).toBeInTheDocument();
  });

  it('does not render sidebar content when closed', () => {
    render(
      <Sidebar
        isOpen={false}
        onClose={mockOnClose}
        onViewSchedule={mockOnViewSchedule}
      />
    );

    const sidebar = screen.getByText('Settings').closest('div');
    expect(sidebar).toHaveClass('translate-x-full');
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        onViewSchedule={mockOnViewSchedule}
      />
    );

    const closeButton = screen.getByText('✕');
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        onViewSchedule={mockOnViewSchedule}
      />
    );

    const overlay = document.querySelector('.fixed.inset-0.bg-black\\/50');
    expect(overlay).toBeInTheDocument();

    if (overlay) {
      await user.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('calls onViewSchedule when View Schedule button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        onViewSchedule={mockOnViewSchedule}
      />
    );

    const viewScheduleButton = screen.getByText('View Schedule');
    await user.click(viewScheduleButton);

    expect(mockOnViewSchedule).toHaveBeenCalledTimes(1);
  });

  it('renders preferences section with default tone selector', () => {
    render(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        onViewSchedule={mockOnViewSchedule}
      />
    );

    expect(screen.getByText('Default Posting Tone')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Professional')).toBeInTheDocument();

    const select = screen.getByDisplayValue('Professional');
    expect(select).toContainElement(screen.getByText('Professional'));
    expect(select).toContainElement(screen.getByText('Casual'));
    expect(select).toContainElement(screen.getByText('Humorous'));
    expect(select).toContainElement(screen.getByText('Informative'));
  });

  it('renders auto-post toggle', () => {
    render(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        onViewSchedule={mockOnViewSchedule}
      />
    );

    expect(screen.getByText('Auto-post approved content')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders app info section', () => {
    render(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        onViewSchedule={mockOnViewSchedule}
      />
    );

    expect(screen.getByText('SaMMy will post to the platform specified in your prompt.')).toBeInTheDocument();
    expect(screen.getByText(/Just mention the platform name/)).toBeInTheDocument();
  });

  it('changes tone selection when dropdown is used', async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        onViewSchedule={mockOnViewSchedule}
      />
    );

    const select = screen.getByDisplayValue('Professional');
    await user.selectOptions(select, 'Casual');

    expect(screen.getByDisplayValue('Casual')).toBeInTheDocument();
  });

  it('applies correct styling when open', () => {
    render(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        onViewSchedule={mockOnViewSchedule}
      />
    );

    const sidebar = screen.getByText('Settings').closest('div');
    expect(sidebar).toHaveClass('translate-x-0');
    expect(sidebar).not.toHaveClass('translate-x-full');
  });
});
