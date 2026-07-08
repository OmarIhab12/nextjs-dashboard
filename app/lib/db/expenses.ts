// app/lib/db/expenses.ts

import sql from "@/app/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExpenseType = 'operating' | 'payroll' | 'tax' | 'other';
export type PaymentMethod = 'bank_transfer' | 'cash' | 'check' | 'vodafone_cash';

export type WalletCurrency = 'EGP' | 'USD' | 'RMB';

export type Expense = {
  id:             string;
  category:       string;
  expense_type:   ExpenseType;
  recurrence:     "once" | "monthly";
  amount:         string;
  currency:       WalletCurrency;
  payment_method: PaymentMethod;
  description:    string | null;
  expense_date:   string;
  next_due_date:  string | null;
  is_active:      boolean;
  created_at:     string;
  created_by:     string;
  edited_by:      string | null;
};

export type CreateExpenseInput = {
  category:        string;
  expense_type:    ExpenseType;
  recurrence:      "once" | "monthly";
  amount:          number;
  created_by:      string;
  currency?:       WalletCurrency;
  payment_method?: PaymentMethod;
  description?:    string;
  expense_date?:   Date;
  next_due_date?:  Date;
  is_active?:      boolean;
};

export type UpdateExpenseInput = {
  edited_by:       string;
  category?:       string;
  expense_type?:   ExpenseType;
  amount?:         number;
  currency?:       WalletCurrency;
  payment_method?: PaymentMethod;
  description?:    string;
  is_active?:      boolean;
  next_due_date?:  Date | null;
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
    INSERT INTO expenses (category, expense_type, recurrence, amount, currency, payment_method, description, expense_date, next_due_date, is_active, created_by)
    VALUES (
      ${input.category},
      ${input.expense_type},
      ${input.recurrence},
      ${input.amount.toFixed(2)}::numeric,
      ${input.currency ?? 'EGP'}::wallet_currency,
      ${input.payment_method ?? 'cash'},
      ${input.description   ?? null},
      ${expenseDate},
      ${nextDue},
      ${input.is_active ?? true},
      ${input.created_by}
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
 *   so editing the amount corrects the ledger right now. The reversal credits
 *   the OLD payment_method's wallet_accounts row and the correction debits the
 *   NEW payment_method's row (same account if unchanged), keeping company_wallet
 *   in sync with the sum of wallet_accounts rather than diverging from it.
 *   Ledger ends up with: original 'out' | reversal 'in' | correction 'out'
 *
 * RECURRENCE = 'monthly' AND AMOUNT CHANGED:
 *   Only updates the template row. The new amount takes effect on the next
 *   firing. Past wallet transactions are untouched.
 *
 * RECURRENCE = 'once' AND ONLY payment_method CHANGED (amount/currency same):
 *   The expense already fired against the OLD account, so its balance has to
 *   move to the NEW account now. Recorded as a wallet_transfers row (its
 *   trigger debits the old account and credits the new one) rather than a
 *   wallet_transactions pair, since the total is unaffected — money is only
 *   moving between sub-accounts, not in or out of the company wallet.
 *
 * RECURRENCE = 'monthly' AND ONLY payment_method CHANGED:
 *   Template hasn't fired yet, so there is nothing to move — metadata only.
 *
 * NOTHING FINANCIAL CHANGED:
 *   Updates metadata only (category, description, is_active, next_due_date).
 *   No wallet entries written regardless of recurrence.
 */
export async function updateExpense(
  id:    string,
  input: UpdateExpenseInput,
): Promise<Expense> {
  const existing = await getExpenseById(id);
  if (!existing) throw new Error(`Expense ${id} not found`);

  const amountChanged = input.amount !== undefined && Math.abs(input.amount - Number(existing.amount)) > 0.001;
  const currencyChanged = input.currency !== undefined && input.currency !== existing.currency;
  const paymentMethodChanged = input.payment_method !== undefined && input.payment_method !== existing.payment_method;
  const financialChange = amountChanged || currencyChanged;

  // ── Case 1a: once + only payment_method changed — move balance between accounts ──
  if (!financialChange && paymentMethodChanged && existing.recurrence === 'once') {
    const targetPaymentMethod = input.payment_method as PaymentMethod;

    return await sql.begin(async (tx) => {
      const amount = Number(existing.amount);
      const currency = existing.currency;

      const [fromAccount] = await tx<{ id: string }[]>`
        SELECT id FROM wallet_accounts
        WHERE currency = ${currency}::wallet_currency AND method = ${existing.payment_method}::payment_method
        LIMIT 1
      `;
      const [toAccount] = await tx<{ id: string }[]>`
        SELECT id FROM wallet_accounts
        WHERE currency = ${currency}::wallet_currency AND method = ${targetPaymentMethod}::payment_method
        LIMIT 1
      `;

      if (fromAccount && toAccount) {
        await tx`
          INSERT INTO wallet_transfers
            (currency, amount, from_account_id, to_account_id, notes)
          VALUES
            (${currency}::wallet_currency, ${amount.toFixed(2)}::numeric,
             ${fromAccount.id}, ${toAccount.id}, ${'Expense payment method change: ' + id})
        `;
      }

      const [updated] = await tx<Expense[]>`
        UPDATE expenses SET
          payment_method = ${targetPaymentMethod}::payment_method,
          category       = COALESCE(${input.category      ?? null}, category),
          expense_type   = COALESCE(${input.expense_type  ?? null}::expense_type, expense_type),
          description    = COALESCE(${input.description   ?? null}, description),
          is_active      = COALESCE(${input.is_active     ?? null}, is_active),
          edited_by      = ${input.edited_by}
        WHERE id = ${id}
        RETURNING *
      `;
      return updated;
    });
  }

  // ── Case 1b: non-financial fields only (or monthly template payment_method change) ──
  if (!financialChange) {
    const [updated] = await sql<Expense[]>`
      UPDATE expenses SET
        category       = COALESCE(${input.category      ?? null}, category),
        expense_type   = COALESCE(${input.expense_type  ?? null}::expense_type, expense_type),
        payment_method = COALESCE(${input.payment_method ?? null}::payment_method, payment_method),
        description    = COALESCE(${input.description   ?? null}, description),
        is_active      = COALESCE(${input.is_active     ?? null}, is_active),
        edited_by      = ${input.edited_by},
        next_due_date  = CASE
          WHEN ${input.next_due_date !== undefined ? 'true' : 'false'} = 'true'
          THEN ${input.next_due_date ?? null}
          ELSE next_due_date
        END
      WHERE id = ${id}
      RETURNING *
    `;
    return updated;
  }

  const newAmount   = input.amount   ?? Number(existing.amount);
  const newCurrency = input.currency ?? existing.currency;

  // ── Case 2: monthly + financial change — template only ───────
  // New values take effect on next firing. No wallet changes now.
  if (existing.recurrence === 'monthly') {
    const [updated] = await sql<Expense[]>`
      UPDATE expenses SET
        amount         = ${newAmount.toFixed(2)}::numeric,
        currency       = ${newCurrency}::wallet_currency,
        category       = COALESCE(${input.category      ?? null}, category),
        expense_type   = COALESCE(${input.expense_type  ?? null}::expense_type, expense_type),
        payment_method = COALESCE(${input.payment_method ?? null}::payment_method, payment_method),
        description    = COALESCE(${input.description   ?? null}, description),
        is_active      = COALESCE(${input.is_active     ?? null}, is_active),
        edited_by      = ${input.edited_by}
      WHERE id = ${id}
      RETURNING *
    `;
    return updated;
  }

  // ── Case 3: once + financial change — wallet reversal ────────
  const oldAmount        = Number(existing.amount);
  const oldCurrency      = existing.currency;
  const oldPaymentMethod = existing.payment_method;
  const newPaymentMethod = input.payment_method ?? existing.payment_method;

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

    // Write reversal: old amount comes back in (undoes old deduction) — against the OLD account
    const [reversalTx] = await tx<{ id: string }[]>`
      INSERT INTO wallet_transactions
        (currency, amount, direction, reason, reference_id, corrects_id, created_by, account_id)
      VALUES
        (${oldCurrency}::wallet_currency, ${oldAmount.toFixed(2)}::numeric,
         'in', 'expense', ${id}, ${originalTx?.id ?? null}, ${input.edited_by},
         (SELECT id FROM wallet_accounts
          WHERE currency = ${oldCurrency}::wallet_currency AND method = ${oldPaymentMethod}::payment_method
          LIMIT 1))
      RETURNING id
    `;

    // Credit the old account back (undo the original deduction)
    await tx`
      UPDATE wallet_accounts SET
        balance    = balance + ${oldAmount.toFixed(2)}::numeric,
        updated_at = NOW()
      WHERE currency = ${oldCurrency}::wallet_currency AND method = ${oldPaymentMethod}::payment_method
    `;

    await tx`
      UPDATE company_wallet SET
        egp_balance = egp_balance + CASE WHEN ${oldCurrency} = 'EGP' THEN ${oldAmount.toFixed(2)}::numeric ELSE 0 END,
        usd_balance = usd_balance + CASE WHEN ${oldCurrency} = 'USD' THEN ${oldAmount.toFixed(2)}::numeric ELSE 0 END,
        rmb_balance = rmb_balance + CASE WHEN ${oldCurrency} = 'RMB' THEN ${oldAmount.toFixed(2)}::numeric ELSE 0 END,
        updated_at  = NOW()
    `;

    // Write correction: new amount goes out (applies new values) — against the NEW account
    await tx`
      INSERT INTO wallet_transactions
        (currency, amount, direction, reason, reference_id, corrects_id, created_by, account_id)
      VALUES
        (${newCurrency}::wallet_currency, ${newAmount.toFixed(2)}::numeric,
         'out', 'expense', ${id}, ${reversalTx.id}, ${input.edited_by},
         (SELECT id FROM wallet_accounts
          WHERE currency = ${newCurrency}::wallet_currency AND method = ${newPaymentMethod}::payment_method
          LIMIT 1))
    `;

    // Debit the new account (apply the corrected amount)
    await tx`
      UPDATE wallet_accounts SET
        balance    = balance - ${newAmount.toFixed(2)}::numeric,
        updated_at = NOW()
      WHERE currency = ${newCurrency}::wallet_currency AND method = ${newPaymentMethod}::payment_method
    `;

    await tx`
      UPDATE company_wallet SET
        egp_balance = egp_balance - CASE WHEN ${newCurrency} = 'EGP' THEN ${newAmount.toFixed(2)}::numeric ELSE 0 END,
        usd_balance = usd_balance - CASE WHEN ${newCurrency} = 'USD' THEN ${newAmount.toFixed(2)}::numeric ELSE 0 END,
        rmb_balance = rmb_balance - CASE WHEN ${newCurrency} = 'RMB' THEN ${newAmount.toFixed(2)}::numeric ELSE 0 END,
        updated_at  = NOW()
    `;

    // Update the expense row
    const [updated] = await tx<Expense[]>`
      UPDATE expenses SET
        amount         = ${newAmount.toFixed(2)}::numeric,
        currency       = ${newCurrency}::wallet_currency,
        category       = COALESCE(${input.category      ?? null}, category),
        expense_type   = COALESCE(${input.expense_type  ?? null}::expense_type, expense_type),
        payment_method = COALESCE(${input.payment_method ?? null}::payment_method, payment_method),
        description    = COALESCE(${input.description   ?? null}, description),
        is_active      = COALESCE(${input.is_active     ?? null}, is_active),
        edited_by      = ${input.edited_by}
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
    category:       template.category,
    expense_type:   template.expense_type,
    payment_method: template.payment_method,
    recurrence:     'once',
    amount:         Number(template.amount),
    currency:       template.currency,
    description:    template.description ?? undefined,
    expense_date:   new Date(),
    is_active:      false,
    created_by:     template.created_by,
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