// app/api/invoices/[id]/pdf/route.ts
// Generates a PDF for a given invoice and returns it as a download.

import { NextRequest, NextResponse } from 'next/server';
import { Font, renderToBuffer }            from '@react-pdf/renderer';
import { createElement }             from 'react';
import { InvoicePDF }                from '@/app/ui/invoices/InvoicePDF';
import { fetchInvoiceForPDF }        from '@/app/lib/db/invoices';
import { auth }                      from '@/auth';
import React from 'react';

import fs from 'fs';
import path from 'path';



export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {

  const fontPath = path.resolve('./public/fonts/Amiri_400Regular.ttf');
  console.log('Font path:', fontPath);
  console.log('Font exists:', fs.existsSync(fontPath));
  console.log('CWD:', process.cwd());

  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;

    const invoice = await fetchInvoiceForPDF(id);
    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    const buffer = await renderToBuffer(
      createElement(InvoicePDF, { invoice }) as any,
    );

    const filename = `invoice-${id}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      String(buffer.byteLength),
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return new NextResponse(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
