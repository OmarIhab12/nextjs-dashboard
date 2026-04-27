import postgres from 'postgres';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  LatestInvoiceRaw,
  Revenue,
} from '@/app/lib/definitions';
import { formatCurrency } from '@/app/lib/utils';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
    const invoicesTotal = sql`SELECT
         SUM(total) AS "total"
         FROM invoices`;

    const PaidTotal = sql`SELECT
         SUM(amount) AS "paid"
         FROM payments`;


    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoicesTotal,
      PaidTotal,
    ]);

    const numberOfInvoices = Number(data[0][0].count ?? '0');
    const numberOfCustomers = Number(data[1][0].count ?? '0');
    const totalPaidInvoices = formatCurrency(data[2][0].total ?? '0');
    const totalPendingInvoices = formatCurrency(data[3][0].paid ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}