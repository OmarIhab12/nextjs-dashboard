// app/ui/customers/CustomerStatementPDF.tsx
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
// @ts-ignore
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
function ar(text: string): string {
  if (!text) return '';
  return isArabic(text) ? reshaper.convertArabic(text) : text;
}

// ── Types ────────────────────────────────────────────────────────────────────
export type StatementTransaction = {
  event_date: string;
  amount:     number;
  event_type: 'invoice' | 'payment' | 'return_credit' | 'return_refund' | 'credit_refund';
};

export type CustomerStatementData = {
  customerName: string;
  transactions: StatementTransaction[];
};

// Each rendered row in the table
type Row =
  | { kind: 'tx';      date: string; amount: number; label: string; isRefund: boolean }
  | { kind: 'balance'; balance: number; isFinal: boolean };

function buildRows(transactions: StatementTransaction[]): Row[] {
  const rows: Row[] = [];
  let balance = 0;

  for (const t of transactions) {
    // return_refund / credit_refund offset the obligation reduction (cash already given back)
    const delta =
      t.event_type === 'invoice'        ?  t.amount :
      t.event_type === 'return_refund'  ?  t.amount :
      t.event_type === 'credit_refund'  ?  t.amount :
                                          -t.amount;
    balance += delta;

    const label =
      t.event_type === 'invoice'       ? ar('فاتورة جديدة')     :
      t.event_type === 'return_credit' ? ar('مرتجع')            :
      t.event_type === 'return_refund' ? ar('استرداد نقدي')      :
      t.event_type === 'credit_refund' ? ar('استرداد من الرصيد') :
                                         ar('دفعات');

    rows.push({
      kind:     'tx',
      date:     t.event_date,
      amount:   delta,
      label,
      isRefund: t.event_type === 'return_refund' || t.event_type === 'credit_refund',
    });

    rows.push({ kind: 'balance', balance, isFinal: false });
  }

  // Mark the last balance row as final
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.kind === 'balance') last.isFinal = true;
  }

  return rows;
}

function fmtAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily:        'Amiri',
    fontSize:          11,
    backgroundColor:   '#ffffff',
    paddingTop:        80,
    paddingBottom:     80,
    paddingHorizontal: 40,
  },

  // ── Per-page logo ──
  pageLogo: {
    position: 'absolute',
    top:      16,
    right:    40,
    width:    48,
    height:   48,
  },

  // ── Title ──
  titleBlock: {
    marginBottom: 6,
    alignItems:   'center',
  },
  titleText: {
    fontSize:   16,
    fontWeight: 700,
    color:      '#1a1a1a',
    textAlign:  'center',
  },
  subtitleText: {
    fontSize:  11,
    color:     '#555555',
    textAlign: 'center',
    marginTop: 2,
  },

  divider: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#cccccc',
    marginVertical:    10,
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
  },
  txRow: {
    flexDirection:     'row-reverse',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eeeeee',
    paddingVertical:   5,
    paddingHorizontal: 6,
  },
  balanceRow: {
    flexDirection:     'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
    paddingVertical:   4,
    paddingHorizontal: 6,
    backgroundColor:   '#f8f8f8',
  },
  finalCreditRow: {
    flexDirection:     'row-reverse',
    paddingVertical:   6,
    paddingHorizontal: 6,
    backgroundColor:   '#dcfce7',
    borderTopWidth:    1.5,
    borderTopColor:    '#86efac',
  },
  finalDebitRow: {
    flexDirection:     'row-reverse',
    paddingVertical:   6,
    paddingHorizontal: 6,
    backgroundColor:   '#fee2e2',
    borderTopWidth:    1.5,
    borderTopColor:    '#fca5a5',
  },

  // Column Views — flex fills full row width; first JSX child = rightmost in RTL
  colDate:   { flex: '25%', justifyContent: 'center' },
  colAmount: { flex: '50%', justifyContent: 'center' },
  colReason: { flex: '25%', justifyContent: 'center' },

  // Text inside column Views
  tCenter: { textAlign: 'center' },
  tRight:  { textAlign: 'right'  },

  headerText:     { fontWeight: 700, fontSize: 10, color: '#333333' },
  cellText:       { fontSize: 10, color: '#111111' },
  balanceText:    { fontSize: 10, fontWeight: 700, color: '#222222' },
  finalCreditText:{ fontSize: 11, fontWeight: 700, color: '#166534' },
  finalDebitText: { fontSize: 11, fontWeight: 700, color: '#991b1b' },
  positiveAmount: { color: '#b45309' },
  negativeAmount: { color: '#15803d' },
  refundAmount:   { color: '#1d4ed8' },

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
    fontSize:     9,
    color:        '#444444',
    textAlign:    'center',
    marginBottom: 2,
  },
  footerAddress: {
    fontSize:     8,
    color:        '#666666',
    textAlign:    'center',
    marginBottom: 1,
  },
  footerLandmark: {
    fontSize:  8,
    color:     '#888888',
    textAlign: 'center',
  },
});

