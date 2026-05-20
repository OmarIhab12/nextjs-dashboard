// app/lib/exchange-rate.ts
// Fetches live CNY→EGP rate, cached by Next.js for 1 hour.

export async function getRmbToEgpRate(): Promise<number> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/CNY', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return (data?.rates?.EGP as number) ?? 0;
  } catch {
    return 0;
  }
}
