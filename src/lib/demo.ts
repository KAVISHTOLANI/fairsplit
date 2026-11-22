import type { Expense, Person, Settlement } from './split';

export interface Group {
  name: string;
  currency: string;
  people: Person[];
  expenses: Expense[];
  settlements: Settlement[];
  demo?: boolean;
}

export const EMPTY_GROUP: Group = { name: 'My household', currency: 'USD', people: [], expenses: [], settlements: [] };

function iso(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function demoGroup(): Group {
  const people: Person[] = [
    { id: 'p-ana', name: 'Ana' },
    { id: 'p-ben', name: 'Ben' },
    { id: 'p-chloe', name: 'Chloe' },
    { id: 'p-dev', name: 'Dev' },
  ];
  const all = people.map((p) => p.id);
  const e = (id: string, description: string, amountCents: number, paidBy: string, participants: string[], daysAgo: number, category: string): Expense => ({ id, description, amountCents, paidBy, participants, date: iso(daysAgo), category });
  return {
    name: 'Flat 4B (demo)',
    currency: 'USD',
    demo: true,
    people,
    expenses: [
      e('demo-1', 'November rent', 240000, 'p-ana', all, 21, 'Rent'),
      e('demo-2', 'Electricity bill', 8642, 'p-ben', all, 18, 'Utilities'),
      e('demo-3', 'Fibre broadband (month)', 4500, 'p-chloe', all, 16, 'Internet'),
      e('demo-4', 'Weekly groceries', 12873, 'p-dev', all, 12, 'Groceries'),
      e('demo-5', 'Takeaway — Friday film night with everyone except Chloe who was away', 5410, 'p-ben', ['p-ana', 'p-ben', 'p-dev'], 9, 'Eating out'),
      e('demo-6', 'Cleaning supplies', 2199, 'p-ana', all, 6, 'Household'),
      e('demo-7', 'Groceries top-up', 3418, 'p-chloe', ['p-chloe', 'p-dev'], 3, 'Groceries'),
      e('demo-8', 'Taxi from the station', 2600, 'p-dev', ['p-ben', 'p-dev'], 1, 'Transport'),
    ],
    settlements: [{ id: 'demo-s1', from: 'p-dev', to: 'p-ana', amountCents: 30000, date: iso(10) }],
  };
}
