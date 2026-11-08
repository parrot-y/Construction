import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export interface SnagRegisterRow {
  ref: string;
  location: string;
  trade: string;
  itemType?: string | null;
  description: string;
  severity: string;
  priority: string;
  status: string;
  managerName?: string | null;
  finalApproverName?: string | null;
  costImpactKes?: string | null;
  dueDate?: string | null;
  isPrivate: boolean;
}

export interface SnagRegisterData {
  projectName: string;
  projectCode: string;
  generatedAt: string;
  totalCount: number;
  openCount: number;
  verifiedCount: number;
  rows: SnagRegisterRow[];
}

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica', fontSize: 8, color: '#1e293b' },
  header: { borderBottomWidth: 2, borderBottomColor: '#be123c', paddingBottom: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  brand: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  sub: { fontSize: 8, color: '#64748b', marginTop: 2 },
  title: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#be123c', marginTop: 4 },
  meta: { fontSize: 8, color: '#475569', textAlign: 'right' },
  kpis: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  kpi: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 3, padding: 6, alignItems: 'center' },
  kpiNum: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  kpiLbl: { fontSize: 7, color: '#64748b', marginTop: 2 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingVertical: 4, paddingHorizontal: 4 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#334155' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', paddingVertical: 4, paddingHorizontal: 4 },
  rowAlt: { backgroundColor: '#f8fafc' },
  td: { fontSize: 7.5, color: '#1e293b' },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, fontSize: 7, color: '#94a3b8', textAlign: 'center', borderTopWidth: 0.5, borderTopColor: '#e2e8f0', paddingTop: 4 },
});

// Column widths (flex weights)
const COLS: [number, number, number, number, number, number, number, number] = [1.2, 1.4, 1.1, 2.6, 1.0, 1.0, 1.2, 1.4];

export function SnagRegisterPdf({ data }: { data: SnagRegisterData }) {
  const cell = (w: number, children: React.ReactNode, bold = false) => (
    <Text style={[styles.td, { width: `${w}%` }, ...(bold ? [{ fontFamily: 'Helvetica-Bold' }] : [])]}>{children}</Text>
  );
  const trunc = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Defects Snagging Punch List Register</Text>
            <Text style={styles.sub}>{data.projectName} ({data.projectCode}) · Confidential site record</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.meta}>Generated: {data.generatedAt}</Text>
            <Text style={styles.title}>SNAG REGISTER</Text>
          </View>
        </View>

        <View style={styles.kpis}>
          <View style={styles.kpi}><Text style={styles.kpiNum}>{data.totalCount}</Text><Text style={styles.kpiLbl}>Total snags</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiNum}>{data.openCount}</Text><Text style={styles.kpiLbl}>Open / in progress</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiNum}>{data.verifiedCount}</Text><Text style={styles.kpiLbl}>Verified closed</Text></View>
        </View>

        <View style={styles.tableHeader}>
          {['Ref', 'Location', 'Trade', 'Description', 'Pri', 'Status', 'Manager / approver', 'Due'].map((h, i) => (
            <Text key={h} style={[styles.th, { width: `${COLS[i]}%` }]}>{h}</Text>
          ))}
        </View>
        {data.rows.map((r, i) => (
          <View key={r.ref} style={[styles.row, ...(i % 2 === 1 ? [styles.rowAlt] : [])]}>
            {cell(COLS[0], r.ref, true)}
            {cell(COLS[1], trunc(r.location, 40))}
            {cell(COLS[2], trunc(r.trade, 30))}
            {cell(COLS[3], trunc(r.description))}
            {cell(COLS[4], `${r.priority}${r.isPrivate ? ' 🔒' : ''}`)}
            {cell(COLS[5], r.status.replace(/_/g, ' '))}
            {cell(COLS[6], trunc([r.managerName, r.finalApproverName].filter(Boolean).join(' / ') || '—', 45))}
            {cell(COLS[7], r.dueDate || '—')}
          </View>
        ))}
        {data.rows.length === 0 && (
          <Text style={{ padding: 12, fontSize: 9, color: '#64748b', textAlign: 'center' }}>No snag items recorded for this project.</Text>
        )}

        <Text style={styles.footer}>
          Confidential — for project team use. Private items (🔒) must not be shared with external stakeholders.
        </Text>
      </Page>
    </Document>
  );
}

export default SnagRegisterPdf;
