// app/api/customers/[id]/statement/route.ts

import { NextRequest, NextResponse }    from 'next/server';
import { renderToBuffer }               from '@react-pdf/renderer';
import { createElement }                from 'react';
import { CustomerStatementPDF }         from '@/app/ui/customers/CustomerStatementPDF';
import { getCustomerStatement }         from '@/app/lib/db/customers';
import { auth }                         from '@/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    const { customer, transactions } = await getCustomerStatement(id);

    if (!customer) {
      return new NextResponse('Customer not found', { status: 404 });
    }

    const buffer = await renderToBuffer(
      createElement(CustomerStatementPDF, {
        customerName: customer.name,
        transactions,
      }) as any,
    );

    const date      = new Date().toISOString().slice(0, 10);
    const safeName  = customer.name.replace(/[^\w؀-ۿ]/g, '-');
    const utf8Name  = encodeURIComponent(`statement-${safeName}-${date}.pdf`);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="statement-${date}.pdf"; filename*=UTF-8''${utf8Name}`,
        'Content-Length':      String(buffer.byteLength),
      },
    });
  } catch (err) {
    console.error('[customers/statement]', err);
    const stack = err instanceof Error ? err.stack : String(err);
    return new NextResponse(
      JSON.stringify({ error: String(err), stack }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
