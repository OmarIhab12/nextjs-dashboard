// app/ui/orders/table.tsx

import { fetchFilteredOrders }     from '@/app/lib/db/orders';
import { UpdateOrder, DeleteOrder } from '@/app/ui/orders/buttons';
import { formatDateToLocal }        from '@/app/lib/utils';
import {
  TableContainer, TableHeader, TableRows, TableRow,
  TableActions, TableEmpty, MobileCard, MobileCardHeader, MobileCardFooter,
} from '@/app/ui/table-components';
import { OrderStatusUI, PaymentStatus } from '../shared/status';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

const STATUS_COLORS = {
  pending:   'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-50 text-blue-700',
  shipped:   'bg-purple-50 text-purple-700',
  arrived:   'bg-amber-50 text-amber-700',
  stored:    'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-500',
};

const PAYMENT_COLORS = {
  pending: 'bg-gray-100 text-gray-500',
  partial: 'bg-amber-50 text-amber-700',
  paid:    'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-500',
};

function Badge({
  label, colors,
}: {
  label:  string;
  colors: Record<string, string>;
}) {
  const cls = colors[label] ?? 'bg-gray-100 text-gray-500';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  );
}

const COLS = 'grid-cols-[2fr_1fr_1fr_1fr_1fr_5rem]';

export default async function OrdersTable({
  query,
  currentPage,
}: {
  query:       string;
  currentPage: number;
}) {
  const orders = await fetchFilteredOrders(query, currentPage);

  return (
    <div className="mt-6 flow-root">
      <div className="inline-block min-w-full align-middle">

        {/* ── Mobile ── */}
        <div className="md:hidden space-y-2">
          {orders?.map((order) => (
            <MobileCard key={order.id}>
              <MobileCardHeader>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {order.supplier_name ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDateToLocal(order.order_date)}
                  </p>
                </div>
                <Badge label={order.status} colors={STATUS_COLORS} />
              </MobileCardHeader>
              <MobileCardFooter>
                <div>
                  <p className="text-sm font-semibold text-gray-800 tabular-nums">
                    ${fmt(Number(order.total_usd))}
                  </p>
                  <div className="mt-1">
                    <Badge label={order.payment_status} colors={PAYMENT_COLORS} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <UpdateOrder id={order.id} />
                  <DeleteOrder id={order.id} />
                </div>
              </MobileCardFooter>
            </MobileCard>
          ))}
        </div>

        {/* ── Desktop ── */}
        <div className="hidden md:block">
          <TableContainer>
            <TableHeader
              gridCols={COLS}
              columns={['Supplier', 'Date', 'Total (USD)', 'Status', 'Payment']}
            />
            <TableRows>
              {orders?.length === 0 && <TableEmpty message="No orders found." />}
              {orders?.map((order) => (
                <TableRow key={order.id} gridCols={COLS}>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {order.supplier_name ?? <span className="text-gray-300">—</span>}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatDateToLocal(order.order_date)}
                  </span>
                  <span className="text-sm tabular-nums text-gray-700">
                    ${fmt(Number(order.total_usd))}
                  </span>
                  <div>
                    <OrderStatusUI status={order.status} />
                  </div>
                  <div>
                    <PaymentStatus status={order.payment_status} />
                  </div>
                  <TableActions>
                    <UpdateOrder id={order.id} />
                    <DeleteOrder id={order.id} />
                  </TableActions>
                </TableRow>
              ))}
            </TableRows>
          </TableContainer>
        </div>

      </div>
    </div>
  );
}