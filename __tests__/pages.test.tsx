import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Home from '../src/app/Components/Home';
import Chatbot from '../src/app/Components/Chatbot';

// Mock Next.js router
const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Mock fetch for API calls
beforeEach(() => {
  pushMock.mockClear();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn();
  window.localStorage.clear();
  jest.clearAllMocks();
});

describe('Home Component', () => {
  it('renders main landing page with content', () => {
    render(<Home />);

    expect(screen.getByText('SaMMy – AI Powered Social Media Manager')).toBeInTheDocument();
    expect(screen.getByText('Generate, schedule, and post engaging content across multiple platforms — all from one place.')).toBeInTheDocument();
    expect(screen.getAllByText('Login')).toHaveLength(2); // Two login buttons on page
    expect(screen.getAllByText('Register')).toHaveLength(2); // Two register buttons on page
  });

  it('displays features section', () => {
    render(<Home />);

    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('AI Content Generation')).toBeInTheDocument();
    expect(screen.getByText('Schedule & Automate')).toBeInTheDocument();
    expect(screen.getByText('Multi-Platform Integration')).toBeInTheDocument();
  });

  it('displays call-to-action section', () => {
    render(<Home />);

    expect(screen.getByText('Get Started Today')).toBeInTheDocument();
    expect(screen.getByText('Experience effortless social media management with SaMMy. Sign up now and transform your online presence.')).toBeInTheDocument();
  });
});

describe('Chatbot Component', () => {
  beforeEach(() => {
    // Mock localStorage token for authenticated access
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
  });

  it('renders chatbot interface with sidebar', () => {
    render(<Chatbot />);

    // Test elements that are actually rendered
    expect(screen.getByText('View Schedule')).toBeInTheDocument();
    expect(screen.getByText('See upcoming posts')).toBeInTheDocument();
    expect(screen.getByText('Manage Credentials')).toBeInTheDocument();
    expect(screen.getByText('Configure API keys & tokens')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('makes API call on component mount', async () => {
    const fetchMock = (globalThis as unknown as { fetch: jest.Mock }).fetch;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'user data' }),
    });

    render(<Chatbot />);

    // Should make API call to fetch user data
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/user', {
        headers: { Authorization: 'Bearer mock-token' },
      });
    });
  });
});
