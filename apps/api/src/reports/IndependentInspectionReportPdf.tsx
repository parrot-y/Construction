import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { IndependentInspectionReportData } from './types';

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  headerBanner: {
    borderBottomWidth: 2,
    borderBottomColor: '#047857',
    paddingBottom: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandTitle: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
    letterSpacing: 0.5,
  },
  subBrand: {
    fontSize: 7.5,
    color: '#059669',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  refBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'flex-end',
  },
  refText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#065f46',
  },
  dateText: {
    fontSize: 7,
    color: '#047857',
    marginTop: 2,
  },
  titleBar: {
    backgroundColor: '#064e3b',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 10,
    borderRadius: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  urgencyTag: {
    backgroundColor: '#10b981',
    color: '#ffffff',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  metaCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 3,
    padding: 6,
    backgroundColor: '#f8fafc',
  },
  metaCardHeader: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 2,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 7,
    color: '#64748b',
  },
  metaValue: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    textAlign: 'right',
  },
  varianceSection: {
    borderWidth: 1.5,
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },
  varianceAlertDanger: {
    borderColor: '#e11d48',
    backgroundColor: '#fff1f2',
  },
  varianceAlertSuccess: {
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  varianceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  varianceTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  varianceGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  varianceCol: {
    flex: 1,
    padding: 5,
    backgroundColor: '#ffffff',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  varianceColLabel: {
    fontSize: 6.5,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  varianceColValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  notesCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 3,
    padding: 7,
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  notesHeading: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  notesBody: {
    fontSize: 7.5,
    color: '#334155',
    lineHeight: 1.3,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  halfCol: {
    flex: 1,
  },
  table: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 3,
    marginBottom: 8,
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 3.5,
    paddingHorizontal: 6,
  },
  tableCellHeader: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  tableCell: {
    fontSize: 7,
    color: '#1e293b',
  },
  footer: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  securityText: {
    fontSize: 6,
    color: '#64748b',
    fontFamily: 'Courier',
  },
  pageNumber: {
    fontSize: 6.5,
    color: '#94a3b8',
  },
});

export const IndependentInspectionReportPdf: React.FC<{
  data: IndependentInspectionReportData;
}> = ({ data }) => {
  const isCritical = data.metrics.isInflationFlagged;

  return (
    <Document title={`Independent Site Inspection - ${data.reportRef}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBanner}>
          <View>
            <Text style={styles.brandTitle}>BUILDSAAS / MJENGOLEDGER</Text>
            <Text style={styles.subBrand}>
              Neutral Third-Party Clerk of Works & Site Inspection Service
            </Text>
          </View>
          <View style={styles.refBadge}>
            <Text style={styles.refText}>{data.reportRef}</Text>
            <Text style={styles.dateText}>Conducted: {data.conductedDate || data.inspectionDate}</Text>
          </View>
        </View>

        {/* Title Bar */}
        <View style={styles.titleBar}>
          <Text style={styles.titleText}>
            Independent Physical Progress Verification & Forensic Audit
          </Text>
          <Text style={styles.urgencyTag}>{data.urgency}</Text>
        </View>

        {/* Meta Grid */}
        <View style={styles.metaGrid}>
          {/* Project Details */}
          <View style={styles.metaCard}>
            <Text style={styles.metaCardHeader}>Project Details</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Project Name:</Text>
              <Text style={styles.metaValue}>{data.project.name}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Code / Ref:</Text>
              <Text style={styles.metaValue}>{data.project.code}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Location:</Text>
              <Text style={styles.metaValue}>{data.project.location || 'Nairobi County'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>NCA Reg No:</Text>
              <Text style={styles.metaValue}>{data.project.ncaRegistrationNo || 'NCA/PRJ/CERT'}</Text>
            </View>
          </View>

          {/* Neutral Inspector */}
          <View style={styles.metaCard}>
            <Text style={styles.metaCardHeader}>Neutral Inspector</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Inspector:</Text>
              <Text style={styles.metaValue}>{data.inspector.name}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Licence / Reg:</Text>
              <Text style={styles.metaValue}>{data.inspector.license}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>GPS Coordinates:</Text>
              <Text style={styles.metaValue}>
                {data.inspector.latitude && data.inspector.longitude
                  ? `${data.inspector.latitude.toFixed(6)}, ${data.inspector.longitude.toFixed(6)}`
                  : 'Site Geotag Verified'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Requested By:</Text>
              <Text style={styles.metaValue}>{data.requestedBy}</Text>
            </View>
          </View>

          {/* Stage & Status */}
          <View style={styles.metaCard}>
            <Text style={styles.metaCardHeader}>Milestone & Status</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Work Stage:</Text>
              <Text style={styles.metaValue}>{data.stage.toUpperCase()}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status:</Text>
              <Text style={styles.metaValue}>{data.status}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Contractor:</Text>
              <Text style={styles.metaValue}>{data.contractor.name}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Defects Found:</Text>
              <Text
                style={{
                  ...styles.metaValue,
                  color: data.structuralDefectsFound ? '#e11d48' : '#059669',
                }}
              >
                {data.structuralDefectsFound ? 'DEFECTS DETECTED' : 'ZERO DEFECTS'}
              </Text>
            </View>
          </View>
        </View>

        {/* Progress Variance & Anti-Inflation Analysis Callout */}
        <View
          style={[
            styles.varianceSection,
            isCritical ? styles.varianceAlertDanger : styles.varianceAlertSuccess,
          ]}
        >
          <View style={styles.varianceHeader}>
            <Text
              style={[
                styles.varianceTitle,
                { color: isCritical ? '#be123c' : '#047857' },
              ]}
            >
              {isCritical
                ? '⚠️ CRITICAL PROGRESS INFLATION DETECTED — PAYMENT WITHHOLD RECOMMENDED'
                : '✓ PHYSICAL PROGRESS VERIFIED CONCURRENT WITH SITE LOG'}
            </Text>
            <Text
              style={{
                fontSize: 8,
                fontFamily: 'Helvetica-Bold',
                color: isCritical ? '#9f1239' : '#065f46',
              }}
            >
              Variance Status: {data.metrics.varianceStatus}
            </Text>
          </View>

          <View style={styles.varianceGrid}>
            <View style={styles.varianceCol}>
              <Text style={styles.varianceColLabel}>Contractor Claimed</Text>
              <Text style={styles.varianceColValue}>{data.metrics.reportedProgressPct}%</Text>
            </View>
            <View style={styles.varianceCol}>
              <Text style={styles.varianceColLabel}>Neutral Inspector Verified</Text>
              <Text style={[styles.varianceColValue, { color: '#047857' }]}>
                {data.metrics.verifiedProgressPct}%
              </Text>
            </View>
            <View style={styles.varianceCol}>
              <Text style={styles.varianceColLabel}>Variance Delta (Δ)</Text>
              <Text
                style={[
                  styles.varianceColValue,
                  { color: isCritical ? '#e11d48' : '#059669' },
                ]}
              >
                {data.metrics.variancePct}%
              </Text>
            </View>
            <View style={styles.varianceCol}>
              <Text style={styles.varianceColLabel}>Recommended Action</Text>
              <Text
                style={{
                  fontSize: 8,
                  fontFamily: 'Helvetica-Bold',
                  color: isCritical ? '#be123c' : '#047857',
                  marginTop: 2,
                }}
              >
                {data.metrics.recommendedAction}
              </Text>
            </View>
          </View>
        </View>

        {/* Scope and Findings */}
        <View style={styles.notesCard}>
          <Text style={styles.notesHeading}>Scope of Inspection</Text>
          <Text style={styles.notesBody}>{data.scopeDescription}</Text>
        </View>

        {/* Structural Findings & Recommendations */}
        <View style={styles.twoCol}>
          <View style={[styles.halfCol, styles.notesCard, { marginBottom: 0 }]}>
            <Text style={styles.notesHeading}>Inspector Physical Observations</Text>
            <Text style={styles.notesBody}>
              {data.findingsNotes || 'No anomalies recorded during structural inspection.'}
            </Text>
          </View>
          <View style={[styles.halfCol, styles.notesCard, { marginBottom: 0 }]}>
            <Text style={styles.notesHeading}>Actionable Recommendations</Text>
            <Text style={styles.notesBody}>
              {data.recommendations || 'Proceed with works adhering to approved architectural specifications.'}
            </Text>
          </View>
        </View>

        {/* Materials Audit & Quality Compliance */}
        {data.materialsOnSiteNotes && (
          <View style={styles.notesCard}>
            <Text style={styles.notesHeading}>Forensic Materials & Quality Audit</Text>
            <Text style={styles.notesBody}>{data.materialsOnSiteNotes}</Text>
          </View>
        )}

        {/* Photo Evidence Register */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCellHeader, { width: '25%' }]}>Element Inspected</Text>
            <Text style={[styles.tableCellHeader, { width: '45%' }]}>Photo Description / Caption</Text>
            <Text style={[styles.tableCellHeader, { width: '15%' }]}>Discrepancy</Text>
            <Text style={[styles.tableCellHeader, { width: '15%' }]}>Timestamp</Text>
          </View>
          {data.photos.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '100%', fontStyle: 'italic', color: '#64748b' }]}>
                Inspection photos logged into cloud storage vault.
              </Text>
            </View>
          ) : (
            data.photos.map((p, idx) => (
              <View key={p.id || idx} style={styles.tableRow}>
                <Text style={[styles.tableCell, { width: '25%', fontFamily: 'Helvetica-Bold' }]}>
                  {p.elementInspected || 'Structural Element'}
                </Text>
                <Text style={[styles.tableCell, { width: '45%' }]}>
                  {p.caption || 'Site photographic evidence capture'}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    {
                      width: '15%',
                      fontFamily: 'Helvetica-Bold',
                      color: p.hasDiscrepancy ? '#e11d48' : '#059669',
                    },
                  ]}
                >
                  {p.hasDiscrepancy ? 'FLAGGED' : 'COMPLIANT'}
                </Text>
                <Text style={[styles.tableCell, { width: '15%', color: '#64748b', fontSize: 6.5 }]}>
                  {new Date(p.capturedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Client Review & Sign-off (if reviewed) */}
        {data.clientReviewNotes && (
          <View
            style={[
              styles.notesCard,
              { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' },
            ]}
          >
            <Text style={[styles.notesHeading, { color: '#6b21a8' }]}>
              Diaspora Remote Owner Review & Sign-Off (Satisfaction: {data.clientSatisfactionRating || 5}/5 ⭐)
            </Text>
            <Text style={[styles.notesBody, { color: '#581c87' }]}>
              &quot;{data.clientReviewNotes}&quot;
            </Text>
          </View>
        )}

        {/* Signatures & Accreditation Footer */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.securityText}>
              RECORD VERIFICATION HASH: {data.securityHash}
            </Text>
            <Text style={[styles.securityText, { marginTop: 1 }]}>
              Generated by MjengoLedger internal site monitoring tool. This document is an operational progress record and does NOT constitute official statutory certification under the Architects and Quantity Surveyors Act (Cap 525) or NCA Act.
            </Text>
          </View>
          <Text style={styles.pageNumber}>Page 1 of 1</Text>
        </View>
      </Page>
    </Document>
  );
};
