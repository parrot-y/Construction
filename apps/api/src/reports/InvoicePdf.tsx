import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export interface InvoicePdfData {
  invoiceNo: string;
  title: string;
  status: string;
  issueDate: string;
  dueDate: string;
  poNumber?: string | null;
  client: {
    name: string;
    email?: string | null;
    phone?: string | null;
    billTo?: string | null;
  };
  contractor: {
    name: string;
    kraPin?: string | null;
    currency: string;
  };
  project?: { name: string; code: string; location?: string | null } | null;
  items: {
    description: string;
    section?: string | null;
    unit: string;
    quantity: string;
    unitRate: string;
    total: string;
  }[];
  totals: {
    subtotal: string;
    taxPct: string;
    taxAmount: string;
    total: string;
    amountPaid: string;
    balanceDue: string;
  };
  terms?: string | null;
  notes?: string | null;
  paybill?: string | null;
  payments?: {
    amount: string;
    method: string;
    reference?: string | null;
    paidAt: string;
  }[];
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b', backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#0f172a', paddingBottom: 12, marginBottom: 16 },
  brand: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  brandSub: { fontSize: 8, color: '#64748b', marginTop: 2 },
  docTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0f172a', textAlign: 'right' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#475569', marginTop: 3 },
  parties: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  partyCard: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 10, backgroundColor: '#f8fafc' },
  partyLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  partyName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 2 },
  partyLine: { fontSize: 8, color: '#475569', marginBottom: 1 },
  table: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, marginBottom: 14 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingVertical: 5, paddingHorizontal: 8 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155' },
  thDesc: { width: '52%' },
  thUnit: { width: '10%', textAlign: 'right' },
  thQty: { width: '10%', textAlign: 'right' },
  thRate: { width: '14%', textAlign: 'right' },
  thAmt: { width: '14%', textAlign: 'right' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 5, paddingHorizontal: 8 },
  td: { fontSize: 8, color: '#334155' },
  tdDesc: { width: '52%' },
  tdRight: { width: '10%', textAlign: 'right' },
  tdRate: { width: '14%', textAlign: 'right' },
  tdAmt: { width: '14%', textAlign: 'right' },
  totalsBox: { width: 220, alignSelf: 'flex-end', marginBottom: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { fontSize: 8, color: '#64748b' },
  totalValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  grandRow: { borderTopWidth: 1, borderTopColor: '#cbd5e1', marginTop: 4, paddingTop: 6 },
  grandLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  grandValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  balanceBox: { borderWidth: 1, borderColor: '#0f172a', borderRadius: 4, padding: 8, marginBottom: 14, backgroundColor: '#f8fafc' },
  balanceLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 2 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 10 },
  termsText: { fontSize: 8, color: '#475569', lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 6, fontSize: 7, color: '#94a3b8', textAlign: 'center' },
});

export function InvoicePdf({ data }: { data: InvoicePdfData }): React.JSX.Element {
  const cur = data.contractor.currency;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{data.contractor.name}</Text>
            <Text style={styles.brandSub}>
              {data.contractor.kraPin ? `KRA PIN: ${data.contractor.kraPin}` : 'Registered Contractor'}
            </Text>
          </View>
          <View>
            <Text style={styles.docTitle}>TAX INVOICE</Text>
            <Text style={styles.metaRow}><Text>Invoice No: </Text><Text style={{ fontFamily: 'Helvetica-Bold' }}>{data.invoiceNo}</Text></Text>
            <Text style={styles.metaRow}><Text>Date: </Text><Text>{data.issueDate}</Text></Text>
            <Text style={styles.metaRow}><Text>Due: </Text><Text>{data.dueDate}</Text></Text>
            {data.poNumber ? <Text style={styles.metaRow}><Text>PO Ref: </Text><Text>{data.poNumber}</Text></Text> : null}
            <Text style={styles.metaRow}><Text>Status: </Text><Text style={{ fontFamily: 'Helvetica-Bold' }}>{data.status}</Text></Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.partyCard}>
            <Text style={styles.partyLabel}>Bill To</Text>
            <Text style={styles.partyName}>{data.client.name}</Text>
            {data.client.email ? <Text style={styles.partyLine}>{data.client.email}</Text> : null}
            {data.client.phone ? <Text style={styles.partyLine}>{data.client.phone}</Text> : null}
            {data.client.billTo ? <Text style={styles.partyLine}>{data.client.billTo}</Text> : null}
          </View>
          <View style={styles.partyCard}>
            <Text style={styles.partyLabel}>Project</Text>
            {data.project ? (
              <>
                <Text style={styles.partyName}>{data.project.name}</Text>
                <Text style={styles.partyLine}>Code: {data.project.code}</Text>
                {data.project.location ? <Text style={styles.partyLine}>{data.project.location}</Text> : null}
              </>
            ) : (
              <Text style={styles.partyLine}>General / non-project invoice</Text>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.thDesc]}>Description</Text>
            <Text style={[styles.th, styles.thUnit]}>Unit</Text>
            <Text style={[styles.th, styles.thQty]}>Qty</Text>
            <Text style={[styles.th, styles.thRate]}>Rate</Text>
            <Text style={[styles.th, styles.thAmt]}>Amount ({cur})</Text>
          </View>
          {data.items.map((it, idx) => (
            <View key={idx} style={styles.row}>
              <Text style={[styles.td, styles.tdDesc]}>
                {it.section ? `[${it.section}] ` : ''}{it.description}
              </Text>
              <Text style={[styles.td, styles.tdRight]}>{it.unit}</Text>
              <Text style={[styles.td, styles.tdRight]}>{it.quantity}</Text>
              <Text style={[styles.td, styles.tdRate]}>{it.unitRate}</Text>
              <Text style={[styles.td, styles.tdAmt]}>{it.total}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{cur} {data.totals.subtotal}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT ({data.totals.taxPct}%)</Text>
            <Text style={styles.totalValue}>{cur} {data.totals.taxAmount}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandRow]}>
            <Text style={styles.grandLabel}>Invoice Total</Text>
            <Text style={styles.grandValue}>{cur} {data.totals.total}</Text>
          </View>
        </View>

        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Balance Due</Text>
          <Text style={styles.balanceValue}>{cur} {data.totals.balanceDue}</Text>
          <Text style={{ fontSize: 7, color: '#64748b', marginTop: 3 }}>
            Amount paid to date: {cur} {data.totals.amountPaid}
          </Text>
        </View>

        {data.payments && data.payments.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Payments Received</Text>
            {data.payments.map((p, idx) => (
              <View key={idx} style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {p.paidAt} • {p.method}{p.reference ? ` • Ref ${p.reference}` : ''}
                </Text>
                <Text style={styles.totalValue}>{cur} {p.amount}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.terms ? (
          <View>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <Text style={styles.termsText}>{data.terms}</Text>
          </View>
        ) : null}

        {data.paybill ? (
          <Text style={[styles.termsText, { marginTop: 8 }]}>
            M-Pesa Paybill/Till: {data.paybill} — quote invoice number as account reference.
          </Text>
        ) : null}

        {data.notes ? (
          <View>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.termsText}>{data.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Generated electronically • {data.invoiceNo} • This is a system-generated tax invoice
        </Text>
      </Page>
    </Document>
  );
}
