'use client';

// app/ui/wallet/wallet-client.tsx

import { useState, useTransition } from 'react';
import { ArrowsRightLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { createConversionAction, createTransferAction } from '@/app/lib/actions/wallet';
import type { WalletAccount } from '@/app/lib/db/wallet-accounts';
import { BankAccounts } from '../shared/status';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConvCurrency = 'EGP' | 'USD' | 'RMB';

type LiveRates = {
  egpPerUsd: number;
  rmbPerUsd: number;
  updatedAt: string;
};

function pairRate(from: ConvCurrency, to: ConvCurrency, r: LiveRates): number | null {
  if (from === 'USD' && to === 'EGP') return r.egpPerUsd;
  if (from === 'EGP' && to === 'USD') return 1 / r.egpPerUsd;
  if (from === 'USD' && to === 'RMB') return r.rmbPerUsd;
  if (from === 'RMB' && to === 'USD') return 1 / r.rmbPerUsd;
  if (from === 'EGP' && to === 'RMB') return r.rmbPerUsd / r.egpPerUsd;
  if (from === 'RMB' && to === 'EGP') return r.egpPerUsd / r.rmbPerUsd;
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank',
  cash:          'Cash',
  check:         'Check',
  vodafone_cash: 'Vodafone Cash',
};

const METHOD_COLORS: Record<string, string> = {
  bank_transfer: 'bg-blue-50 border-blue-100 text-blue-700',
  cash:          'bg-green-50 border-green-100 text-green-700',
  check:         'bg-purple-50 border-purple-100 text-purple-700',
  vodafone_cash: 'bg-red-50 border-red-100 text-red-700',
};

const inputClass = 'block w-full rounded-md border border-gray-200 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400';

// ── Total Balance Card ────────────────────────────────────────────────────────

function TotalCard({
  currency, amount, accent = false,
}: {
  currency: string; amount: number; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${accent ? 'text-blue-500' : 'text-gray-400'}`}>
        Total {currency}
      </p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${accent ? 'text-blue-700' : 'text-gray-800'}`}>
        {currency === 'EGP' ? 'E£' : currency === 'USD' ? '$' : '¥'} {fmt(amount)}
      </p>
    </div>
  );
}

// ── Account Breakdown ─────────────────────────────────────────────────────────

