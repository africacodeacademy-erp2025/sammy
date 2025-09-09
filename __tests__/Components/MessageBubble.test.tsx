import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MessageBubble from '../../src/app/Components/MessageBubble';
import { Message } from '../../src/app/Types';

const mockOnApprove = jest.fn();
const mockOnReject = jest.fn();

describe('MessageBubble Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseMessage: Message = {
    id: 'test-id',
    content: 'Test message content',
    sender: 'user',
    timestamp: Date.now(),
  };

  it('renders user message correctly', () => {
    render(
      <MessageBubble
        message={baseMessage}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        isLatestAiMessage={false}
      />
    );

    expect(screen.getByText('Test message content')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('renders AI message correctly', () => {
    const aiMessage = { ...baseMessage, sender: 'ai' as const };

    render(
      <MessageBubble
        message={aiMessage}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        isLatestAiMessage={false}
      />
    );

    expect(screen.getByText('Test message content')).toBeInTheDocument();
    expect(screen.getByText('SaMMy')).toBeInTheDocument();
  });

  it('shows approve and reject buttons for pending AI messages', () => {
    const pendingMessage = {
      ...baseMessage,
      sender: 'ai' as const,
      status: 'pending' as const,
    };

    render(
      <MessageBubble
        message={pendingMessage}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        isLatestAiMessage={false}
      />
    );

    expect(screen.getByText('📝 Ready for review')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('calls onApprove when approve button is clicked', async () => {
    const user = userEvent.setup();
    const pendingMessage = {
      ...baseMessage,
      sender: 'ai' as const,
      status: 'pending' as const,
    };

    render(
      <MessageBubble
        message={pendingMessage}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        isLatestAiMessage={false}
      />
    );

    const approveButton = screen.getByText('Approve');
    await user.click(approveButton);

    expect(mockOnApprove).toHaveBeenCalledWith('test-id');
  });

  it('calls onReject when reject button is clicked', async () => {
    const user = userEvent.setup();
    const pendingMessage = {
      ...baseMessage,
      sender: 'ai' as const,
      status: 'pending' as const,
    };

    render(
      <MessageBubble
        message={pendingMessage}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        isLatestAiMessage={false}
      />
    );

    const rejectButton = screen.getByText('Reject');
    await user.click(rejectButton);

    expect(mockOnReject).toHaveBeenCalledWith('test-id');
  });

  it('shows posting status correctly', () => {
    const postingMessage = {
      ...baseMessage,
      sender: 'ai' as const,
      status: 'posting' as const,
    };

    render(
      <MessageBubble
        message={postingMessage}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        isLatestAiMessage={false}
      />
    );

    expect(screen.getByText('Posting...')).toBeInTheDocument();
  });

  it('shows posted status correctly', () => {
    const postedMessage = {
      ...baseMessage,
      sender: 'ai' as const,
      status: 'posted' as const,
    };

    render(
      <MessageBubble
        message={postedMessage}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        isLatestAiMessage={false}
      />
    );

    expect(screen.getByText('Posted')).toBeInTheDocument();
  });

  it('shows rejected status correctly', () => {
    const rejectedMessage = {
      ...baseMessage,
      sender: 'ai' as const,
      status: 'rejected' as const,
    };

    render(
      <MessageBubble
        message={rejectedMessage}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        isLatestAiMessage={false}
      />
    );

    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('shows error status correctly', () => {
    const errorMessage = {
      ...baseMessage,
      sender: 'ai' as const,
      status: 'error' as const,
    };

    render(
      <MessageBubble
        message={errorMessage}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        isLatestAiMessage={false}
      />
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('formats timestamp correctly', () => {
    const specificTime = new Date('2024-01-01 14:30:00').getTime();
    const timedMessage = { ...baseMessage, timestamp: specificTime };

    render(
      <MessageBubble
        message={timedMessage}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        isLatestAiMessage={false}
      />
    );

    expect(screen.getByText('2:30 PM')).toBeInTheDocument();
  });

  it('handles visibility animation for latest AI message', () => {
    jest.useFakeTimers();

    render(
      <MessageBubble
        message={{ ...baseMessage, sender: 'ai' }}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        isLatestAiMessage={true}
      />
    );

    // Should start invisible
    const messageElement = screen.getByText('Test message content').closest('div');
    expect(messageElement).toHaveClass('opacity-0');

    // After timer, should become visible
    jest.advanceTimersByTime(200);
    expect(messageElement).toHaveClass('opacity-100');

    jest.useRealTimers();
  });
});
