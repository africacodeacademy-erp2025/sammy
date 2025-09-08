/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import ChatBot from "./page";

// Mock crypto.randomUUID
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: jest.fn(() => "mock-uuid-123"),
  },
});

// Mock fetch
global.fetch = jest.fn();

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

describe("ChatBot Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
    let counter = 0;
    (global.crypto.randomUUID as jest.Mock).mockImplementation(
      () => `mock-uuid-${++counter}`
    );
  });

  describe("Rendering", () => {
    test("renders the chat interface correctly", () => {
      render(<ChatBot />);
      expect(screen.getByText("SaMMy")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Message SaMMy/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
    });

    test("send button is disabled when input is empty", () => {
      render(<ChatBot />);
      const sendButton = screen.getByRole("button", { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    test("send button is enabled when input has content", async () => {
      const user = userEvent.setup();
      render(<ChatBot />);
      const textarea = screen.getByPlaceholderText(/Message SaMMy/i);
      const sendButton = screen.getByRole("button", { name: /send/i });
      await user.type(textarea, "Hello");
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe("Message Handling", () => {
    test("adds user message when sending", async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: { post: "AI generated response", threadId: "thread-123" },
        }),
      });

      render(<ChatBot />);
      const textarea = screen.getByPlaceholderText(/Message SaMMy/i);
      const sendButton = screen.getByRole("button", { name: /send/i });
      await user.type(textarea, "Test message");
      await user.click(sendButton);
      expect(screen.getByText("Test message")).toBeInTheDocument();
    });

    test("clears input after sending message", async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: { post: "AI response", threadId: "thread-123" },
        }),
      });

      render(<ChatBot />);
      const textarea = screen.getByPlaceholderText(
        /Message SaMMy/i
      ) as HTMLTextAreaElement;
      await user.type(textarea, "Test message");
      await user.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(textarea.value).toBe("");
      });
    });

    test("does not send empty or whitespace-only messages", async () => {
      const user = userEvent.setup();
      render(<ChatBot />);
      const textarea = screen.getByPlaceholderText(/Message SaMMy/i);
      const sendButton = screen.getByRole("button", { name: /send/i });
      await user.type(textarea, "   ");
      await user.click(sendButton);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("API Integration", () => {
    test("makes correct API call for generating post", async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: { post: "Generated post content", threadId: "thread-123" },
        }),
      });

      render(<ChatBot />);
      const textarea = screen.getByPlaceholderText(/Message SaMMy/i);
      await user.type(textarea, "Create a post about AI");
      await user.click(screen.getByRole("button", { name: /send/i }));

      expect(fetch).toHaveBeenCalledWith("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Create a post about AI" }),
      });
    });

    test("displays AI response correctly", async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          review: { post: "AI generated post", threadId: "thread-456" },
        }),
      });

      render(<ChatBot />);
      const textarea = screen.getByPlaceholderText(/Message SaMMy/i);
      await user.type(textarea, "Test prompt");
      await user.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByText("AI generated post")).toBeInTheDocument();
        expect(screen.getByText(/draft/i)).toBeInTheDocument();
      });
    });
  });

  describe("Message Approval Flow", () => {
    test("makes correct API call for message approval", async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            review: { post: "Draft post", threadId: "thread-123" },
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      render(<ChatBot />);
      const textarea = screen.getByPlaceholderText(/Message SaMMy/i);
      await user.type(textarea, "Create a post");
      await user.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => screen.getByText(/approve/i));
      const approveButton = screen.getByText(/approve/i);
      await user.click(approveButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith("/api/agent", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            post: "Draft post",
            threadId: "thread-123",
          }),
        });
      });
    });

    test("handles approval error correctly", async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            review: { post: "Draft post", threadId: "thread-123" },
          }),
        })
        .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

      render(<ChatBot />);
      const textarea = screen.getByPlaceholderText(/Message SaMMy/i);
      await user.type(textarea, "Create a post");
      await user.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => screen.getByText(/approve/i));
      await user.click(screen.getByText(/approve/i));

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    test("handles API response without post content", async () => {
      const user = userEvent.setup();
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ review: {} }),
      });

      render(<ChatBot />);
      const textarea = screen.getByPlaceholderText(/Message SaMMy/i);
      await user.type(textarea, "Test message");
      await user.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByText(/no response/i)).toBeInTheDocument();
      });
    });

    test("prevents multiple simultaneous submissions", async () => {
      const user = userEvent.setup();
      let resolveFirst: (value: any) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      (fetch as jest.Mock).mockReturnValueOnce(firstPromise);

      render(<ChatBot />);
      const textarea = screen.getByPlaceholderText(/Message SaMMy/i);
      const sendButton = screen.getByRole("button", { name: /send/i });

      await user.type(textarea, "First message");
      await user.click(sendButton);

      await user.type(textarea, "Second message");
      expect(sendButton).toBeDisabled();

      resolveFirst!({
        ok: true,
        json: async () => ({
          review: { post: "Response", threadId: "thread-123" },
        }),
      });
      await waitFor(() => expect(sendButton).not.toBeDisabled());
    });
  });
});
