// app/lib/db/expenses.ts

import sql from "@/app/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Expense = {
  id:            string;
  category:      string;
  recurrence:    "once" | "monthly";
  amount_egp:    string;
  description:   string | null;
  expense_date:  string;
  next_due_date: string | null;
  is_active:     boolean;
  created_at:    string;
};

export type CreateExpenseInput = {
  category:      string;
  recurrence:    "once" | "monthly";
  amount_egp:    number;
  description?:  string;
  expense_date?: Date;
  next_due_date?: Date;
  is_active?:    boolean;
};

export type UpdateExpenseInput = {
  category?:      string;
  amount_egp?:    number;    // triggers wallet reversal if changed
  description?:   string;
  is_active?:     boolean;
  next_due_date?: Date | null;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getAllExpenses(): Promise<Expense[]> {
  return sql<Expense[]>`
    SELECT * FROM expenses ORDER BY expense_date DESC
  `;
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  const [row] = await sql<Expense[]>`SELECT * FROM expenses WHERE id = ${id}`;
  return row ?? null;
}

export async function fetchFilteredExpenses(
  query:   string,
  page:    number,
  perPage = 10,
): Promise<Expense[]> {
  const offset = (page - 1) * perPage;
  return sql<Expense[]>`
    SELECT * FROM expenses
    WHERE
      category    ILIKE ${'%' + query + '%'} OR
      description ILIKE ${'%' + query + '%'} OR
      recurrence::text ILIKE ${'%' + query + '%'}
    ORDER BY expense_date DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;
}

export async function getExpenseCount(query = ''): Promise<number> {
  const [row] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM expenses
    WHERE
      category    ILIKE ${'%' + query + '%'} OR
      description ILIKE ${'%' + query + '%'} OR
      recurrence::text ILIKE ${'%' + query + '%'}
  `;
  return parseInt(row.count);
}

export async function getDueMonthlyExpenses(): Promise<Expense[]> {
  return sql<Expense[]>`
    SELECT * FROM expenses
    WHERE recurrence = 'monthly'
      AND is_active = true
      AND next_due_date <= CURRENT_DATE
    ORDER BY next_due_date ASC
  `;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Creates an expense.
 * DB trigger (trg_expense_sync_wallet) fires on INSERT and automatically:
 *  - writes a wallet_transaction (EGP out)
 *  - decrements company_wallet.egp_balance
 */
export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const expenseDate = input.expense_date ?? new Date();
  const nextDue = input.recurrence === 'monthly'
    ? (input.next_due_date ?? addOneMonth(expenseDate))
    : null;

  const [row] = await sql<Expense[]>`
    INSERT INTO expenses (category, recurrence, amount_egp, description, expense_date, next_due_date, is_active)
    VALUES (
      ${input.category},
      ${input.recurrence},
      ${input.amount_egp.toFixed(2)}::numeric,
      ${input.description   ?? null},
      ${expenseDate},
      ${nextDue},
      ${input.is_active ?? true}
    )
    RETURNING *
  `;
  return row;
}

/**
 * Updates an expense.
 *
 * RECURRENCE = 'once' AND AMOUNT CHANGED:
 *   Performs a wallet reversal immediately — the expense is a single event
 *   so editing the amount corrects the ledger right now.
 *   Ledger ends up with: original 'out' | reversal 'in' | correction 'out'
 *
 * RECURRENCE = 'monthly' AND AMOUNT CHANGED:
 *   Only updates the template row. The new amount takes effect on the next
 *   firing. Past wallet transactions are untouched.
 *
 * AMOUNT UNCHANGED:
 *   Updates metadata only (category, description, is_active, next_due_date).
 *   No wallet entries written regardless of recurrence.
 */
export async function updateExpense(
  id:    string,
  input: UpdateExpenseInput,
): Promise<Expense> {
  const existing = await getExpenseById(id);
  if (!existing) throw new Error(`Expense ${id} not found`);

  const amountChanged =
    input.amount_egp !== undefined &&
    Math.abs(input.amount_egp - Number(existing.amount_egp)) > 0.001;

  // ── Case 1: non-financial fields only ────────────────────────
  if (!amountChanged) {
    const [updated] = await sql<Expense[]>`
      UPDATE expenses SET
        category      = COALESCE(${input.category    ?? null}, category),
        description   = COALESCE(${input.description ?? null}, description),
        is_active     = COALESCE(${input.is_active   ?? null}, is_active),
        next_due_date = CASE
          WHEN ${input.next_due_date !== undefined ? 'true' : 'false'} = 'true'
          THEN ${input.next_due_date ?? null}
          ELSE next_due_date
        END
      WHERE id = ${id}
      RETURNING *
    `;
    return updated;
  }

  // ── Case 2: monthly + amount changed — template only ─────────
  // New amount takes effect on next firing. No wallet changes now.
  if (existing.recurrence === 'monthly') {
    const [updated] = await sql<Expense[]>`
      UPDATE expenses SET
        amount_egp    = ${input.amount_egp!.toFixed(2)}::numeric,
        category      = COALESCE(${input.category    ?? null}, category),
        description   = COALESCE(${input.description ?? null}, description),
        is_active     = COALESCE(${input.is_active   ?? null}, is_active)
      WHERE id = ${id}
      RETURNING *
    `;
    return updated;
  }

  // ── Case 3: once + amount changed — wallet reversal ──────────
  const oldAmount = Number(existing.amount_egp);
  const newAmount = input.amount_egp!;

  return await sql.begin(async (tx) => {
    // Find the original wallet_transaction for this expense
    const [originalTx] = await tx<{ id: string }[]>`
      SELECT id FROM wallet_transactions
      WHERE reference_id = ${id}
        AND direction    = 'out'
        AND reason       = 'expense'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    // Write reversal: EGP comes back in (undoes old amount)
    const [reversalTx] = await tx<{ id: string }[]>`
      INSERT INTO wallet_transactions
        (currency, amount, direction, reason, reference_id, corrects_id)
      VALUES
        ('EGP', ${oldAmount.toFixed(2)}::numeric, 'in', 'expense', ${id},
         ${originalTx?.id ?? null})
      RETURNING id
    `;

    await tx`
      UPDATE company_wallet
      SET egp_balance = egp_balance + ${oldAmount.toFixed(2)}::numeric,
          updated_at  = NOW()
    `;

    // Write correction: new EGP goes out (applies new amount)
    await tx`
      INSERT INTO wallet_transactions
        (currency, amount, direction, reason, reference_id, corrects_id)
      VALUES
        ('EGP', ${newAmount.toFixed(2)}::numeric, 'out', 'expense', ${id},
         ${reversalTx.id})
    `;

    await tx`
      UPDATE company_wallet
      SET egp_balance = egp_balance - ${newAmount.toFixed(2)}::numeric,
          updated_at  = NOW()
    `;

    // Update the expense row
    const [updated] = await tx<Expense[]>`
      UPDATE expenses SET
        amount_egp  = ${newAmount.toFixed(2)}::numeric,
        category    = COALESCE(${input.category    ?? null}, category),
        description = COALESCE(${input.description ?? null}, description),
        is_active   = COALESCE(${input.is_active   ?? null}, is_active)
      WHERE id = ${id}
      RETURNING *
    `;
    return updated;
  });
}

/**
 * Deactivates a recurring expense without deleting history.
 * Does NOT reverse the wallet — the money was already spent.
 */
export async function deactivateExpense(id: string): Promise<void> {
  await sql`UPDATE expenses SET is_active = false WHERE id = ${id}`;
}

/**
 * Fires a monthly expense for the current period:
 *  - Creates a one-off instance row (triggers wallet deduction)
 *  - Advances next_due_date on the template by one month
 */
export async function fireMonthlyExpense(templateId: string): Promise<Expense> {
  const template = await getExpenseById(templateId);
  if (!template) throw new Error("Expense template not found");
  if (!template.is_active) throw new Error("Expense is inactive");

  const newExpense = await createExpense({
    category:     template.category,
    recurrence:   'once',
    amount_egp:   Number(template.amount_egp),
    description:  template.description ?? undefined,
    expense_date: new Date(),
    is_active:    false,
  });

  const nextDue = addOneMonth(new Date(template.next_due_date ?? new Date()));
  await sql`UPDATE expenses SET next_due_date = ${nextDue} WHERE id = ${templateId}`;

  return newExpense;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addOneMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}