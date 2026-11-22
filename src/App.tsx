import { useMemo, useState } from 'react';
import { DemoTag, EmptyState, Field, Landing, NotFound, Notice, PageHead, Shell, uid, useFlash, usePersistentState, useRoute } from './shared/ui';
import { demoGroup, EMPTY_GROUP, type Group } from './lib/demo';
import { balances, CATEGORIES, formatMoney, parseAmount, settlePlan, spendByCategory, splitEqually, validateExpense, validatePerson, type Expense } from './lib/split';

const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/balances', label: 'Balances' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/people', label: 'People' },
];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY'];
type SetGroup = (fn: (g: Group) => Group) => void;
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [route] = useRoute();
  const [group, setRaw] = usePersistentState<Group>('fairsplit:group', demoGroup);
  const setGroup: SetGroup = (fn) => setRaw((g) => fn(g));
  let page;
  if (route === '/') page = <Home />;
  else if (route === '/balances') page = <Balances group={group} setGroup={setGroup} />;
  else if (route === '/expenses') page = <Expenses group={group} setGroup={setGroup} />;
  else if (route === '/people') page = <People group={group} setGroup={setGroup} />;
  else page = <NotFound />;
  return (
    <Shell name="FairSplit" wordmark={['Fair', 'Split']} nav={NAV} route={route} cta={{ to: '/expenses', label: 'Add expense' }}>
      {page}
    </Shell>
  );
}

const nameOf = (g: Group, id: string) => g.people.find((p) => p.id === id)?.name ?? 'Removed person';

