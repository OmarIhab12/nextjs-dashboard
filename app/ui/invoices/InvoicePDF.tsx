// app/ui/invoices/InvoicePDF.tsx
// @react-pdf/renderer document — server-side only (used in API route)

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import fs   from 'fs';
import path from 'path';
// @ts-ignore — no type definitions for arabic-reshaper
import reshaper from 'arabic-reshaper';

// ── Font Registration ────────────────────────────────────────────────────────
const amiriRegular = fs
  .readFileSync(path.resolve('./public/fonts/Amiri_400Regular.ttf'))
  .toString('base64');

const amiriBold = fs
  .readFileSync(path.resolve('./public/fonts/Amiri_700Bold.ttf'))
  .toString('base64');

Font.register({
  family: 'Amiri',
  fonts: [
    { src: `data:font/truetype;base64,${amiriRegular}`, fontWeight: 400 },
    { src: `data:font/truetype;base64,${amiriBold}`,    fontWeight: 700 },
  ],
});

// Disable hyphenation
Font.registerHyphenationCallback((word) => [word]);

// ── Arabic text helper ────────────────────────────────────────────────────────
// Reshapes Arabic letters so they connect correctly in the PDF renderer.
// Non-Arabic strings (numbers, English) are returned as-is.
function ar(text: string): string {
  if (!text) return '';
  return reshaper.convertArabic(text);
}

