export interface Person {
  id: string;
  name: string;
}
export interface Expense {
  id: string;
  description: string;
  amountCents: number;
  paidBy: string;
  participants: string[];
  date: string;
  category: string;
}
export interface Settlement {
  id: string;
  from: string;
  to: string;
  amountCents: number;
  date: string;
}

export const CATEGORIES = ['Rent', 'Groceries', 'Utilities', 'Internet', 'Household', 'Eating out', 'Transport', 'Other'];

/** Parses "12.50", "12,50" or "1,234.56" into integer cents. Returns null when invalid. */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/\s/g, '');
  if (!s) return null;
  let norm = s;
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) norm = s.replace(/,/g, '');
  else if (/^\d+,\d{1,2}$/.test(s)) norm = s.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) return null;
  return Math.round(Number(norm) * 100);
}

export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

/** Splits cents equally; the first participants absorb the leftover cents so the parts always sum exactly. */
export function splitEqually(amountCents: number, count: number): number[] {
  const base = Math.floor(amountCents / count);
  const rem = amountCents - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Net balance per person in cents: positive = is owed money, negative = owes money. */
export function balances(people: Person[], expenses: Expense[], settlements: Settlement[] = []): Record<string, number> {
  const bal: Record<string, number> = Object.fromEntries(people.map((p) => [p.id, 0]));
  for (const e of expenses) {
    const parts = e.participants.filter((id) => id in bal);
    if (parts.length === 0 || !(e.paidBy in bal)) continue;
    const shares = splitEqually(e.amountCents, parts.length);
    bal[e.paidBy] += e.amountCents;
    parts.forEach((id, i) => (bal[id] -= shares[i]));
  }
  for (const s of settlements) {
    if (s.from in bal) bal[s.from] += s.amountCents;
    if (s.to in bal) bal[s.to] -= s.amountCents;
  }
  return bal;
}

/** Greedy minimum-transfer plan: largest debtor pays largest creditor until everyone is square. */
export function settlePlan(bal: Record<string, number>): { from: string; to: string; amountCents: number }[] {
  const debtors = Object.entries(bal).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = Object.entries(bal).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const plan: { from: string; to: string; amountCents: number }[] = [];
  debtors.sort((a, b) => b.v - a.v);
  creditors.sort((a, b) => b.v - a.v);
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    if (amt > 0) plan.push({ from: debtors[i].id, to: creditors[j].id, amountCents: amt });
    debtors[i].v -= amt;
    creditors[j].v -= amt;
    if (debtors[i].v === 0) i++;
    if (creditors[j].v === 0) j++;
  }
  return plan;
}

export function validateExpense(input: { description: string; amount: string; paidBy: string; participants: string[]; date: string }) {
  const errors: Partial<Record<keyof typeof input, string>> = {};
  if (!input.description.trim()) errors.description = 'Describe the expense, e.g. “Electricity bill”.';
  else if (input.description.trim().length > 80) errors.description = 'Keep it under 80 characters.';
  const cents = parseAmount(input.amount);
  if (cents == null) errors.amount = 'Enter an amount like 42.50.';
  else if (cents === 0) errors.amount = 'The amount must be more than zero.';
  else if (cents > 100_000_000) errors.amount = 'That is more than 1,000,000 — check the amount.';
  if (!input.paidBy) errors.paidBy = 'Choose who paid.';
  if (input.participants.length === 0) errors.participants = 'Pick at least one person to split between.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.date = 'Pick a date.';
  return errors;
}

export function validatePerson(name: string, people: Person[]): string | null {
  const n = name.trim();
  if (!n) return 'Enter a name.';
  if (n.length > 30) return 'Keep names under 30 characters.';
  if (people.some((p) => p.name.toLowerCase() === n.toLowerCase())) return 'Someone with that name is already in the group.';
  return null;
}

export function spendByCategory(expenses: Expense[]) {
  const map = new Map<string, number>();
  for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amountCents);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
