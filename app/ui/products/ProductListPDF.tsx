// app/ui/products/ProductListPDF.tsx
// @react-pdf/renderer document — server-side only (used in API route)

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import fs   from 'fs';
import path from 'path';
// @ts-ignore — no type definitions for arabic-reshaper
import reshaper from 'arabic-reshaper';

// ── Assets ───────────────────────────────────────────────────────────────────
const amiriRegular = fs
  .readFileSync(path.resolve('./public/fonts/Amiri_400Regular.ttf'))
  .toString('base64');

const amiriBold = fs
  .readFileSync(path.resolve('./public/fonts/Amiri_700Bold.ttf'))
  .toString('base64');

const logoBase64 = fs
  .readFileSync(path.resolve('./app/ui/vinslon-logo.png'))
  .toString('base64');
const logoSrc = `data:image/png;base64,${logoBase64}`;

Font.register({
  family: 'Amiri',
  fonts: [
    { src: `data:font/truetype;base64,${amiriRegular}`, fontWeight: 400 },
    { src: `data:font/truetype;base64,${amiriBold}`,    fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

// ── Arabic helpers ───────────────────────────────────────────────────────────
function isArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

// Only reshape when the string actually contains Arabic — passing English text
// through arabic-reshaper adds invisible BiDi control characters that crash
// @react-pdf/textkit's own BiDi pass with "Cannot read .id of undefined".
function ar(text: string): string {
  if (!text) return '';
  return isArabic(text) ? reshaper.convertArabic(text) : text;
}

// ── Types ────────────────────────────────────────────────────────────────────
export type ProductListItem = {
  name:  string;
  sku:   string | null;
  price: string;
};

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily:        'Amiri',
    fontSize:          11,
    backgroundColor:   '#ffffff',
    paddingTop:        72,
    paddingBottom:     72,
    paddingHorizontal: 40,
  },

  // ── Header ──
  header: {
    flexDirection:  'row-reverse',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   14,
  },
  companyBlock: {
    alignItems: 'flex-end',
  },
  companyName: {
    fontSize:   16,
    fontWeight: 700,
    color:      '#1a1a1a',
    textAlign:  'right',
  },
  companySubtitle: {
    fontSize:  10,
    color:     '#555555',
    marginTop: 2,
    textAlign: 'right',
  },
  titleBlock: {
    justifyContent: 'center',
    alignSelf:      'center',
  },

  // ── Centered title ──
  centeredTitle: {
    fontSize:     15,
    fontWeight:   700,
    color:        '#1a1a1a',
    textAlign:    'center',
    marginBottom: 4,
  },

  divider: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#cccccc',
    marginVertical:    10,
  },
  thinDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#dddddd',
    marginVertical:    6,
  },

  // ── Contact row ──
  contactRow: {
    flexDirection:  'row-reverse',
    justifyContent: 'center',
    gap:            24,
    marginBottom:   10,
  },
  contactText: {
    fontSize: 9,
    color:    '#666666',
  },

  // ── Table ──
  tableHeader: {
    flexDirection:     'row-reverse',
    backgroundColor:   '#f0f0f0',
    borderTopWidth:    1,
    borderTopColor:    '#cccccc',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingVertical:   6,
    paddingHorizontal: 6,
    marginTop:         8,
  },
  tableRow: {
    flexDirection:     'row-reverse',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
    paddingVertical:   5,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  tableRowEven: {},

  // Columns — JSX order matches RTL visual order (rightmost first)
  colCode:  { width: '15%', textAlign: 'center' },
  colName:  { width: '65%', textAlign: 'right'  },
  colPrice: { width: '20%', textAlign: 'center' },

  headerText: {
    fontWeight: 700,
    fontSize:   10,
    color:      '#333333',
  },
  cellText: {
    fontSize: 10,
    color:    '#111111',
  },
  cellMono: {
    fontSize: 9,
    color:    '#555555',
  },

  // ── Per-page logo ──
  pageLogo: {
    position: 'absolute',
    top:      16,
    right:    40,
    width:    48,
    height:   48,
  },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom:   16,
    left:     40,
    right:    40,
  },
  footerDivider: {
    borderTopWidth: 0.5,
    borderTopColor: '#cccccc',
    marginBottom:   5,
  },
  footerPhones: {
    fontSize:  9,
    color:     '#444444',
    textAlign: 'center',
    marginBottom: 2,
  },
  footerAddress: {
    fontSize:  8,
    color:     '#666666',
    textAlign: 'center',
    marginBottom: 1,
  },
  footerLandmark: {
    fontSize:  8,
    color:     '#888888',
    textAlign: 'center',
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(price: string): string {
  return Number(price).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Document Component ────────────────────────────────────────────────────────
export function ProductListPDF({ products }: { products: ProductListItem[] }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Logo on every page ── */}
        <Image src={logoSrc} style={s.pageLogo} fixed />

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.companyBlock}>
            <Text style={s.companyName}>{ar('شركة فينسلون لإستيراد')}</Text>
            <Text style={s.companySubtitle}>{ar('المنتجات الأصلية')}</Text>
          </View>
          <View style={s.titleBlock}>
            <Text style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Vinslon</Text>
          </View>
        </View>

        {/* ── Centered title ── */}
        <Text style={s.centeredTitle}>{ar('قائمة أسعار فينسلون الأصلي')}</Text>

        <View style={s.divider} />

        {/* ── Table Header ── */}
        <View style={s.tableHeader}>
          {/* RTL: rightmost column first in JSX */}
          <Text style={[s.headerText, s.colCode]}>{ar('الكود')}</Text>
          <Text style={[s.headerText, s.colName]}>{ar('الأصناف')}</Text>
          <Text style={[s.headerText, s.colPrice]}>{ar('السعر')}</Text>
        </View>

        {/* ── Table Rows ── */}
        {products.map((item, i) => (
          <View
            key={i}
            style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : s.tableRowEven]}
          >
            <Text style={[s.cellMono, s.colCode]}>
              {item.sku ? `#${item.sku}` : '-'}
            </Text>
            <Text style={[s.cellText, s.colName]}>{ar(item.name)}</Text>
            <Text style={[s.cellText, s.colPrice]}>{fmt(item.price)}</Text>
          </View>
        ))}

        <View style={s.thinDivider} />

        {/* ── Footer (repeats on every page) ── */}
        <View style={s.footer} fixed>
          <View style={s.footerDivider} />
          <Text style={s.footerPhones}>
            01032791866 - 01277577590 - 01147423660
          </Text>
          <Text style={s.footerAddress}>
            {ar('4 ش الاهرام - ميدان النافورة - المقطم - القاهرة')}
          </Text>
          <Text style={s.footerLandmark}>
            {ar('أمام مؤسسة مصر الخير')}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