function BalanceBars({ group }: { group: Group }) {
  const bal = balances(group.people, group.expenses, group.settlements);
  const max = Math.max(1, ...Object.values(bal).map(Math.abs));
  return (
    <ul className="bal-bars" aria-label="Net balance per person">
      {group.people.map((p, i) => {
        const v = bal[p.id];
        const w = (Math.abs(v) / max) * 50;
        return (
          <li key={p.id} style={{ ['--i' as string]: i }}>
            <span className="bal-name">{p.name}</span>
            <span className="bal-track" title={`${p.name}: ${v === 0 ? 'settled' : v > 0 ? `is owed ${formatMoney(v, group.currency)}` : `owes ${formatMoney(-v, group.currency)}`}`}>
              <span className={`bal-fill ${v >= 0 ? 'pos' : 'neg'}`} style={v >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />
              <span className="bal-zero" />
            </span>
            <span className={`bal-amt ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}`} data-testid={`bal-${p.name}`}>
              {v === 0 ? 'Settled' : `${v > 0 ? '+' : '−'}${formatMoney(Math.abs(v), group.currency)}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Home() {
  const g = demoGroup();
  const plan = settlePlan(balances(g.people, g.expenses, g.settlements));
  return (
    <Landing
      eyebrow="Shared expenses · housemates & trips"
      title={<>Who owes whom, <em>settled in the fewest payments.</em></>}
      lead="Record shared costs as they happen, choose who each one is split between, and FairSplit keeps a running balance for everyone — then suggests the smallest set of transfers that squares the group."
      primary={{ href: '#/balances', label: 'See balances' }}
      secondary={{ href: '#/expenses', label: 'Add an expense' }}
      previewLabel="Flat 4B — demo group"
      preview={
        <div className="hero-split">
          <BalanceBars group={g} />
          <div className="hs-plan">
            <span className="label-mono">To settle up · {plan.length} payments</span>
            {plan.map((t) => (
              <div key={t.from + t.to} className="hs-transfer">
                <strong>{nameOf(g, t.from)}</strong> <span className="arrow-line" aria-hidden="true" /> <strong>{nameOf(g, t.to)}</strong>
                <span className="hs-amt">{formatMoney(t.amountCents, g.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      }
      steps={[
        { title: 'Add the group', body: 'List everyone sharing costs — housemates, a trip, a club.' },
        { title: 'Record expenses', body: 'Who paid, how much, and which people it is split between.' },
        { title: 'Settle up', body: 'Follow the suggested transfers and mark each one paid.' },
      ]}
      stepsIntro="FairSplit opens with a labelled four-person demo flat so you can see balances immediately."
      features={[
        { title: 'Exact to the cent', body: 'Amounts are stored as whole cents; uneven splits hand the leftover cents out fairly.' },
        { title: 'Minimal transfers', body: 'A greedy plan pays the biggest debts first, so the group needs at most n−1 payments.' },
        { title: 'Partial splits', body: 'Exclude people from expenses that were not theirs, like a takeaway they missed.' },
        { title: 'Spending view', body: 'See totals by category and filter, sort and page through every expense.' },
      ]}
      note="FairSplit does not move money or connect to banks. “Mark as paid” only records that a payment happened."
      closing={{ title: <>Square up <em>your group.</em></>, action: { href: '#/balances', label: 'Open balances' } }}
    />
  );
}

function DemoBar({ group, setGroup }: { group: Group; setGroup: SetGroup }) {
  if (!group.demo) return null;
  return (
    <Notice kind="info">
      <span className="row">
        <DemoTag /> You are looking at a fictional demo group.
        <button type="button" className="btn btn-sm" onClick={() => setGroup(() => EMPTY_GROUP)}>Start my own group</button>
      </span>
    </Notice>
  );
}

function Balances({ group, setGroup }: { group: Group; setGroup: SetGroup }) {
  const [flash, setFlash] = useFlash();
  const bal = useMemo(() => balances(group.people, group.expenses, group.settlements), [group]);
  const plan = settlePlan(bal);
  const total = group.expenses.reduce((n, e) => n + e.amountCents, 0);
  const cats = spendByCategory(group.expenses);
  const catMax = Math.max(1, ...cats.map(([, v]) => v));
  if (group.people.length === 0)
    return (
      <EmptyState title="No one in the group yet" actions={<><a className="btn btn-primary" href="#/people">Add people</a><button type="button" className="btn" onClick={() => setGroup(() => demoGroup())}>Load demo group</button></>}>
        Add the people who share costs, then record what each person paid.
      </EmptyState>
    );
  function markPaid(t: { from: string; to: string; amountCents: number }) {
    setGroup((g) => ({ ...g, settlements: [...g.settlements, { id: uid('set'), ...t, date: todayISO() }] }));
    setFlash({ kind: 'success', text: `Recorded: ${nameOf(group, t.from)} paid ${nameOf(group, t.to)} ${formatMoney(t.amountCents, group.currency)}.` });
  }
  return (
    <div className="stack">
      <PageHead
        eyebrow={`Workspace · ${group.name}`}
        title={<>Balances <em>&amp; settle-up</em></>}
        description={`${group.people.length} people · ${group.expenses.length} expenses · ${formatMoney(total, group.currency)} spent in total`}
        actions={
          <Field label="Currency">
            {(c) => (
              <select {...c} value={group.currency} onChange={(e) => setGroup((g) => ({ ...g, currency: e.target.value }))}>
                {CURRENCIES.map((x) => <option key={x}>{x}</option>)}
              </select>
            )}
          </Field>
        }
      />
      <DemoBar group={group} setGroup={setGroup} />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <div className="grid-2">
        <section className="card" aria-labelledby="net-title">
          <div className="card-title-row">
            <h2 id="net-title">Net balances</h2>
            <span className="legend"><span><i style={{ background: 'var(--ok)' }} />is owed</span><span><i style={{ background: 'var(--err)' }} />owes</span></span>
          </div>
          <BalanceBars group={group} />
        </section>
        <section className="card" aria-labelledby="plan-title">
          <div className="card-title-row">
            <h2 id="plan-title">Suggested payments</h2>
            <span className="badge">{plan.length} transfer{plan.length === 1 ? '' : 's'}</span>
          </div>
          {plan.length === 0 ? (
            <div className="all-square">
              <strong>Everyone is square.</strong>
              <p className="muted">No payments needed. New expenses will show up here.</p>
            </div>
          ) : (
            <ul className="list">
              {plan.map((t) => (
                <li key={t.from + t.to} className="transfer">
                  <span>
                    <strong>{nameOf(group, t.from)}</strong> pays <strong>{nameOf(group, t.to)}</strong>
                  </span>
                  <span className="transfer-amt">{formatMoney(t.amountCents, group.currency)}</span>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => markPaid(t)} aria-label={`Mark ${nameOf(group, t.from)} paid ${nameOf(group, t.to)}`}>Mark as paid</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="card" aria-labelledby="cat-title">
        <h2 id="cat-title">Spending by category</h2>
        {cats.length === 0 ? (
          <p className="muted">No expenses yet.</p>
        ) : (
          <div className="cat-bars">
            {cats.map(([c, v], i) => (
              <div key={c} className="cat-row" title={`${c}: ${formatMoney(v, group.currency)} (${Math.round((v / total) * 100)}% of spending)`}>
                <span>{c}</span>
                <span className="cat-track"><span className="cat-fill" style={{ width: `${(v / catMax) * 100}%`, ['--i' as string]: i }} /></span>
                <span className="num">{formatMoney(v, group.currency)} <span className="muted small">{Math.round((v / total) * 100)}%</span></span>
              </div>
            ))}
          </div>
        )}
      </section>
      {group.settlements.length > 0 && (
        <section className="card">
          <h2>Recorded payments</h2>
          <ul className="list small">
            {[...group.settlements].reverse().map((s) => (
              <li key={s.id} className="row row-between">
                <span>{s.date} · {nameOf(group, s.from)} paid {nameOf(group, s.to)}</span>
                <span className="row">
                  <strong>{formatMoney(s.amountCents, group.currency)}</strong>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGroup((g) => ({ ...g, settlements: g.settlements.filter((x) => x.id !== s.id) }))} aria-label={`Undo payment from ${nameOf(group, s.from)}`}>Undo</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const PAGE = 6;

function Expenses({ group, setGroup }: { group: Group; setGroup: SetGroup }) {
  const blank = () => ({ description: '', amount: '', paidBy: group.people[0]?.id ?? '', participants: group.people.map((p) => p.id), date: todayISO(), category: 'Groceries' });
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<ReturnType<typeof validateExpense>>({});
  const [flash, setFlash] = useFlash();
  const [filterCat, setFilterCat] = useState('all');
  const [filterPayer, setFilterPayer] = useState('all');
  const [sort, setSort] = useState<'date' | 'amount'>('date');
  const [page, setPage] = useState(0);

  const cents = parseAmount(form.amount);
  const shares = cents && form.participants.length ? splitEqually(cents, form.participants.length) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateExpense(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const ex: Expense = { id: uid('exp'), description: form.description.trim(), amountCents: cents!, paidBy: form.paidBy, participants: form.participants, date: form.date, category: form.category };
    setGroup((g) => ({ ...g, expenses: [ex, ...g.expenses] }));
    setFlash({ kind: 'success', text: `Added “${ex.description}” — ${formatMoney(ex.amountCents, group.currency)} split ${form.participants.length} way${form.participants.length === 1 ? '' : 's'}.` });
    setForm({ ...blank(), paidBy: form.paidBy });
  }
  const toggle = (id: string) => setForm({ ...form, participants: form.participants.includes(id) ? form.participants.filter((x) => x !== id) : [...form.participants, id] });

  const list = useMemo(() => {
    const l = group.expenses.filter((e) => (filterCat === 'all' || e.category === filterCat) && (filterPayer === 'all' || e.paidBy === filterPayer));
    return l.sort((a, b) => (sort === 'amount' ? b.amountCents - a.amountCents : b.date.localeCompare(a.date)));
  }, [group.expenses, filterCat, filterPayer, sort]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const shown = list.slice(page * PAGE, page * PAGE + PAGE);

  if (group.people.length === 0)
    return <EmptyState title="Add people first" actions={<a className="btn btn-primary" href="#/people">Add people</a>}>Every expense needs someone who paid and people to split it between.</EmptyState>;

  return (
    <div className="stack">
      <PageHead eyebrow={`Workspace · ${group.name}`} title={<>Ex<em>penses</em></>} description={`${group.expenses.length} recorded · ${formatMoney(group.expenses.reduce((n, e) => n + e.amountCents, 0), group.currency)} total`} />
      <DemoBar group={group} setGroup={setGroup} />
      <div className="layout-side">
        <form className="card stack" onSubmit={submit} noValidate aria-labelledby="add-exp">
          <h2 id="add-exp">Add an expense</h2>
          <Field label="Description" error={errors.description}>{(c) => <input type="text" {...c} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Electricity bill" />}</Field>
          <div className="form-grid">
            <Field label={`Amount (${group.currency})`} error={errors.amount}>{(c) => <input type="text" inputMode="decimal" {...c} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />}</Field>
            <Field label="Date" error={errors.date}>{(c) => <input type="date" {...c} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
          </div>
          <div className="form-grid">
            <Field label="Paid by" error={errors.paidBy}>
              {(c) => (
                <select {...c} value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })}>
                  {group.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </Field>
            <Field label="Category">
              {(c) => (
                <select {...c} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((x) => <option key={x}>{x}</option>)}
                </select>
              )}
            </Field>
          </div>
          <fieldset className="split-with">
            <legend className="label">Split between</legend>
            <div className="chips">
              {group.people.map((p, i) => (
                <label key={p.id} className={`chip ${form.participants.includes(p.id) ? 'on' : ''}`}>
                  <input type="checkbox" checked={form.participants.includes(p.id)} onChange={() => toggle(p.id)} />
                  {p.name}
                  {shares && form.participants.includes(p.id) && <span className="chip-share">{formatMoney(shares[form.participants.indexOf(p.id)] ?? shares[i % shares.length], group.currency)}</span>}
                </label>
              ))}
            </div>
            {errors.participants && <span className="error-text">{errors.participants}</span>}
          </fieldset>
          <button type="submit" className="btn btn-primary">Add expense</button>
          {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
        </form>
        <div className="stack">
          <div className="card toolbar">
            <Field label="Category">
              {(c) => (
                <select {...c} value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setPage(0); }}>
                  <option value="all">All categories</option>
                  {CATEGORIES.map((x) => <option key={x}>{x}</option>)}
                </select>
              )}
            </Field>
            <Field label="Paid by">
              {(c) => (
                <select {...c} value={filterPayer} onChange={(e) => { setFilterPayer(e.target.value); setPage(0); }}>
                  <option value="all">Anyone</option>
                  {group.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </Field>
            <Field label="Sort by">
              {(c) => (
                <select {...c} value={sort} onChange={(e) => setSort(e.target.value as 'date' | 'amount')}>
                  <option value="date">Newest first</option>
                  <option value="amount">Largest first</option>
                </select>
              )}
            </Field>
          </div>
          {list.length === 0 ? (
            <EmptyState title={group.expenses.length === 0 ? 'No expenses yet' : 'Nothing matches these filters'}>
              {group.expenses.length === 0 ? 'Add the first shared cost with the form.' : 'Try a different category or payer.'}
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th>Paid by</th><th>Split</th><th className="num">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {shown.map((e) => (
                    <tr key={e.id}>
                      <td className="nowrap">{e.date}</td>
                      <td>{e.description} <span className="badge">{e.category}</span> {e.id.startsWith('demo') && <DemoTag />}</td>
                      <td>{nameOf(group, e.paidBy)}</td>
                      <td className="small muted">{e.participants.length === group.people.length ? 'Everyone' : e.participants.map((id) => nameOf(group, id)).join(', ')}</td>
                      <td className="num">{formatMoney(e.amountCents, group.currency)}</td>
                      <td><button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => setGroup((g) => ({ ...g, expenses: g.expenses.filter((x) => x.id !== e.id) }))} aria-label={`Delete ${e.description}`}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <nav className="row pager" aria-label="Expense pages">
              <button type="button" className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button>
              <span className="small muted">Page {page + 1} of {pages}</span>
              <button type="button" className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next →</button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

function People({ group, setGroup }: { group: Group; setGroup: SetGroup }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const bal = balances(group.people, group.expenses, group.settlements);
  function add(e: React.FormEvent) {
    e.preventDefault();
    const err = validatePerson(name, group.people);
    setError(err);
    if (err) return;
    setGroup((g) => ({ ...g, people: [...g.people, { id: uid('p'), name: name.trim() }] }));
    setFlash({ kind: 'success', text: `${name.trim()} joined the group.` });
    setName('');
  }
  function remove(id: string) {
    const involved = group.expenses.some((x) => x.paidBy === id || x.participants.includes(id));
    if (involved) {
      setFlash({ kind: 'error', text: `${nameOf(group, id)} is part of existing expenses. Delete or edit those first so balances stay correct.` });
      return;
    }
    setGroup((g) => ({ ...g, people: g.people.filter((p) => p.id !== id) }));
  }
  return (
    <div className="stack">
      <PageHead eyebrow="Workspace · Group" title={<>Peo<em>ple</em></>} description="Everyone who shares costs in this group." />
      <DemoBar group={group} setGroup={setGroup} />
      {flash && <Notice kind={flash.kind} onDismiss={() => setFlash(null)}>{flash.text}</Notice>}
      <div className="layout-side">
        <form className="card stack" onSubmit={add} noValidate>
          <h2>Add a person</h2>
          <Field label="Name" error={error}>{(c) => <input type="text" {...c} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" />}</Field>
          <Field label="Group name">{(c) => <input type="text" {...c} value={group.name} maxLength={40} onChange={(e) => setGroup((g) => ({ ...g, name: e.target.value || 'My household' }))} />}</Field>
          <button type="submit" className="btn btn-primary">Add person</button>
        </form>
        {group.people.length === 0 ? (
          <EmptyState title="Nobody here yet" actions={<button type="button" className="btn" onClick={() => setGroup(() => demoGroup())}>Load demo group</button>}>Add at least two people to start splitting.</EmptyState>
        ) : (
          <ul className="people-grid">
            {group.people.map((p) => (
              <li key={p.id} className="card person">
                <span className="avatar" aria-hidden="true">{p.name[0]?.toUpperCase()}</span>
                <div>
                  <strong>{p.name}</strong>
                  <div className={`small ${bal[p.id] > 0 ? 'pos' : bal[p.id] < 0 ? 'neg' : 'muted'}`}>
                    {bal[p.id] === 0 ? 'Settled up' : bal[p.id] > 0 ? `Is owed ${formatMoney(bal[p.id], group.currency)}` : `Owes ${formatMoney(-bal[p.id], group.currency)}`}
                  </div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
