import sql from "@/app/lib/db";

export type Revenue = {
  month: string;
  revenue: number;
};

/**
 * Returns total revenue per month for a given year (defaults to current year).
 * Revenue is taken from fully recorded payments (not planned installments),
 * so it reflects actual money received.
 */
export async function getRevenueByMonth(year?: number): Promise<Revenue[]> {
  const targetYear = year ?? new Date().getFullYear();

  const rows = await sql<{ month: string; revenue: string }[]>`
    SELECT
      TO_CHAR(paid_at, 'Mon') AS month,
      SUM(amount)             AS revenue
    FROM payments
    WHERE EXTRACT(YEAR FROM paid_at) = ${targetYear}
    GROUP BY
      EXTRACT(MONTH FROM paid_at),
      TO_CHAR(paid_at, 'Mon')
    ORDER BY
      EXTRACT(MONTH FROM paid_at)
  `;

  return rows.map((row) => ({
    month:   row.month,
    revenue: Number(row.revenue),
  }));
}

/**
 * Returns revenue by month for all years present in the payments table,
 * filling in 0 for months with no payments.
 * Useful for multi-year charts.
 */
export async function getRevenueByMonthFull(
  year?: number
): Promise<Revenue[]> {
  const targetYear = year ?? new Date().getFullYear();

  const rows = await sql<{ month: string; revenue: string }[]>`
    WITH months AS (
      SELECT
        generate_series(1, 12)            AS month_num,
        TO_CHAR(
          TO_DATE(generate_series(1, 12)::text, 'MM'),
          'Mon'
        )                                 AS month
    )
    SELECT
      m.month,
      COALESCE(SUM(p.amount), 0) AS revenue
    FROM months m
    LEFT JOIN payments p
      ON EXTRACT(MONTH FROM p.paid_at) = m.month_num
      AND EXTRACT(YEAR  FROM p.paid_at) = ${targetYear}
    GROUP BY m.month_num, m.month
    ORDER BY m.month_num
  `;

  return rows.map((row) => ({
    month:   row.month,
    revenue: Number(row.revenue),
  }));
}
