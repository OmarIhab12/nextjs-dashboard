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