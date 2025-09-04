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
    // Reset crypto.randomUUID counter for consistent testing
    let counter = 0;
    (global.crypto.randomUUID as jest.Mock).mockImplementation(() => `mock-uuid-${++counter}`);
  });

  describe('Rendering', () => {
    test('renders the chat interface correctly', () => {
      render(<ChatBot />);
      
      expect(screen.getByText('SaMMy')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Instruct SaMMy...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    test('renders with correct styling classes', () => {
      render(<ChatBot />);
      
      // Use more flexible selectors for CSS classes
      const container = document.querySelector('[class*="bg-gradient"]');
      expect(container).toBeInTheDocument();
      
      // Look for elements with backdrop blur or glass morphism effects
      const chatContainer = document.querySelector('[class*="bg-white"][class*="20"]') || 
                           document.querySelector('[class*="backdrop-blur"]');
      expect(chatContainer).toBeInTheDocument();
    });

    test('send button is disabled when input is empty', () => {
      render(<ChatBot />);
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    test('send button is enabled when input has content', async () => {
      const user = userEvent.setup();
      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      const sendButton = screen.getByRole('button', { name: /send/i });
      
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
      const sendButton = screen.getByRole('button', { name: /send/i });
      
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
      await user.click(screen.getByRole('button', { name: /send/i }));
      
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
      const sendButton = screen.getByRole('button', { name: /send/i });
      
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
      await user.click(screen.getByRole('button', { name: /send/i }));
      
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
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      await waitFor(() => {
        expect(screen.getByText('This is the AI generated post')).toBeInTheDocument();
        // Use more flexible text matching
        expect(screen.getByText(/draft for review/i) || screen.getByText(/⏳/)).toBeInTheDocument();
      });
    });

    test('handles API error gracefully', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Test message');
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/failed to generate post/i)).toBeInTheDocument();
        expect(screen.getByText(/error/i) || screen.getByText(/❌/)).toBeInTheDocument();
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
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      // Check loading state with more flexible selector
      await waitFor(() => {
        const loadingSpinner = document.querySelector('.animate-spin') || 
                              document.querySelector('[class*="loading"]') ||
                              screen.queryByText(/loading/i);
        expect(loadingSpinner).toBeInTheDocument();
      });
      
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
        const loadingSpinner = document.querySelector('.animate-spin');
        expect(loadingSpinner).not.toBeInTheDocument();
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
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/approve.*post/i) || screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
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
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/approve.*post/i) || screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
      });
      
      const approveButton = screen.getByText(/approve.*post/i) || screen.getByRole('button', { name: /approve/i });
      await user.click(approveButton);
      
      // Based on the DOM output, the component goes directly to "Posted" state
      // Check final posted state
      await waitFor(() => {
        expect(screen.getByText(/posted/i) || screen.getByText(/✔️/)).toBeInTheDocument();
      }, { timeout: 3000 });
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
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/approve.*post/i) || screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
      });
      
      const approveButton = screen.getByText(/approve.*post/i) || screen.getByRole('button', { name: /approve/i });
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
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/approve.*post/i) || screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
      });
      
      const approveButton = screen.getByText(/approve.*post/i) || screen.getByRole('button', { name: /approve/i });
      await user.click(approveButton);
      
      await waitFor(() => {
        expect(screen.getByText(/error/i) || screen.getByText(/❌/)).toBeInTheDocument();
      });
    });

    test('does not show approve button for non-pending messages', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Test message');
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/failed to generate post/i)).toBeInTheDocument();
      });
      
      expect(screen.queryByText(/approve.*post/i)).not.toBeInTheDocument();
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
      
      // Trigger the resize event manually if needed
      fireEvent.input(textarea);
      
      // The useEffect should have updated the height
      await waitFor(() => {
        expect(textarea.style.height).toBe('100px');
      });
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
      await user.click(screen.getByRole('button', { name: /send/i }));
      
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
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      await waitFor(() => {
        // Find the message container divs (the ones with bg classes)
        const userMessageContainer = screen.getByText('User message').parentElement;
        const aiMessageContainer = screen.getByText('AI response message').parentElement;
        
        // Check that user message container has blue background
        expect(userMessageContainer).toHaveClass('bg-blue-500');
        expect(userMessageContainer).toHaveClass('text-white');
        
        // Check that AI message container has white/transparent background
        expect(aiMessageContainer?.className).toMatch(/bg-white\/30/);
      });
    });
  });

  describe('Edge Cases', () => {
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
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/no response/i) || screen.getByText(/error/i)).toBeInTheDocument();
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
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      expect(crypto.randomUUID).toHaveBeenCalledTimes(2); // Once for user message, once for AI message
    });

    test('handles network errors gracefully', async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      
      await user.type(textarea, 'Test message');
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/failed to generate post/i) || screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    test('prevents multiple simultaneous submissions', async () => {
      const user = userEvent.setup();
      let resolveFirst: (value: any) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      
      (fetch as jest.Mock).mockReturnValueOnce(firstPromise);

      render(<ChatBot />);
      
      const textarea = screen.getByPlaceholderText('Instruct SaMMy...');
      const sendButton = screen.getByRole('button', { name: /send/i });
      
      await user.type(textarea, 'First message');
      await user.click(sendButton);
      
      // Try to send another message while first is loading
      await user.type(textarea, 'Second message');
      
      // Button should be disabled during loading
      expect(sendButton).toBeDisabled();
      
      // Resolve first request
      resolveFirst!({
        ok: true,
        json: async () => ({
          review: {
            post: 'Response',
            threadId: 'thread-123'
          }
        })
      });
      
      await waitFor(() => {
        expect(sendButton).not.toBeDisabled();
      });
    });
  });
});