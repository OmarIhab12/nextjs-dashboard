'use client';

// app/ui/wallet/wallet-client.tsx

import { useState, useTransition } from 'react';
import { ArrowsRightLeftIcon }     from '@heroicons/react/24/outline';
import { createConversionAction }  from '@/app/lib/actions/wallet';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

// ── Balance Card ──────────────────────────────────────────────────────────────

function BalanceCard({
  currency,
  amount,
  accent = false,
}: {
  currency: string;
  amount:   number;
  accent?:  boolean;
}) {
  return (
    <div className={`rounded-xl border p-6 ${
      accent
        ? 'bg-blue-50 border-blue-100'
        : 'bg-gray-50 border-gray-100'
    }`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${
        accent ? 'text-blue-500' : 'text-gray-400'
      }`}>
        {currency} Balance
      </p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${
        accent ? 'text-blue-700' : 'text-gray-800'
      }`}>
        {currency === 'EGP' ? 'E£' : '$'} {fmt(amount)}
      </p>
    </div>
  );
}

// ── Rate Badge ────────────────────────────────────────────────────────────────

function RateBadge({
  rate,
  updatedAt,
}: {
  rate:      number | null;
  updatedAt: string | null;
}) {
  if (!rate) {
    return (
      <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        Live rate unavailable — add <code className="font-mono text-xs">EXCHANGE_RATE_API_KEY</code> to your .env
      </div>
    );
  }

  const updated = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-green-50 p-1.5">
          <ArrowsRightLeftIcon className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <p className="text-xs text-gray-400">Live exchange rate</p>
          <p className="text-sm font-semibold text-gray-800">
            1 USD = <span className="text-blue-600">{fmt(rate, 4)} E£</span>
          </p>
        </div>
      </div>
      {updated && (
        <p className="text-xs text-gray-300">Updated {updated}</p>
      )}
    </div>
  );
}

// ── Conversion Form ───────────────────────────────────────────────────────────