// ── Document Component ────────────────────────────────────────────────────────
export function CustomerStatementPDF({ customerName, transactions }: CustomerStatementData) {
  const rows    = buildRows(transactions);
  const today   = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Logo on every page ── */}
        <Image src={logoSrc} style={s.pageLogo} fixed />

        {/* ── Title ── */}
        <View style={s.titleBlock}>
          {isArabic(customerName) ? (
            <>
              <Text style={s.titleText}>
                {ar('كشف حساب')} — {ar(customerName)}
              </Text>
            </>
          ) : (
            <>
              <Text style={s.titleText}>
                {ar(customerName)} —  {ar('كشف حساب')} 
              </Text>
            </>
          )}
          
          <Text style={s.subtitleText}>
            {ar('حتى تاريخ')} {today}
          </Text>
        </View>

        <View style={s.divider} />

        {/* ── Table Header — RTL: rightmost col first in JSX ── */}
        <View style={s.tableHeader}>
          <View style={s.colDate}>  <Text style={[s.headerText, s.tCenter]}>{ar('التاريخ')}</Text></View>
          <View style={s.colAmount}><Text style={[s.headerText, s.tCenter]}>{ar('الحساب')}</Text></View>
          <View style={s.colReason}><Text style={[s.headerText, s.tRight]} >{ar('السبب')}</Text></View>
        </View>

        {/* ── Rows ── */}
        {rows.map((row, i) => {
          if (row.kind === 'tx') {
            const isNeg      = row.amount < 0;
            const amountStyle = row.isRefund
              ? s.refundAmount
              : isNeg ? s.negativeAmount : s.positiveAmount;
            return (
              <View key={i} style={s.txRow}>
                <View style={s.colDate}>  <Text style={[s.cellText, s.tCenter]}>{row.date}</Text></View>
                <View style={s.colAmount}><Text style={[s.cellText, s.tCenter, amountStyle]}>{fmtAmount(row.amount)}</Text></View>
                <View style={s.colReason}><Text style={[s.cellText, s.tRight]} >{row.label}</Text></View>
              </View>
            );
          }

          if (row.isFinal) {
            const isCredit  = row.balance < 0;
            const label     = isCredit ? ar('رصيد دائن متاح') : ar('المتبقى');
            const display   = fmtAmount(Math.abs(row.balance));
            const rowStyle  = isCredit ? s.finalCreditRow  : s.finalDebitRow;
            const textStyle = isCredit ? s.finalCreditText : s.finalDebitText;
            return (
              <View key={i}>
                {/* Calculation line — raw value (negative when credit) */}
                <View style={s.balanceRow}>
                  <View style={s.colDate}>  <Text style={[s.balanceText, s.tCenter]}>{' '}</Text></View>
                  <View style={s.colAmount}><Text style={[s.balanceText, s.tCenter]}>{fmtAmount(row.balance)}</Text></View>
                  <View style={s.colReason}><Text style={[s.balanceText, s.tRight]} >{' '}</Text></View>
                </View>
                {/* Labeled final line */}
                <View style={rowStyle}>
                  <View style={s.colDate}>  <Text style={[textStyle, s.tCenter]}>{' '}</Text></View>
                  <View style={s.colAmount}><Text style={[textStyle, s.tCenter]}>{display}</Text></View>
                  <View style={s.colReason}><Text style={[textStyle, s.tRight]} >{label}</Text></View>
                </View>
              </View>
            );
          }

          return (
            <View key={i} style={s.balanceRow}>
              <View style={s.colDate}>  <Text style={[s.balanceText, s.tCenter]}>{' '}</Text></View>
              <View style={s.colAmount}><Text style={[s.balanceText, s.tCenter]}>{fmtAmount(row.balance)}</Text></View>
              <View style={s.colReason}><Text style={[s.balanceText, s.tRight]} >{' '}</Text></View>
            </View>
          );
        })}

        {/* ── Footer (every page) ── */}
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
