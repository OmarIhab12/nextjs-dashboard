// app/dashboard/(overview)/wallet/page.tsx

import { lusitana }          from '@/app/ui/fonts';
import { getWallet }         from '@/app/lib/db/wallet';
import { getWalletAccounts, getRecentTransfers } from '@/app/lib/db/wallet-accounts';
import WalletClient          from '@/app/ui/wallet/wallet-client';

async function getLiveRate(): Promise<{ rate: number; updatedAt: string } | null> {
  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) return null;
    const res = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.result !== 'success') return null;
    return { rate: data.conversion_rates.EGP, updatedAt: data.time_last_update_utc };
  } catch {
    return null;
  }
}

export default async function Page() {
  const [wallet, accounts, recentTransfers, rateData] = await Promise.all([
    getWallet(),
    getWalletAccounts(),
    getRecentTransfers(5),
    getLiveRate(),
  ]);

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className={`${lusitana.className} text-2xl`}>Wallet</h1>
      </div>
      <WalletClient
        egpBalance={Number(wallet.egp_balance)}
        usdBalance={Number(wallet.usd_balance)}
        accounts={accounts}
        recentTransfers={recentTransfers}
        liveRate={rateData?.rate ?? null}
        rateUpdatedAt={rateData?.updatedAt ?? null}
      />
    </div>
  );
}