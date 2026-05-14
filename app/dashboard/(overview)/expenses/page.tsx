// app/dashboard/(overview)/expenses/page.tsx

import { lusitana }           from '@/app/ui/fonts';
import { getAllExpenses }      from '@/app/lib/db/expenses';
import { autoFireDueExpensesAction } from '@/app/lib/actions/expenses';
import ExpensesClient         from '@/app/ui/expenses/expenses-client';

export default async function Page() {
  // Silently fire any due monthly expenses before rendering
  await autoFireDueExpensesAction();

  const expenses = await getAllExpenses();

  const once    = expenses.filter((e) => e.recurrence === 'once');
  const monthly = expenses.filter((e) => e.recurrence === 'monthly');

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h1 className={`${lusitana.className} text-2xl`}>Expenses</h1>
      </div>
      <ExpensesClient once={once} monthly={monthly} />
    </div>
  );
}