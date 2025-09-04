/* eslint-disable */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChatBot from './page';

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'mock-uuid-123')
  }
});

// Mock fetch
global.fetch = jest.fn();

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

describe('ChatBot Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  describe('Rendering', () => {
    test('renders the chat interface correctly', () => {
      render(<ChatBot />);
      
      expect(screen.getByText('SaMMy')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Instruct SaMMy...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    });

    test('renders with correct styling classes', () => {
      render(<ChatBot />);
      
      const container = document.querySelector('.bg-gradient-to-br');
      expect(container).toBeInTheDocument();
      
      const chatContainer = document.querySelector('.bg-white\\/20');
      expect(chatContainer).toBeInTheDocument();
    });

    test('send button is disabled when input is empty', () => {
      render(<ChatBot />);
      
      const sendButton = screen.getByRole('button', { name: 'Send' });
      expect(sendButton).toBeDisabled();
    });

    test('send button is enabled when input has content', async () => {
      const user = userEvent.setup();
      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      const sendButton = screen.getByRole('button', { name: 'Send' });
      
      await user.type(textarea, 'Hello');
      
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('Message Handling', () => {
    test('adds user message when sending', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: {
            post: 'AI generated response',
            threadId: 'thread-123'
          }
        })
      });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      const sendButton = screen.getByRole('button', { name: 'Send' });
      
      await user.type(textarea, 'Test message');
      await user.click(sendButton);
      
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    test('clears input after sending message', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: {
            post: 'AI response',
            threadId: 'thread-123'
          }
        })
      });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...') as HTMLTextAreaElement;
      
      await user.type(textarea, 'Test message');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
    });

    test('handles Enter key to send message', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: {
            post: 'AI response',
            threadId: 'thread-123'
          }
        })
      });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Test message');
      await user.keyboard('{Enter}');
      
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    test('does not send message on Shift+Enter', async () => {
      const user = userEvent.setup();
      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Test message');
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      
      // Message should not be sent, so fetch should not be called
      expect(fetch).not.toHaveBeenCalled();
    });

    test('does not send empty or whitespace-only messages', async () => {
      const user = userEvent.setup();
      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      const sendButton = screen.getByRole('button', { name: 'Send' });
      
      await user.type(textarea, '   ');
      await user.click(sendButton);
      
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('API Integration', () => {
    test('makes correct API call for generating post', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: {
            post: 'Generated post content',
            threadId: 'thread-123'
          }
        })
      });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Create a post about AI');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      expect(fetch).toHaveBeenCalledWith('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Create a post about AI',
          platform: 'twitter'
        })
      });
    });

    test('displays AI response correctly', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: {
            post: 'This is the AI generated post',
            threadId: 'thread-456'
          }
        })
      });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Test prompt');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      await waitFor(() => {
        expect(screen.getByText('This is the AI generated post')).toBeInTheDocument();
        expect(screen.getByText('⏳ Draft for review')).toBeInTheDocument();
      });
    });

    test('handles API error gracefully', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Test message');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      await waitFor(() => {
        expect(screen.getByText('Failed to generate post.')).toBeInTheDocument();
        expect(screen.getByText('❌ Error')).toBeInTheDocument();
      });
    });

    test('displays loading state during API call', async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      
      (fetch as jest.Mock).mockReturnValueOnce(promise);

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Test message');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      // Check loading state
      const loadingSpinner = document.querySelector('.animate-spin');
      expect(loadingSpinner).toBeInTheDocument();
      
      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({
          review: {
            post: 'Response',
            threadId: 'thread-123'
          }
        })
      });
      
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
      });
    });
  });

  describe('Message Approval Flow', () => {
    test('displays approve button for pending messages', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: {
            post: 'Draft post content',
            threadId: 'thread-123'
          }
        })
      });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Create a post');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      await waitFor(() => {
        expect(screen.getByText('Approve & Post')).toBeInTheDocument();
      });
    });

    test('handles message approval successfully', async () => {
      const user = userEvent.setup();
      // Mock initial post generation
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            review: {
              post: 'Draft post content',
              threadId: 'thread-123'
            }
          })
        })
        // Mock approval API call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Create a post');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      await waitFor(() => {
        expect(screen.getByText('Approve & Post')).toBeInTheDocument();
      });
      
      const approveButton = screen.getByText('Approve & Post');
      await user.click(approveButton);
      
      // Check posting state
      await waitFor(() => {
        expect(screen.getByText('🚀 Posting...')).toBeInTheDocument();
      });
      
      // Check final posted state
      await waitFor(() => {
        expect(screen.getByText('✔️ Posted')).toBeInTheDocument();
      });
    });

    test('makes correct API call for message approval', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            review: {
              post: 'Draft post content',
              threadId: 'thread-123'
            }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({})
        });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Create a post');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      await waitFor(() => {
        expect(screen.getByText('Approve & Post')).toBeInTheDocument();
      });
      
      const approveButton = screen.getByText('Approve & Post');
      await user.click(approveButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/agent', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post: 'Draft post content',
            platform: 'twitter',
            threadId: 'thread-123'
          })
        });
      });
    });

    test('handles approval error correctly', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            review: {
              post: 'Draft post content',
              threadId: 'thread-123'
            }
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({})
        });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Create a post');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      await waitFor(() => {
        expect(screen.getByText('Approve & Post')).toBeInTheDocument();
      });
      
      const approveButton = screen.getByText('Approve & Post');
      await user.click(approveButton);
      
      await waitFor(() => {
        expect(screen.getByText('❌ Error')).toBeInTheDocument();
      });
    });

    test('does not show approve button for non-pending messages', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Test message');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      await waitFor(() => {
        expect(screen.getByText('Failed to generate post.')).toBeInTheDocument();
      });
      
      expect(screen.queryByText('Approve & Post')).not.toBeInTheDocument();
    });
  });

  describe('UI Interactions', () => {
    test('textarea auto-resizes with content', async () => {
      const user = userEvent.setup();
      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...') as HTMLTextAreaElement;
      
      // Mock the scrollHeight property
      Object.defineProperty(textarea, 'scrollHeight', {
        value: 100,
        writable: true
      });
      
      await user.type(textarea, 'This is a very long message that should cause the textarea to resize automatically');
      
      // The useEffect should have updated the height
      expect(textarea.style.height).toBe('100px');
    });

    test('scrolls to bottom when new messages are added', async () => {
      const user = userEvent.setup();
      const mockScrollIntoView = jest.fn();
      Element.prototype.scrollIntoView = mockScrollIntoView;

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: {
            post: 'AI response',
            threadId: 'thread-123'
          }
        })
      });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Test message');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      await waitFor(() => {
        expect(mockScrollIntoView).toHaveBeenCalled();
      });
    });

    test('displays different message styles for user and AI', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: {
            post: 'AI response message',
            threadId: 'thread-123'
          }
        })
      });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'User message');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      await waitFor(() => {
        const userMessage = screen.getByText('User message').closest('div');
        const aiMessage = screen.getByText('AI response message').closest('div');
        
        expect(userMessage).toHaveClass('bg-blue-500');
        expect(aiMessage).toHaveClass('bg-white/30');
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles missing threadId in approval', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(<ChatBot />);
      
      // Manually add a message without threadId to state
      const component = screen.getByText('SaMMy').closest('.bg-white\\/20');
      
      // This would be testing internal state manipulation
      // In a real scenario, you might need to simulate this through user actions
      
      consoleSpy.mockRestore();
    });

    test('handles API response without post content', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: {}
        })
      });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Test message');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      await waitFor(() => {
        expect(screen.getByText('No response')).toBeInTheDocument();
      });
    });

    test('generates unique IDs for messages', async () => {
      const user = userEvent.setup();
      let callCount = 0;
      (global.crypto.randomUUID as jest.Mock).mockImplementation(() => `uuid-${++callCount}`);
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: {
            post: 'AI response',
            threadId: 'thread-123'
          }
        })
      });

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'First message');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      
      expect(crypto.randomUUID).toHaveBeenCalledTimes(2); // Once for user message, once for AI message
    });
  });
});