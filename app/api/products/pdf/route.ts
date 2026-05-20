// app/api/products/pdf/route.ts

import { NextRequest, NextResponse }              from 'next/server';
import { renderToBuffer }                         from '@react-pdf/renderer';
import { createElement }                          from 'react';
import { ProductListPDF }                         from '@/app/ui/products/ProductListPDF';
import { getAllProducts, getActiveAvailableProducts } from '@/app/lib/db/products';
import { auth }                                   from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const params        = request.nextUrl.searchParams;
    const availableOnly = params.get('available') === '1';
    const allProducts   = params.get('all') === '1';

    const products = availableOnly
      ? await getActiveAvailableProducts()
      : allProducts
        ? await getAllProducts(false)
        : await getAllProducts(true);

    const items = products.map((p) => ({
      name:  p.name,
      sku:   p.sku,
      price: p.price,
    }));

    const buffer = await renderToBuffer(
      createElement(ProductListPDF, { products: items }) as any,
    );

    const date   = new Date().toISOString().slice(0, 10);
    const suffix = availableOnly ? 'available' : allProducts ? 'all' : 'active';
    const filename = `vinslon-price-list-${suffix}-${date}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      String(buffer.byteLength),
      },
    });
  } catch (err) {
    console.error('[products/pdf]', err);
    return new NextResponse(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
