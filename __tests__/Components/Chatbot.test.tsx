import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Chatbot from '../../src/app/Components/Chatbot';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'mock-uuid-123')
  }
});

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  value: jest.fn(() => true)
});

describe('Chatbot Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  it('renders the chatbot interface correctly', () => {
    render(<Chatbot />);

    expect(screen.getByText('SaMMy')).toBeInTheDocument();
    expect(screen.getByText('Social Media Content Generator')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Instruct SaMMy...')).toBeInTheDocument();
    expect(screen.getByText('What do you want to post about?')).toBeInTheDocument();
  });

  it('shows example prompts when no messages exist', () => {
    render(<Chatbot />);

    expect(screen.getByText(/Create a tweet about launching our new branch/)).toBeInTheDocument();
    expect(screen.getByText(/Write a linkedin post about our opened intake/)).toBeInTheDocument();
    expect(screen.getByText(/Draft a facebook promotional post for my product/)).toBeInTheDocument();
  });

  it('sends a message when user types and presses Enter', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        review: {
          post: 'Generated social media post',
          threadId: 'thread-123'
        }
      })
    } as Response);

    render(<Chatbot />);

    const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
    await user.type(textarea, 'Create a tweet about our product');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Create a tweet about our product')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Generated social media post')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Create a tweet about our product' })
    });
  });

  it('sends a message when clicking Send button', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        review: {
          post: 'Generated content',
          threadId: 'thread-456'
        }
      })
    } as Response);

    render(<Chatbot />);

    const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
    const sendButton = screen.getByText('Send');

    await user.type(textarea, 'Test message');
    await user.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  it('prevents sending empty messages', async () => {
    const user = userEvent.setup();
    render(<Chatbot />);

    const sendButton = screen.getByText('Send');
    expect(sendButton).toBeDisabled();

    const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
    await user.type(textarea, '   '); // Just spaces

    expect(sendButton).toBeDisabled();
  });

  it('shows typing indicator while processing message', async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation(() =>
      new Promise(resolve =>
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ review: { post: 'Response', threadId: 'thread-789' } })
        } as Response), 100)
      )
    );

    render(<Chatbot />);

    const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
    await user.type(textarea, 'Test');
    await user.keyboard('{Enter}');

    expect(screen.getByText('SaMMy is thinking...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('SaMMy is thinking...')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error occurred' })
    } as Response);

    render(<Chatbot />);

    const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
    await user.type(textarea, 'Test message');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Server error occurred')).toBeInTheDocument();
    });
  });

  it('approves a draft message successfully', async () => {
    const user = userEvent.setup();

    // Initial message creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        review: {
          post: 'Draft post content',
          threadId: 'thread-123'
        }
      })
    } as Response);

    // Approval request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response);

    render(<Chatbot />);

    const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
    await user.type(textarea, 'Create a post');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Draft post content')).toBeInTheDocument();
    });

    const approveButton = screen.getByText('Approve');
    await user.click(approveButton);

    await waitFor(() => {
      expect(screen.getByText('Posted')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenLastCalledWith('/api/agent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post: 'Draft post content',
        threadId: 'thread-123'
      })
    });
  });

  it('rejects a draft message', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        review: {
          post: 'Draft to reject',
          threadId: 'thread-456'
        }
      })
    } as Response);

    render(<Chatbot />);

    const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
    await user.type(textarea, 'Create content');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Draft to reject')).toBeInTheDocument();
    });

    const rejectButton = screen.getByText('Reject');
    await user.click(rejectButton);

    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('clears chat when confirmed', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        review: { post: 'Test message', threadId: 'thread-123' }
      })
    } as Response);

    render(<Chatbot />);

    // Add a message first
    const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
    await user.type(textarea, 'Test');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    const clearButton = screen.getByText('Clear Chat');
    await user.click(clearButton);

    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    expect(screen.getByText('What do you want to post about?')).toBeInTheDocument();
  });

  it('toggles sidebar', async () => {
    const user = userEvent.setup();
    render(<Chatbot />);

    const settingsButton = screen.getByText('Settings');
    await user.click(settingsButton);

    expect(screen.getByText('View Schedule')).toBeInTheDocument();
  });

  it('switches to schedule view', async () => {
    const user = userEvent.setup();
    render(<Chatbot />);

    const settingsButton = screen.getByText('Settings');
    await user.click(settingsButton);

    const viewScheduleButton = screen.getByText('View Schedule');
    await user.click(viewScheduleButton);

    expect(screen.getByText('Scheduled Posts')).toBeInTheDocument();
    expect(screen.getByText('Upcoming content')).toBeInTheDocument();
  });

  it('handles textarea auto-resize', async () => {
    const user = userEvent.setup();
    render(<Chatbot />);

    const textarea = screen.getByPlaceholderText('Instruct SaMMy...');

    await user.type(textarea, 'Line 1\nLine 2\nLine 3\nLine 4');

    // Should still be within max height constraints
    // Ensure textarea height is adjusted dynamically
    window.getComputedStyle(textarea);
    expect(textarea.style.height).toBeTruthy();
  });
});
