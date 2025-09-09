import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ScheduledPostView from '../../src/app/Components/ScheduledPostView';
import { ScheduledPost } from '../../src/app/Types';

const mockOnBack = jest.fn();

describe('ScheduledPostView Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state when no scheduled posts exist', () => {
    render(<ScheduledPostView onBack={mockOnBack} scheduledPosts={[]} />);

    expect(screen.getByText('Scheduled Posts')).toBeInTheDocument();
    expect(screen.getByText('Upcoming content')).toBeInTheDocument();
    expect(screen.getByText('No scheduled posts')).toBeInTheDocument();
    expect(screen.getByText("You don't have any posts scheduled yet.")).toBeInTheDocument();
  });

  it('renders scheduled posts correctly', () => {
    const scheduledPosts: ScheduledPost[] = [
      {
        id: '1',
        content: 'Test post content for Twitter',
        timestamp: Date.now() + 3600000, // 1 hour from now
        platform: 'Twitter',
        status: 'scheduled',
      },
      {
        id: '2',
        content: 'LinkedIn professional post',
        timestamp: Date.now() + 7200000, // 2 hours from now
        platform: 'LinkedIn',
        status: 'posted',
      },
    ];

    render(<ScheduledPostView onBack={mockOnBack} scheduledPosts={scheduledPosts} />);

    expect(screen.getByText('Test post content for Twitter')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn professional post')).toBeInTheDocument();
    expect(screen.getByText('Twitter')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
  });

  it('displays correct status styling for different post statuses', () => {
    const scheduledPosts: ScheduledPost[] = [
      {
        id: '1',
        content: 'Scheduled post',
        timestamp: Date.now() + 3600000,
        platform: 'Twitter',
        status: 'scheduled',
      },
      {
        id: '2',
        content: 'Posted post',
        timestamp: Date.now() - 3600000, // 1 hour ago
        platform: 'Instagram',
        status: 'posted',
      },
      {
        id: '3',
        content: 'Failed post',
        timestamp: Date.now() - 1800000, // 30 minutes ago
        platform: 'Facebook',
        status: 'failed',
      },
    ];

    render(<ScheduledPostView onBack={mockOnBack} scheduledPosts={scheduledPosts} />);

    const scheduledStatus = screen.getByText('scheduled');
    const postedStatus = screen.getByText('posted');
    const failedStatus = screen.getByText('failed');

    expect(scheduledStatus).toHaveClass('bg-amber-500/20', 'text-amber-300');
    expect(postedStatus).toHaveClass('bg-green-500/20', 'text-green-300');
    expect(failedStatus).toHaveClass('bg-rose-500/20', 'text-rose-300');
  });

  it('shows cancel button only for scheduled posts', () => {
    const scheduledPosts: ScheduledPost[] = [
      {
        id: '1',
        content: 'Scheduled post',
        timestamp: Date.now() + 3600000,
        platform: 'Twitter',
        status: 'scheduled',
      },
      {
        id: '2',
        content: 'Posted post',
        timestamp: Date.now() - 3600000,
        platform: 'Instagram',
        status: 'posted',
      },
    ];

    render(<ScheduledPostView onBack={mockOnBack} scheduledPosts={scheduledPosts} />);

    const cancelButtons = screen.queryAllByText('Cancel');
    expect(cancelButtons).toHaveLength(1);

    // The cancel button should be near the scheduled post
    const scheduledPostElement = screen.getByText('Scheduled post').closest('div');
    expect(scheduledPostElement).toContainElement(screen.getByText('Cancel'));
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    render(<ScheduledPostView onBack={mockOnBack} scheduledPosts={[]} />);

    const backButton = screen.getByRole('button', { name: '←' });
    await user.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('formats timestamps correctly', () => {
    const specificTime = new Date('2024-01-01 14:30:00').getTime();
    const scheduledPosts: ScheduledPost[] = [
      {
        id: '1',
        content: 'Timed post',
        timestamp: specificTime,
        platform: 'Twitter',
        status: 'scheduled',
      },
    ];

    render(<ScheduledPostView onBack={mockOnBack} scheduledPosts={scheduledPosts} />);

    // Should show formatted date and time
    expect(screen.getByText(/1\/1\/2024.*2:30:00 PM/)).toBeInTheDocument();
  });

  it('renders platform badges with correct styling', () => {
    const scheduledPosts: ScheduledPost[] = [
      {
        id: '1',
        content: 'Multi-platform test',
        timestamp: Date.now() + 3600000,
        platform: 'Twitter',
        status: 'scheduled',
      },
    ];

    render(<ScheduledPostView onBack={mockOnBack} scheduledPosts={scheduledPosts} />);

    const platformBadge = screen.getByText('Twitter');
    expect(platformBadge).toHaveClass('bg-blue-500/20', 'text-blue-300', 'rounded-full');
  });
});
