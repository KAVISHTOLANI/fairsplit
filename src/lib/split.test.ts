import { describe, expect, it } from 'vitest';
import { balances, formatMoney, parseAmount, settlePlan, spendByCategory, splitEqually, validateExpense, validatePerson, type Expense } from './split';

const people = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Chloe' }];
const exp = (o: Partial<Expense>): Expense => ({ id: Math.random().toString(), description: 'x', amountCents: 3000, paidBy: 'a', participants: ['a', 'b', 'c'], date: '2026-03-01', category: 'Other', ...o });

describe('amounts', () => {
  it('parses common formats into cents', () => {
    expect(parseAmount('12.5')).toBe(1250);
    expect(parseAmount('12,50')).toBe(1250);
    expect(parseAmount('1,234.56')).toBe(123456);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('12.345')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
  it('splits without losing cents', () => {
    expect(splitEqually(1000, 3)).toEqual([334, 333, 333]);
    expect(splitEqually(1000, 3).reduce((a, b) => a + b)).toBe(1000);
  });
  it('formats money', () => {
    expect(formatMoney(123456, 'USD')).toMatch(/1,234\.56/);
  });
});

describe('balances and settlement', () => {
  it('computes net balances that sum to zero', () => {
    const b = balances(people, [exp({ amountCents: 3000, paidBy: 'a' }), exp({ amountCents: 1500, paidBy: 'b', participants: ['b', 'c'] })]);
    expect(b).toEqual({ a: 2000, b: -250, c: -1750 });
    expect(Object.values(b).reduce((x, y) => x + y)).toBe(0);
  });
  it('applies recorded settlements', () => {
    const b = balances(people, [exp({ amountCents: 3000 })], [{ id: 's', from: 'b', to: 'a', amountCents: 1000, date: '2026-03-02' }]);
    expect(b).toEqual({ a: 1000, b: 0, c: -1000 });
  });
  it('produces a minimal plan that clears every balance', () => {
    const b = { a: 2000, b: 500, c: -2500 };
    const plan = settlePlan(b);
    expect(plan).toEqual([{ from: 'c', to: 'a', amountCents: 2000 }, { from: 'c', to: 'b', amountCents: 500 }]);
    expect(settlePlan({ a: 0, b: 0 })).toEqual([]);
  });
  it('ignores expenses whose people were removed', () => {
    expect(balances([people[0]], [exp({ paidBy: 'b' })])).toEqual({ a: 0 });
  });
  it('totals spend by category', () => {
    expect(spendByCategory([exp({ category: 'Rent', amountCents: 100 }), exp({ category: 'Rent', amountCents: 50 }), exp({ category: 'Other', amountCents: 10 })])).toEqual([['Rent', 150], ['Other', 10]]);
  });
});

describe('validation', () => {
  it('validates expenses and people', () => {
    expect(Object.keys(validateExpense({ description: '', amount: '0', paidBy: '', participants: [], date: '' })).sort()).toEqual(['amount', 'date', 'description', 'paidBy', 'participants']);
    expect(validateExpense({ description: 'Rent', amount: '1200', paidBy: 'a', participants: ['a'], date: '2026-03-01' })).toEqual({});
    expect(validatePerson('ana', people)).toMatch(/already/);
    expect(validatePerson('', people)).toBeTruthy();
  });
});