// ── Types ────────────────────────────────────────────────────────────────────
export type InvoicePDFData = {
  id:             string;
  customerName:   string;
  createdAt:      string;
  dueDate:        string | null;
  subtotal:       number;
  discountAmount: number;
  total:          number;
  notes:          string | null;
  items: {
    productName: string;
    sku:         string | null;
    quantity:    number;
    unitPrice:   number;
    lineTotal:   number;
  }[];
};

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily:        'Amiri',
    fontSize:          11,
    backgroundColor:   '#ffffff',
    paddingTop:        36,
    paddingBottom:     48,
    paddingHorizontal: 40,
  },

  // ── Header ──
  header: {
    textAlign:    'center',
    marginBottom: 16,
  },
  companyName: {
    fontSize:      22,
    fontWeight:    700,
    color:         '#1a1a1a',
    letterSpacing: 1,
  },
  invoiceTitle: {
    fontSize:   16,
    fontWeight: 700,
    marginTop:  6,
    color:      '#333333',
    textAlign:  'center',
  },
  divider: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#cccccc',
    marginVertical:    12,
  },
  thinDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#dddddd',
    marginVertical:    8,
  },

  // ── Meta (customer / date) — explicit RTL row ──
  metaRow: {
    flexDirection:  'row-reverse',   // RTL: right → left
    justifyContent: 'space-between',
    marginBottom:   4,
  },
  metaText: {
    fontSize:  11,
    color:     '#111111',
    textAlign: 'right',
  },
  metaLabel: {
    fontWeight: 700,
    color:      '#555555',
  },

  // ── Table ──
  tableHeader: {
    flexDirection:     'row-reverse',  // RTL
    backgroundColor:   '#f0f0f0',
    borderTopWidth:    1,
    borderTopColor:    '#cccccc',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingVertical:   6,
    paddingHorizontal: 4,
    marginTop:         12,
  },
  tableRow: {
    flexDirection:     'row-reverse',  // RTL
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
    paddingVertical:   5,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },

  // Columns — order in JSX matches visual RTL order (rightmost first)
  colCode:  { width: '12%', textAlign: 'center' },
  colName:  { width: '46%', textAlign: 'right'  },
  colQty:   { width: '10%', textAlign: 'center' },
  colPrice: { width: '16%', textAlign: 'center' },
  colTotal: { width: '16%', textAlign: 'center' },

  headerText: {
    fontWeight: 700,
    fontSize:   10,
    color:      '#333333',
  },
  cellText: {
    fontSize: 10,
    color:    '#111111',
  },

  // ── Totals ──
  totalsSection: {
    marginTop: 14,
  },
  totalRow: {
    flexDirection:  'row-reverse',  // RTL
    justifyContent: 'flex-start',   // aligns to right in RTL
    marginBottom:   4,
    gap:            8,
  },
  totalLabel: {
    fontWeight: 700,
    fontSize:   11,
    color:      '#555555',
    width:      90,
    textAlign:  'right',
  },
  totalValue: {
    fontSize:  11,
    color:     '#111111',
    width:     80,
    textAlign: 'center',
  },
  grandTotalLabel: {
    fontWeight: 700,
    fontSize:   13,
    color:      '#000000',
    width:      90,
    textAlign:  'right',
  },
  grandTotalValue: {
    fontWeight: 700,
    fontSize:   13,
    color:      '#000000',
    width:      80,
    textAlign:  'center',
  },

  // ── Notes ──
  notesSection: {
    marginTop:       20,
    padding:         10,
    backgroundColor: '#f9f9f9',
    borderRadius:    4,
  },
  notesLabel: {
    fontWeight:   700,
    fontSize:     10,
    color:        '#555555',
    marginBottom: 4,
    textAlign:    'right',
  },
  notesText: {
    fontSize:  10,
    color:     '#333333',
    textAlign: 'right',
  },

  // ── Footer ──
  footer: {
    position:  'absolute',
    bottom:    24,
    left:      40,
    right:     40,
    textAlign: 'center',
    fontSize:  9,
    color:     '#aaaaaa',
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d    = new Date(iso);
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Document Component ────────────────────────────────────────────────────────
export function InvoicePDF({ invoice }: { invoice: InvoicePDFData }) {
  const hasDiscount = invoice.discountAmount > 0;

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Company Header ── */}
        <View style={s.header}>
          <Text style={s.companyName}>Vinslon</Text>
          <Text style={s.invoiceTitle}>{ar('الفاتورة')}</Text>
        </View>

        <View style={s.divider} />

        {/* ── Customer & Date row (RTL: name on right, date on left) ── */}
        <View style={s.metaRow}>
          <Text style={s.metaText}>
            {invoice.customerName}
            <Text style={s.metaLabel}>{ar('  : الاسم ')}</Text>
          </Text>
        </View>

        <View style={s.metaRow}>
          <Text style={s.metaText}>
            <Text style={s.metaLabel}>{ar('التاريخ: ') + formatDate(invoice.createdAt)}</Text>
          </Text>
          
        </View>

        {/* {invoice.dueDate && (
          <View style={s.metaRow}>
            <Text style={s.metaText}>
              <Text style={s.metaLabel}>{ar('تاريخ الاستحقاق: ')}</Text>
              {formatDate(invoice.dueDate)}
            </Text>
          </View>
        )} */}

        <View style={s.thinDivider} />

        {/* ── Table Header (RTL column order: code | name | qty | price | total) ── */}
        <View style={s.tableHeader}>
          <Text style={[s.headerText, s.colCode]}>{ar('كود')}</Text>
          <Text style={[s.headerText, s.colName]}>{ar('الصنف')}</Text>
          <Text style={[s.headerText, s.colQty]}>{ar('العدد')}</Text>
          <Text style={[s.headerText, s.colPrice]}>{ar('السعر')}</Text>
          <Text style={[s.headerText, s.colTotal]}>{ar('الإجمالي')}</Text>
        </View>

        {/* ── Table Rows ── */}
        {invoice.items.map((item, i) => (
          <View
            key={i}
            style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}
          >
            <Text style={[s.cellText, s.colCode]}>
              {item.sku ? `#${item.sku}` : '-'}
            </Text>
            <Text style={[s.cellText, s.colName]}>{item.productName}</Text>
            <Text style={[s.cellText, s.colQty]}>{item.quantity}</Text>
            <Text style={[s.cellText, s.colPrice]}>{fmt(item.unitPrice)}</Text>
            <Text style={[s.cellText, s.colTotal]}>{fmt(item.lineTotal)}</Text>
          </View>
        ))}

        {/* ── Totals ── */}
        <View style={s.divider} />
        <View style={s.totalsSection}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{ar('الإجمالي')}</Text>
            <Text style={s.totalValue}>{fmt(invoice.subtotal)}</Text>
          </View>

          {hasDiscount && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{ar('الخصم')}</Text>
              <Text style={s.totalValue}>- {fmt(invoice.discountAmount)}</Text>
            </View>
          )}

          <View style={s.thinDivider} />

          <View style={s.totalRow}>
            <Text style={s.grandTotalLabel}>
              {ar(hasDiscount ? 'بعد الخصم' : 'الإجمالي')}
            </Text>
            <Text style={s.grandTotalValue}>{fmt(invoice.total)}</Text>
          </View>
        </View>

        {/* ── Notes ── */}
        {invoice.notes && (
          <View style={s.notesSection}>
            <Text style={s.notesLabel}>{ar('ملاحظات')}</Text>
            <Text style={s.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* ── Footer ── */}
        <Text style={s.footer}>Vinslon — {new Date().getFullYear()}</Text>

      </Page>
    </Document>
  );
}