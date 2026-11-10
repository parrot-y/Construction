import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { ProjectSummaryData } from './types';
import { PRODUCT_NAME } from '../lib/product';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  headerBanner: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    paddingBottom: 10,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  subBrand: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  dateBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 8,
    color: '#1e40af',
    fontFamily: 'Helvetica-Bold',
  },
  documentTitleBox: {
    backgroundColor: '#1e40af',
    color: '#ffffff',
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 12,
    borderRadius: 2,
    textAlign: 'center',
  },
  documentTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metaCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 7,
    backgroundColor: '#f8fafc',
  },
  metaCardHeader: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 3,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2.5,
  },
  metaLabel: {
    fontSize: 7.5,
    color: '#64748b',
  },
  metaValue: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    textAlign: 'right',
  },
  // 5 Financial numbers grid
  financialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  financialCard: {
    width: '31.5%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    padding: 7,
    backgroundColor: '#ffffff',
  },
  financialCardWide: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    padding: 7,
    backgroundColor: '#ffffff',
  },
  financialLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  financialAmount: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  financialAmountAccent: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#047857',
  },
  financialAmountBlue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1d4ed8',
  },
  financialSub: {
    fontSize: 6.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  // Progress & Health Card
  healthCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  healthTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  healthBadge: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 7,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  noticeBox: {
    fontSize: 7.5,
    color: '#334155',
    lineHeight: 1.3,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 3,
    padding: 5,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  table: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  colSecTitle: {
    width: '32%',
    fontSize: 8,
    color: '#1e293b',
  },
  colSecBudget: {
    width: '18%',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    textAlign: 'right',
  },
  colSecSpent: {
    width: '18%',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#047857',
    textAlign: 'right',
  },
  colSecRemaining: {
    width: '18%',
    fontSize: 8,
    color: '#1e293b',
    textAlign: 'right',
  },
  colSecPct: {
    width: '14%',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textAlign: 'right',
  },
  disclaimer: {
    fontSize: 7,
    color: '#64748b',
    lineHeight: 1.3,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    marginBottom: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
    fontSize: 7,
    color: '#94a3b8',
  },
});

