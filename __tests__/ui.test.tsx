import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Badge from '../src/app/Components/UI/Badge';
import PasswordInput from '../src/app/Components/UI/PasswordInput';
import InputGroup from '../src/app/Components/UI/InputGroup';
import Login from '../src/app/Components/Login';
import Register from '../src/app/Components/Register';

// Mock Next.js router used in Login
const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

// Helper to access mocked fetch without using 'any'
const fetchMock = () => (globalThis as unknown as { fetch: jest.Mock }).fetch;

beforeEach(() => {
  pushMock.mockClear();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn();
  window.localStorage.clear();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Badge', () => {
  it('renders children and applies className', () => {
    render(<Badge className="bg-red-500">New</Badge>);
    const el = screen.getByText('New');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('bg-red-500');
  });
});

describe('PasswordInput', () => {
  it('toggles visibility via button', async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Password" />);
    const input = screen.getByPlaceholderText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');

    const showBtn = screen.getByRole('button', { name: /show value/i });
    await user.click(showBtn);
    expect(input.type).toBe('text');

    const hideBtn = screen.getByRole('button', { name: /hide value/i });
    await user.click(hideBtn);
    expect(input.type).toBe('password');
  });
});

describe('InputGroup', () => {
  it('renders label and password input when type=password', () => {
    render(
      <InputGroup
        id="pwd"
        label="Password"
        type="password"
        placeholder="Password"
      />
    );
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    // Toggle button from PasswordInput should exist
    expect(screen.getByRole('button', { name: /show value/i })).toBeInTheDocument();
  });
});

describe('Login', () => {
  it('submits credentials, stores token and navigates on success', async () => {
    const user = userEvent.setup();
    fetchMock().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'token123' }),
    });

    render(<Login onSwitchToRegister={() => {}} />);

    await user.type(screen.getByPlaceholderText('Email'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        '/api/auth/signin',
        expect.objectContaining({ method: 'POST' })
      );
    });

    expect(window.localStorage.getItem('token')).toBe('token123');
    expect(pushMock).toHaveBeenCalledWith('/chatbot');
  });

  it('shows error message on failure', async () => {
    const user = userEvent.setup();
    fetchMock().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Login failed' }),
    });

    render(<Login onSwitchToRegister={() => {}} />);

    await user.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByText(/login failed/i)).toBeInTheDocument();
  });
});

describe('Register', () => {
  it('shows mismatch error when passwords differ', async () => {
    const user = userEvent.setup();
    render(<Register onSwitchToLogin={() => {}} />);

    await user.type(screen.getByPlaceholderText('Email'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'abc');
    await user.type(screen.getByPlaceholderText('Confirm Password'), 'def');

    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('calls onSwitchToLogin after successful signup', async () => {
    const user = userEvent.setup();
    fetchMock().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const onSwitchToLogin = jest.fn();

    render(<Register onSwitchToLogin={onSwitchToLogin} />);

    await user.type(screen.getByPlaceholderText('Email'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'abc123');
    await user.type(screen.getByPlaceholderText('Confirm Password'), 'abc123');

    await user.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => expect(onSwitchToLogin).toHaveBeenCalled());
  });
});