function AccountBreakdown({
  currency, accounts,
}: {
  currency: 'EGP' | 'USD' | 'RMB'; accounts: WalletAccount[];
}) {
  const filtered = accounts.filter((a) => a.currency === currency);
  const total    = filtered.reduce((s, a) => s + (Number(a.balance) > 0 ? Number(a.balance) : 0), 0);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
        {currency} Accounts
      </p>
      <div className="space-y-2">
        {filtered.map((acc) => {
          const pct = Number(acc.balance) >= 0 ? (Number(acc.balance) / total) * 100 : Number(acc.balance);
  
          const color = METHOD_COLORS[acc.method] ?? 'bg-gray-50 border-gray-100 text-gray-600';
          return (
            <div key={acc.id} className="flex items-center gap-3">
                
                  <BankAccounts account={acc.method} />
                
              <div className="flex-1">
                <div className="h-1.5 w-full rounded-full bg-gray-100">
                  {Number(acc.balance) >= 0 ? (
                    <div
                      className="h-1.5 rounded-full bg-gray-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  ) : 
                  <div
                      className="h-1.5 rounded-full bg-red-400 transition-all"
                      style={{ width: `100%` }}
                    />
                    }
                </div>
              </div>
              <span className="w-32 text-right text-sm font-semibold tabular-nums text-gray-700">
                {currency === 'EGP' ? 'E£' : currency === 'USD' ? '$' : '¥'} {fmt(Number(acc.balance))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Transfer Form ─────────────────────────────────────────────────────────────

function TransferForm({ accounts }: { accounts: WalletAccount[] }) {
  const [currency,  setCurrency]  = useState<'EGP' | 'USD' | 'RMB'>('EGP');
  const [fromId,    setFromId]    = useState('');
  const [toId,      setToId]      = useState('');
  const [amount,    setAmount]    = useState('');
  const [notes,     setNotes]     = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);
  const [isPending, startTransition] = useTransition();

  const filtered  = accounts.filter((a) => a.currency === currency);
  const fromAcc   = filtered.find((a) => a.id === fromId);
  const available = fromAcc ? Number(fromAcc.balance) : 0;

  const handleSubmit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)     { setError('Enter a valid amount.'); return; }
    if (amt > available)      { setError(`Insufficient balance (${currency === 'EGP' ? 'EGP' : currency === 'USD' ? '$' : '¥'} ${fmt(available)} available).`); return; }
    if (!fromId || !toId)     { setError('Select both accounts.'); return; }
    if (fromId === toId)      { setError('Source and destination must be different.'); return; }

    startTransition(async () => {
      const fd = new FormData();
      fd.set('currency',        currency);
      fd.set('amount',          String(amt));
      fd.set('from_account_id', fromId);
      fd.set('to_account_id',   toId);
      fd.set('notes',           notes);
      const result = await createTransferAction(fd);
      if (result.error) { setError(result.error); return; }
      setAmount(''); setNotes(''); setFromId(''); setToId('');
      setError(null); setSuccess(true);
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-800">Transfer Between Accounts</h2>
      <div className="space-y-3">

        {/* Currency toggle */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
          {(['EGP', 'USD', 'RMB'] as const).map((c) => (
            <button key={c} onClick={() => { setCurrency(c); setFromId(''); setToId(''); }}
              className={`rounded-md px-4 py-1 text-sm font-medium transition-colors ${
                currency === c ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {c}
            </button>
          ))}
        </div>

        {/* From / Arrow / To */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-400">From</label>
            <select value={fromId} onChange={(e) => { setFromId(e.target.value); setError(null); setSuccess(false); }}
              className={`${inputClass} px-2`}>
              <option value="">Select account</option>
              {filtered.map((a) => (
                <option key={a.id} value={a.id}>
                  {METHOD_LABELS[a.method] ?? a.method} — {currency === 'EGP' ? 'EGP' : currency === 'USD' ? '$' : '¥'} {fmt(Number(a.balance))}
                </option>
              ))}
            </select>
          </div>
          <div className="pb-2 text-gray-300 flex-shrink-0">
            <ArrowRightIcon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-400">To</label>
            <select value={toId} onChange={(e) => { setToId(e.target.value); setError(null); setSuccess(false); }}
              className={`${inputClass} px-2`}>
              <option value="">Select account</option>
              {filtered.filter((a) => a.id !== fromId).map((a) => (
                <option key={a.id} value={a.id}>
                  {METHOD_LABELS[a.method] ?? a.method}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">Amount</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {currency === 'EGP' ? 'EGP' : currency === 'USD' ? '$' : '¥'}
            </span>
            <input type="number" min={0} step="0.01" value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null); setSuccess(false); }}
              placeholder="0.00" className={`${inputClass} pl-12 pr-3`} />
          </div>
          {fromId && <p className={`mt-1 text-xs ${available > 0 ? 'text-green-500' : 'text-red-500'}`}>
            Available: {currency === 'EGP' ? 'EGP' : currency === 'USD' ? '$' : '¥'} {fmt(available)}
          </p>}
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">Notes (optional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Cash withdrawal for salaries"
            className={`${inputClass} px-3`} />
        </div>

        {error   && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-600">Transfer recorded.</p>}

        <div className="flex justify-end">
          <button type="button" onClick={handleSubmit} disabled={isPending} className="btn-primary">
            {isPending ? 'Recording…' : 'Record Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Conversion Form ───────────────────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<ConvCurrency, string> = {
  EGP: 'E£',
  USD: '$',
  RMB: '¥',
};

function ConversionForm({
  liveRates, accounts,
}: {
  liveRates: LiveRates | null; accounts: WalletAccount[];
}) {
  const [fromCurrency,  setFromCurrency]  = useState<ConvCurrency>('EGP');
  const [toCurrency,    setToCurrency]    = useState<ConvCurrency>('USD');
  const [fromAmount,    setFromAmount]    = useState('');
  const [toAmount,      setToAmount]      = useState('');
  const [exchangeRate,  setExchangeRate]  = useState('');
  const [notes,         setNotes]         = useState('');
  const [error,         setError]         = useState<string | null>(null);
  const [success,       setSuccess]       = useState(false);
  const [isPending,     startTransition]  = useTransition();

  const direction = `${fromCurrency.toLowerCase()}_to_${toCurrency.toLowerCase()}` as const;
  const fromSymbol   = CURRENCY_SYMBOL[fromCurrency];
  const toSymbol     = CURRENCY_SYMBOL[toCurrency];
  const fromAccounts = accounts.filter((a) => a.currency === fromCurrency);
  const fromTotal    = fromAccounts.reduce((s, a) => s + Number(a.balance), 0);

  const computeTo   = (from: string, rate: string) => {
    const f = parseFloat(from); const r = parseFloat(rate);
    if (f > 0 && r > 0) return (f * r).toFixed(2);
    return '';
  };
  const computeFrom = (to: string, rate: string) => {
    const t = parseFloat(to); const r = parseFloat(rate);
    if (t > 0 && r > 0) return (t / r).toFixed(2);
    return '';
  };

  const handleFromChange = (v: string) => { setFromAmount(v); setToAmount(computeTo(v, exchangeRate)); setError(null); setSuccess(false); };
  const handleToChange   = (v: string) => { setToAmount(v); setFromAmount(computeFrom(v, exchangeRate)); setError(null); setSuccess(false); };
  const handleRateChange = (v: string) => { setExchangeRate(v); setToAmount(computeTo(fromAmount, v)); setError(null); setSuccess(false); };

  const handleFromCurrencyChange = (c: ConvCurrency) => {
    setFromCurrency(c);
    if (c === toCurrency) setToCurrency(c === 'EGP' ? 'USD' : c === 'USD' ? 'EGP' : 'USD');
    setFromAmount(''); setToAmount(''); setExchangeRate(''); setError(null); setSuccess(false);
  };
  const handleToCurrencyChange = (c: ConvCurrency) => {
    setToCurrency(c);
    if (c === fromCurrency) setFromCurrency(c === 'EGP' ? 'USD' : c === 'USD' ? 'EGP' : 'USD');
    setFromAmount(''); setToAmount(''); setExchangeRate(''); setError(null); setSuccess(false);
  };

  const handleSubmit = () => {
    const from = parseFloat(fromAmount);
    const to   = parseFloat(toAmount);
    const rate = parseFloat(exchangeRate);
    if (!from || from <= 0) { setError(`Enter a valid ${fromCurrency} amount.`); return; }
    if (!to   || to   <= 0) { setError(`Enter a valid ${toCurrency} amount.`); return; }
    if (!rate || rate <= 0) { setError('Enter a valid exchange rate.'); return; }
    if (from > fromTotal)   { setError(`Insufficient ${fromCurrency} balance (${fromSymbol} ${fmt(fromTotal)} available).`); return; }

    startTransition(async () => {
      const fd = new FormData();
      fd.set('from_amount',   String(from));
      fd.set('to_amount',     String(to));
      fd.set('exchange_rate', String(rate));
      fd.set('direction',     direction);
      fd.set('notes',         notes);
      const result = await createConversionAction(fd);
      if (result.error) { setError(result.error); return; }
      setFromAmount(''); setToAmount(''); setNotes('');
      setError(null); setSuccess(true);
    });
  };

  const currencies: ConvCurrency[] = ['EGP', 'USD', 'RMB'];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-800">Currency Conversion</h2>
      <div className="space-y-3">

        {/* Currency pair selectors */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-400">From</label>
            <select value={fromCurrency} onChange={(e) => handleFromCurrencyChange(e.target.value as ConvCurrency)}
              className={`${inputClass} px-2`}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="pb-2 flex-shrink-0 text-gray-300">
            <ArrowsRightLeftIcon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-400">To</label>
            <select value={toCurrency} onChange={(e) => handleToCurrencyChange(e.target.value as ConvCurrency)}
              className={`${inputClass} px-2`}>
              {currencies.filter((c) => c !== fromCurrency).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Exchange rate */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">
            Exchange rate (1 {fromCurrency} = ? {toCurrency})
          </label>
          <div className="relative">
            <input type="number" min={0} step="0.0001" value={exchangeRate}
              onChange={(e) => handleRateChange(e.target.value)}
              placeholder="0.0000"
              className={`${inputClass} px-3`} />
            {(() => {
              const live = liveRates ? pairRate(fromCurrency, toCurrency, liveRates) : null;
              return live ? (
                <button type="button" onClick={() => handleRateChange(live.toFixed(4))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs text-blue-500 hover:bg-blue-50 transition-colors">
                  Use live rate
                </button>
              ) : null;
            })()}
          </div>
        </div>

        {/* From / To amounts */}
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-gray-400">{fromCurrency} amount</label>
              <span className={`text-xs ${fromTotal > 0 ? 'text-green-500' : 'text-red-500'}`}>
                Available: {fromSymbol} {fmt(fromTotal)}
              </span>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{fromSymbol}</span>
              <input type="number" min={0} step="0.01" value={fromAmount}
                onChange={(e) => handleFromChange(e.target.value)}
                placeholder="0.00" className={`${inputClass} pl-12 pr-3`} />
            </div>
          </div>
          <div className="flex-1">
            <div className="mb-1">
              <label className="text-xs text-gray-400">{toCurrency} amount</label>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{toSymbol}</span>
              <input type="number" min={0} step="0.01" value={toAmount}
                onChange={(e) => handleToChange(e.target.value)}
                placeholder="0.00" className={`${inputClass} pl-12 pr-3`} />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">Notes (optional)</label>
          <input type="text" value={notes} onChange={(e) => { setNotes(e.target.value); setSuccess(false); }}
            placeholder="e.g. Top-up for supplier payment"
            className={`${inputClass} px-3`} />
        </div>

        {error   && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-600">Conversion recorded.</p>}

        <div className="flex justify-end">
          <button type="button" onClick={handleSubmit} disabled={isPending} className="btn-primary">
            {isPending ? 'Recording…' : `Convert ${fromCurrency} → ${toCurrency}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rate Badge ────────────────────────────────────────────────────────────────

function RateBadge({ liveRates }: { liveRates: LiveRates | null }) {
  if (!liveRates) return (
    <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
      Live rate unavailable — add <code className="font-mono text-xs">EXCHANGE_RATE_API_KEY</code> to your .env
    </div>
  );
  const { egpPerUsd, rmbPerUsd, updatedAt } = liveRates;
  const egpPerRmb = egpPerUsd / rmbPerUsd;
  const updated = new Date(updatedAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-green-50 p-1.5">
            <ArrowsRightLeftIcon className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-xs text-gray-400">Live exchange rates</p>
        </div>
        <p className="text-xs text-gray-300">Updated {updated}</p>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <p className="text-sm font-semibold text-gray-800">
          1 USD = <span className="text-blue-600">{fmt(egpPerUsd, 4)} EGP</span>
        </p>
        <p className="text-sm font-semibold text-gray-800">
          1 USD = <span className="text-red-600">{fmt(rmbPerUsd, 4)} RMB</span>
        </p>
        <p className="text-sm font-semibold text-gray-800">
          1 RMB = <span className="text-amber-600">{fmt(egpPerRmb, 4)} EGP</span>
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'transfer' | 'convert';

export default function WalletClient({
  egpBalance, usdBalance, rmbBalance, accounts, recentTransfers: _recentTransfers, liveRates,
}: {
  egpBalance:      number;
  usdBalance:      number;
  rmbBalance:      number;
  accounts:        WalletAccount[];
  recentTransfers: any[];
  liveRates:       LiveRates | null;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('transfer');

  return (
    <div className="space-y-6">

      {/* ── Total balance cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TotalCard currency="EGP" amount={egpBalance} />
        <TotalCard currency="USD" amount={usdBalance} accent />
        <TotalCard currency="RMB" amount={rmbBalance} />
      </div>

      {/* ── Combined value ── */}
      {liveRates && (
        <div className="rounded-xl border border-gray-100 bg-white px-5 py-3">
          <p className="text-xs text-gray-400">Total value in EGP (at live rates)</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-800">
            E£ {fmt(egpBalance + usdBalance * liveRates.egpPerUsd + rmbBalance * (liveRates.egpPerUsd / liveRates.rmbPerUsd))}
          </p>
        </div>
      )}

      {/* ── Account breakdowns ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AccountBreakdown currency="EGP" accounts={accounts} />
        <AccountBreakdown currency="USD" accounts={accounts} />
        <AccountBreakdown currency="RMB" accounts={accounts} />
      </div>

      {/* ── Live rate ── */}
      <RateBadge liveRates={liveRates} />

      {/* ── Action tabs ── */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {([['transfer', 'Transfer Between Accounts'], ['convert', 'Currency Conversion']] as [Tab, string][]).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Active form ── */}
      {activeTab === 'transfer'
        ? <TransferForm accounts={accounts} />
        : <ConversionForm liveRates={liveRates} accounts={accounts} />
      }

    </div>
  );
}