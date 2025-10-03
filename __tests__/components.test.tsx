import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Button from '../src/app/Components/UI/Button';
import Card from '../src/app/Components/UI/Card';
import Input from '../src/app/Components/UI/Input';
import Label from '../src/app/Components/UI/Label';
import MessageBubble from '../src/app/Components/MessageBubble';
import { Message } from '../src/app/Types';

describe('Button', () => {
  it('renders with primary variant by default', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-gradient-to-r', 'from-blue-500', 'to-purple-500');
  });

  it('renders with secondary variant when specified', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button', { name: 'Secondary' });
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveClass('bg-gradient-to-r');
  });

  it('handles click events', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button', { name: 'Click me' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
  });
});

describe('Card', () => {
  it('renders children with default styling', () => {
    render(<Card>Card content</Card>);
    const card = screen.getByText('Card content');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('rounded-lg', 'bg-gray-800/40');
  });

  it('applies custom className', () => {
    render(<Card className="custom-class">Card content</Card>);
    const card = screen.getByText('Card content');
    expect(card).toHaveClass('custom-class');
  });
});

describe('Input', () => {
  it('renders with placeholder and handles input', async () => {
    const user = userEvent.setup();
    render(<Input placeholder="Enter text" />);

    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();

    await user.type(input, 'Hello world');
    expect(input).toHaveValue('Hello world');
  });

  it('handles focus and blur events', async () => {
    const user = userEvent.setup();
    const onFocus = jest.fn();
    const onBlur = jest.fn();

    render(<Input onFocus={onFocus} onBlur={onBlur} />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    expect(onFocus).toHaveBeenCalled();

    await user.tab();
    expect(onBlur).toHaveBeenCalled();
  });
});

describe('Label', () => {
  it('renders text and associates with input', () => {
    render(
      <div>
        <Label htmlFor="test-input">Username</Label>
        <input id="test-input" />
      </div>
    );

    const label = screen.getByText('Username');
    const input = screen.getByRole('textbox');

    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', 'test-input');
    expect(input).toHaveAttribute('id', 'test-input');
  });
});

describe('MessageBubble', () => {
  const mockMessage: Message = {
    id: '1',
    sender: 'ai',
    content: 'Hello from AI',
    timestamp: Date.now(),
    status: 'pending',
    platform: 'twitter'
  };

  const defaultProps = {
    message: mockMessage,
    onApprove: jest.fn(),
    onReject: jest.fn(),
    isLatestAiMessage: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user message correctly', () => {
    const userMessage: Message = { ...mockMessage, sender: 'user' };
    render(<MessageBubble {...defaultProps} message={userMessage} />);

    expect(screen.getByText('Hello from AI')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('renders AI message with platform badge', () => {
    render(<MessageBubble {...defaultProps} />);

    expect(screen.getByText('Hello from AI')).toBeInTheDocument();
    expect(screen.getByText('SaMMy')).toBeInTheDocument();
    expect(screen.getByText('twitter')).toBeInTheDocument();
  });

  it('shows pending status with approve/reject buttons', () => {
    render(<MessageBubble {...defaultProps} />);

    expect(screen.getByText('📝 Ready for review')).toBeInTheDocument();
    expect(screen.getByTitle('Approve')).toBeInTheDocument();
    expect(screen.getByTitle('Reject')).toBeInTheDocument();
    expect(screen.getByTitle('Edit post')).toBeInTheDocument();
  });

  it('calls onApprove when approve button is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageBubble {...defaultProps} />);

    await user.click(screen.getByTitle('Approve'));
    expect(defaultProps.onApprove).toHaveBeenCalledWith('1');
  });

  it('calls onReject when reject button is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageBubble {...defaultProps} />);

    await user.click(screen.getByTitle('Reject'));
    expect(defaultProps.onReject).toHaveBeenCalledWith('1');
  });

  it('enters edit mode when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageBubble {...defaultProps} />);

    await user.click(screen.getByTitle('Edit post'));

    expect(screen.getByDisplayValue('Hello from AI')).toBeInTheDocument();
    expect(screen.getByTitle('Save')).toBeInTheDocument();
    expect(screen.getByTitle('Cancel')).toBeInTheDocument();
  });

  it('saves edited content when save button is clicked', async () => {
    const user = userEvent.setup();
    const onEditSave = jest.fn();
    render(<MessageBubble {...defaultProps} onEditSave={onEditSave} />);

    await user.click(screen.getByTitle('Edit post'));

    const textarea = screen.getByDisplayValue('Hello from AI');
    await user.clear(textarea);
    await user.type(textarea, 'Edited message');

    await user.click(screen.getByTitle('Save'));

    expect(onEditSave).toHaveBeenCalledWith('1', 'Edited message');
  });

  it('cancels edit when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<MessageBubble {...defaultProps} />);

    await user.click(screen.getByTitle('Edit post'));

    const textarea = screen.getByDisplayValue('Hello from AI');
    await user.clear(textarea);
    await user.type(textarea, 'Changed text');

    await user.click(screen.getByTitle('Cancel'));

    // Should exit edit mode and revert content
    expect(screen.queryByDisplayValue('Changed text')).not.toBeInTheDocument();
    expect(screen.getByText('Hello from AI')).toBeInTheDocument();
  });

  it('shows posted status correctly', () => {
    const postedMessage: Message = { ...mockMessage, status: 'posted' };
    render(<MessageBubble {...defaultProps} message={postedMessage} />);

    expect(screen.getByText('Posted')).toBeInTheDocument();
  });

  it('shows rejected status correctly', () => {
    const rejectedMessage: Message = { ...mockMessage, status: 'rejected' };
    render(<MessageBubble {...defaultProps} message={rejectedMessage} />);

    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('shows posting status with spinner', () => {
    const postingMessage: Message = { ...mockMessage, status: 'posting' };
    render(<MessageBubble {...defaultProps} message={postingMessage} />);

    expect(screen.getByText('Posting...')).toBeInTheDocument();
  });
});
