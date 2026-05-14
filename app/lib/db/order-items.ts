// app/lib/db/order-items.ts

import sql from "@/app/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrderItem = {
  id:           string;
  order_id:     string;
  product_id:   string | null;
  product_name: string;
  unit_price:   string;
  quantity:     number;
  line_total:   string;
};

export type CreateOrderItemInput = {
  product_id:   string;
  product_name: string;
  unit_price:   number;
  quantity:     number;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  return sql<OrderItem[]>`
    SELECT * FROM order_items
    WHERE order_id = ${orderId}
    ORDER BY id ASC
  `;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Replaces all items for an order in one transaction.
 * Used on both create and update — always do a full replace
 * so we don't have to diff individual rows.
 *
 * NOTE: Stock changes are handled by the DB trigger on orders.status,
 * NOT here. Items are purely a record of what was ordered.
 */
export async function replaceOrderItems(
  orderId: string,
  items:   CreateOrderItemInput[],
): Promise<void> {
  await sql.begin(async (tx) => {
    // Delete existing items
    await tx`DELETE FROM order_items WHERE order_id = ${orderId}`;

    // Insert new items
    for (const item of items) {
      const lineTotal = item.unit_price * item.quantity;
      await tx`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
        VALUES (
          ${orderId},
          ${item.product_id},
          ${item.product_name},
          ${item.unit_price.toFixed(2)}::numeric,
          ${item.quantity},
          ${lineTotal.toFixed(2)}::numeric
        )
      `;
    }

    // Recompute order total from items
    await tx`
      UPDATE orders
      SET total_usd = (
        SELECT COALESCE(SUM(line_total), 0)
        FROM order_items
        WHERE order_id = ${orderId}
      )
      WHERE id = ${orderId}
    `;

    // Sync the default instalment amount to match new total
    await tx`
      UPDATE order_instalments
      SET amount_due      = (SELECT total_usd FROM orders WHERE id = ${orderId}),
          amount_remaining = (SELECT total_usd FROM orders WHERE id = ${orderId}) - amount_paid
      WHERE order_id = ${orderId}
        AND instalment_number = 1
        AND amount_paid = 0
    `;
  });
}