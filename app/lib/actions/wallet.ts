'use server';

// app/lib/actions/wallet.ts

import { revalidatePath }   from 'next/cache';
import { createConversion } from '@/app/lib/db/currency-conversions';

export type ConversionState = {
  error: string | null;
};

export async function createConversionAction(
  formData: FormData,
): Promise<ConversionState> {
  try {
    const egp_amount    = parseFloat(formData.get('egp_amount')    as string);
    const usd_amount    = parseFloat(formData.get('usd_amount')    as string);
    const exchange_rate = parseFloat(formData.get('exchange_rate') as string);
    const direction     = (formData.get('direction') as string) || 'egp_to_usd';
    const notes         = (formData.get('notes') as string)?.trim() || undefined;

    if (!egp_amount    || egp_amount    <= 0) return { error: 'EGP amount must be greater than zero.' };
    if (!usd_amount    || usd_amount    <= 0) return { error: 'USD amount must be greater than zero.' };
    if (!exchange_rate || exchange_rate <= 0) return { error: 'Exchange rate must be greater than zero.' };
    if (!['egp_to_usd', 'usd_to_egp'].includes(direction)) return { error: 'Invalid direction.' };

    await createConversion({
      egp_amount,
      usd_amount,
      exchange_rate,
      direction: direction as 'egp_to_usd' | 'usd_to_egp',
      notes,
    });

    revalidatePath('/dashboard/wallet');
    return { error: null };
  } catch (err) {
    console.error('createConversionAction:', err);
    return { error: 'Failed to record conversion.' };
  }
}

export async function createTransferAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  try {
    const currency        = formData.get('currency')        as 'EGP' | 'USD';
    const amount          = parseFloat(formData.get('amount') as string);
    const from_account_id = formData.get('from_account_id') as string;
    const to_account_id   = formData.get('to_account_id')   as string;
    const notes           = (formData.get('notes') as string)?.trim() || undefined;

    if (!amount || amount <= 0)            return { error: 'Amount must be greater than zero.' };
    if (!from_account_id)                  return { error: 'Select source account.' };
    if (!to_account_id)                    return { error: 'Select destination account.' };
    if (from_account_id === to_account_id) return { error: 'Source and destination must be different.' };
    if (!['EGP', 'USD'].includes(currency)) return { error: 'Invalid currency.' };

    const { createWalletTransfer } = await import('@/app/lib/db/wallet-accounts');
    await createWalletTransfer({ currency, amount, from_account_id, to_account_id, notes });

    revalidatePath('/dashboard/wallet');
    return { error: null };
  } catch (err) {
    console.error('createTransferAction:', err);
    return { error: 'Failed to record transfer.' };
  }
}