export const ProjectSummaryPdf: React.FC<{ data: ProjectSummaryData }> = ({ data }) => {
  const { project, contractor, generatedAt, financials, progress, sections } = data;

  const getStatusBadgeStyle = (status: 'ON_TRACK' | 'ATTENTION' | 'ACTION_REQUIRED') => {
    switch (status) {
      case 'ON_TRACK':
        return { backgroundColor: '#dcfce7', color: '#166534' };
      case 'ATTENTION':
        return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'ACTION_REQUIRED':
        return { backgroundColor: '#fee2e2', color: '#991b1b' };
    }
  };

  return (
    <Document title={`Project Summary - ${project.code}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBanner}>
          <View>
            <Text style={styles.brandTitle}>{contractor.name}</Text>
            <Text style={styles.subBrand}>Executive Portfolio & Cost Control Intelligence</Text>
          </View>
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>Generated: {generatedAt}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.documentTitleBox}>
          <Text style={styles.documentTitle}>Executive Project Summary & Cost Report</Text>
        </View>

        {/* Project Meta */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Text style={styles.metaCardHeader}>Project Details</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Project Name:</Text>
              <Text style={styles.metaValue}>{project.name}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Project Code:</Text>
              <Text style={styles.metaValue}>{project.code}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Location:</Text>
              <Text style={styles.metaValue}>{project.location || 'Nairobi, Kenya'}</Text>
            </View>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaCardHeader}>Contract Compliance</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>NCA Project No:</Text>
              <Text style={styles.metaValue}>{project.ncaRegistrationNo || 'NCA Reg.'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Contractor PIN:</Text>
              <Text style={styles.metaValue}>{contractor.kraPin || 'N/A'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Report Currency:</Text>
              <Text style={styles.metaValue}>{contractor.currency} (Kenyan Shillings)</Text>
            </View>
          </View>
        </View>

        {/* 5 Financial Numbers Cards */}
        <Text style={styles.sectionTitle}>The 5 Financial Numbers (Budget Baseline & Variance)</Text>
        <View style={styles.financialGrid}>
          <View style={styles.financialCard}>
            <Text style={styles.financialLabel}>1. Original Agreed Budget</Text>
            <Text style={styles.financialAmount}>KES {financials.originalAgreedBudget}</Text>
            <Text style={styles.financialSub}>Contract baseline sum</Text>
          </View>

          <View style={styles.financialCard}>
            <Text style={styles.financialLabel}>2. Approved Variations</Text>
            <Text style={styles.financialAmountBlue}>+ KES {financials.approvedVariationsTotal}</Text>
            <Text style={styles.financialSub}>Net scope revisions</Text>
          </View>

          <View style={styles.financialCard}>
            <Text style={styles.financialLabel}>3. Current Approved Budget</Text>
            <Text style={styles.financialAmount}>KES {financials.currentApprovedBudget}</Text>
            <Text style={styles.financialSub}>Baseline + Variations</Text>
          </View>

          <View style={styles.financialCardWide}>
            <Text style={styles.financialLabel}>4. Total Spent to Date</Text>
            <Text style={styles.financialAmountAccent}>KES {financials.totalSpentToDate}</Text>
            <Text style={styles.financialSub}>Total approved certified cost</Text>
          </View>

          <View style={styles.financialCardWide}>
            <Text style={styles.financialLabel}>5. Remaining Balance</Text>
            <Text style={styles.financialAmount}>KES {financials.remainingBalance}</Text>
            <Text style={styles.financialSub}>Available committed funds</Text>
          </View>
        </View>

        {/* Progress & Neutral Health Guard */}
        <View style={styles.healthCard}>
          <View style={styles.healthHeader}>
            <Text style={styles.healthTitle}>Physical Progress vs Budget Utilization</Text>
            <Text style={[styles.healthBadge, getStatusBadgeStyle(progress.healthStatus)]}>
              {progress.healthStatus}
            </Text>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Physical Progress</Text>
              <Text style={[styles.metricValue, { color: '#047857' }]}>
                {progress.physicalProgressPercentage.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Budget Used</Text>
              <Text style={[styles.metricValue, { color: '#1e40af' }]}>
                {financials.budgetUsedPercentage.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Variance Delta</Text>
              <Text style={[styles.metricValue, { color: progress.varianceDelta > 0 ? '#b45309' : '#047857' }]}>
                {progress.varianceDelta > 0 ? `+${progress.varianceDelta.toFixed(1)}%` : `${progress.varianceDelta.toFixed(1)}%`}
              </Text>
            </View>
          </View>

          <View style={styles.noticeBox}>
            <Text>Status Notice: {progress.healthNotice}</Text>
          </View>
        </View>

        {/* Section BOQ Breakdown Table */}
        <Text style={styles.sectionTitle}>BOQ Section Cost Breakdown</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ width: '32%', fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155' }}>Section</Text>
            <Text style={{ width: '18%', fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155', textAlign: 'right' }}>Budget (KES)</Text>
            <Text style={{ width: '18%', fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155', textAlign: 'right' }}>Spent (KES)</Text>
            <Text style={{ width: '18%', fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155', textAlign: 'right' }}>Remaining</Text>
            <Text style={{ width: '14%', fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155', textAlign: 'right' }}>Consumed</Text>
          </View>

          {sections.length > 0 ? (
            sections.map((s, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.colSecTitle}>{s.title}</Text>
                <Text style={styles.colSecBudget}>{s.allocatedBudget}</Text>
                <Text style={styles.colSecSpent}>{s.actualSpent}</Text>
                <Text style={styles.colSecRemaining}>{s.remainingBudget}</Text>
                <Text style={styles.colSecPct}>{s.consumptionPercentage}%</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text style={styles.colSecTitle}>General Project Scope</Text>
              <Text style={styles.colSecBudget}>{financials.currentApprovedBudget}</Text>
              <Text style={styles.colSecSpent}>{financials.totalSpentToDate}</Text>
              <Text style={styles.colSecRemaining}>{financials.remainingBalance}</Text>
              <Text style={styles.colSecPct}>{financials.budgetUsedPercentage.toFixed(1)}%</Text>
            </View>
          )}
        </View>

        {/* Professional Neutral Disclaimer */}
        <Text style={styles.disclaimer}>
          Factual Audit Notice: This executive summary is produced directly from the append-only cryptographic transaction ledger of Platform. All figures represent verified and approved cost items and physical measurement progress records as of the generation timestamp.
        </Text>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>{PRODUCT_NAME} Executive Project Summary • Project: {project.code}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
