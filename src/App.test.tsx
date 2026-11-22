import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const EMPTY = JSON.stringify({ name: 'Test flat', currency: 'USD', people: [], expenses: [], settlements: [] });

describe('FairSplit workflow', () => {
  it('opens with a labelled demo group and a settle-up plan', () => {
    window.location.hash = '/balances';
    render(<App />);
    expect(screen.getAllByText('Demo data').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Mark .* paid/ }).length).toBeGreaterThan(0);
  });

  it('adds people, records an expense with validation, and settles up', async () => {
    localStorage.setItem('fairsplit:group', EMPTY);
    window.location.hash = '/people';
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Add person' }));
    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
    for (const n of ['Ana', 'Ben']) {
      await user.type(screen.getByLabelText('Name'), n);
      await user.click(screen.getByRole('button', { name: 'Add person' }));
    }
    await user.type(screen.getByLabelText('Name'), 'ana');
    await user.click(screen.getByRole('button', { name: 'Add person' }));
    expect(screen.getByText(/already in the group/)).toBeInTheDocument();
    unmount();

    window.location.hash = '/expenses';
    const r2 = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(screen.getByText(/Describe the expense/)).toBeInTheDocument();
    expect(screen.getByText('Enter an amount like 42.50.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Description'), 'Groceries');
    await user.type(screen.getByLabelText('Amount (USD)'), '50.01');
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(screen.getByText(/Added “Groceries”/)).toBeInTheDocument();
    r2.unmount();

    window.location.hash = '/balances';
    render(<App />);
    expect(screen.getByTestId('bal-Ben')).toHaveTextContent('−$25.00');
    expect(screen.getByTestId('bal-Ana')).toHaveTextContent('+$25.00');
    await user.click(screen.getByRole('button', { name: 'Mark Ben paid Ana' }));
    expect(screen.getByText(/Recorded: Ben paid Ana/)).toBeInTheDocument();
    expect(screen.getByText('Everyone is square.')).toBeInTheDocument();
  });

  it('refuses to remove someone who is part of expenses', async () => {
    window.location.hash = '/people';
    const user = userEvent.setup();
    render(<App />);
    const card = screen.getByText('Chloe').closest('li')!;
    await user.click(within(card).getByRole('button', { name: 'Remove Chloe' }));
    expect(screen.getByText(/part of existing expenses/)).toBeInTheDocument();
  });

  it('filters and pages the expense table', async () => {
    window.location.hash = '/expenses';
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    await user.selectOptions(screen.getAllByLabelText('Category')[1], 'Groceries');
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });
});