function ConversionForm({
  liveRate,
  egpBalance,
  usdBalance,
}: {
  liveRate:   number | null;
  egpBalance: number;
  usdBalance: number;
}) {
  // direction: 'egp_to_usd' = spending EGP to buy USD
  //            'usd_to_egp' = spending USD to buy EGP
  const [direction,    setDirection]    = useState<'egp_to_usd' | 'usd_to_egp'>('egp_to_usd');
  const [fromAmount,   setFromAmount]   = useState('');
  const [toAmount,     setToAmount]     = useState('');
  const [exchangeRate, setExchangeRate] = useState(liveRate ? String(liveRate.toFixed(4)) : '');
  const [notes,        setNotes]        = useState('');
  const [error,        setError]        = useState<string | null>(null);
  const [success,      setSuccess]      = useState(false);
  const [isPending,    startTransition] = useTransition();

  const isEgpToUsd = direction === 'egp_to_usd';

  // Labels and available balance based on direction
  const fromCurrency  = isEgpToUsd ? 'EGP' : 'USD';
  const toCurrency    = isEgpToUsd ? 'USD' : 'EGP';
  const fromPrefix    = isEgpToUsd ? 'E£' : '$';
  const toPrefix      = isEgpToUsd ? '$' : 'E£';
  const fromAvailable = isEgpToUsd ? egpBalance : usdBalance;
  const fromAvailableLabel = isEgpToUsd
    ? `Available: E£ ${fmt(egpBalance)}`
    : `Available: $${fmt(usdBalance)}`;

  // Recompute toAmount when fromAmount or rate changes
  const computeTo = (from: string, rate: string) => {
    const f = parseFloat(from);
    const r = parseFloat(rate);
    if (f > 0 && r > 0) {
      // EGP→USD: divide by rate. USD→EGP: multiply by rate.
      return isEgpToUsd ? (f / r).toFixed(2) : (f * r).toFixed(2);
    }
    return '';
  };

  const computeFrom = (to: string, rate: string) => {
    const t = parseFloat(to);
    const r = parseFloat(rate);
    if (t > 0 && r > 0) {
      return isEgpToUsd ? (t * r).toFixed(2) : (t / r).toFixed(2);
    }
    return '';
  };

  const handleFromChange = (val: string) => {
    setFromAmount(val);
    setToAmount(computeTo(val, exchangeRate));
    setSuccess(false); setError(null);
  };

  const handleToChange = (val: string) => {
    setToAmount(val);
    setFromAmount(computeFrom(val, exchangeRate));
    setSuccess(false); setError(null);
  };

  const handleRateChange = (val: string) => {
    setExchangeRate(val);
    // Recompute toAmount based on current fromAmount
    setToAmount(computeTo(fromAmount, val));
    setSuccess(false); setError(null);
  };

  const flipDirection = () => {
    setDirection((d) => d === 'egp_to_usd' ? 'usd_to_egp' : 'egp_to_usd');
    // Swap amounts
    setFromAmount(toAmount);
    setToAmount(fromAmount);
    setError(null); setSuccess(false);
  };

  const handleSubmit = () => {
    const from = parseFloat(fromAmount);
    const to   = parseFloat(toAmount);
    const rate = parseFloat(exchangeRate);

    if (!from || from <= 0) { setError(`Enter a valid ${fromCurrency} amount.`); return; }
    if (!to   || to   <= 0) { setError(`Enter a valid ${toCurrency} amount.`); return; }
    if (!rate || rate <= 0) { setError('Enter a valid exchange rate.'); return; }
    if (from > fromAvailable) {
      setError(`Insufficient ${fromCurrency} balance (${fromCurrency === 'EGP' ? 'EGP' : '$'} ${fmt(fromAvailable)} available).`);
      return;
    }

    // Always store as egp_amount / usd_amount regardless of direction
    const egp_amount = isEgpToUsd ? from : to;
    const usd_amount = isEgpToUsd ? to   : from;

    startTransition(async () => {
      const fd = new FormData();
      fd.set('egp_amount',    String(egp_amount));
      fd.set('usd_amount',    String(usd_amount));
      fd.set('exchange_rate', String(rate));
      fd.set('direction',     direction);
      fd.set('notes',         notes);

      const result = await createConversionAction(fd);
      if (result.error) { setError(result.error); return; }

      setFromAmount(''); setToAmount(''); setNotes('');
      setError(null); setSuccess(true);
    });
  };

  const inputClass = 'block w-full rounded-md border border-gray-200 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold text-gray-800">
        Currency Conversion
      </h2>

      <div className="space-y-4">

        {/* Exchange rate */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Exchange Rate (EGP per 1 USD)
          </label>
          <div className="relative">
            <input
              type="number" min={0} step="0.0001"
              value={exchangeRate}
              onChange={(e) => handleRateChange(e.target.value)}
              placeholder={liveRate ? liveRate.toFixed(4) : '50.0000'}
              className={`${inputClass} px-3`}
            />
            {liveRate && (
              <button
                type="button"
                onClick={() => handleRateChange(liveRate.toFixed(4))}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs text-blue-500 hover:bg-blue-50 transition-colors"
              >
                Use live rate
              </button>
            )}
          </div>
        </div>

        {/* From / Flip / To — all on the same line */}
        <div className="flex items-center gap-2">

          {/* From */}
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {fromCurrency}
              </label>
              <span className={`text-xs ${fromAvailable > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {fromAvailableLabel}
              </span>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {fromPrefix}
              </span>
              <input
                type="number" min={0} step="0.01"
                value={fromAmount}
                onChange={(e) => handleFromChange(e.target.value)}
                placeholder="0.00"
                className={`${inputClass} pl-12 pr-3`}
              />
            </div>
          </div>

          {/* Flip button — sits between the two inputs, aligned to input height */}
          <div className="mt-5 flex-shrink-0">
            <button
              type="button"
              onClick={flipDirection}
              title="Flip direction"
              className="rounded-full border border-gray-200 p-2 text-gray-400 hover:bg-gray-50 hover:text-blue-500 transition-colors"
            >
              <ArrowsRightLeftIcon className="h-4 w-4" />
            </button>
          </div>

          {/* To */}
          <div className="flex-1">
            <div className="mb-1 flex items-center">
              <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {toCurrency}
              </label>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {toPrefix}
              </span>
              <input
                type="number" min={0} step="0.01"
                value={toAmount}
                onChange={(e) => handleToChange(e.target.value)}
                placeholder="0.00"
                className={`${inputClass} pl-12 pr-3`}
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setSuccess(false); }}
            placeholder="e.g. Top-up for supplier payment"
            className={`${inputClass} px-3`}
          />
        </div>

        {error   && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-600">Conversion recorded successfully.</p>}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="btn-primary"
          >
            {isPending ? 'Recording…' : `Convert ${fromCurrency} → ${toCurrency}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WalletClient({
  egpBalance,
  usdBalance,
  liveRate,
  rateUpdatedAt,
}: {
  egpBalance:    number;
  usdBalance:    number;
  liveRate:      number | null;
  rateUpdatedAt: string | null;
}) {
  return (
    <div className="space-y-6">

      {/* ── Balance cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BalanceCard currency="EGP" amount={egpBalance} />
        <BalanceCard currency="USD" amount={usdBalance} accent />
      </div>

      {/* ── Combined value in EGP ── */}
      {liveRate && (
        <div className="rounded-xl border border-gray-100 bg-white px-6 py-4">
          <p className="text-xs text-gray-400">Total value in EGP (at live rate)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-800">
            E£ {fmt(egpBalance + usdBalance * liveRate)}
          </p>
        </div>
      )}

      {/* ── Live rate ── */}
      <RateBadge rate={liveRate} updatedAt={rateUpdatedAt} />

      {/* ── Conversion form ── */}
      <ConversionForm liveRate={liveRate} egpBalance={egpBalance} usdBalance={usdBalance} />

    </div>
  );
}