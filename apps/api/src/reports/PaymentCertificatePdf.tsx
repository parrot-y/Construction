import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { PaymentCertificateData } from './types';

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
    borderBottomColor: '#0f172a',
    paddingBottom: 10,
    marginBottom: 14,
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
  certificateBadge: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'flex-end',
  },
  certificateBadgeText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  dateText: {
    fontSize: 8,
    color: '#475569',
    marginTop: 2,
  },
  documentTitleBox: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 14,
    borderRadius: 2,
    textAlign: 'center',
  },
  documentTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#ffffff',
  },
  gridTwoCol: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#f8fafc',
  },
  cardHeader: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  infoLabel: {
    fontSize: 8,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    textAlign: 'right',
    maxWidth: '65%',
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
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableHeaderColItem: {
    width: '10%',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#334155',
  },
  tableHeaderColDesc: {
    width: '60%',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#334155',
  },
  tableHeaderColAmount: {
    width: '30%',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#334155',
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableRowHighlight: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableRowGrandTotal: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  colItem: {
    width: '10%',
    fontSize: 8,
    color: '#64748b',
  },
  colDesc: {
    width: '60%',
    fontSize: 8,
    color: '#1e293b',
  },
  colDescBold: {
    width: '60%',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  colAmount: {
    width: '30%',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    textAlign: 'right',
  },
  colAmountDeduction: {
    width: '30%',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#b91c1c',
    textAlign: 'right',
  },
  colDescTotal: {
    width: '60%',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  colAmountTotal: {
    width: '30%',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textAlign: 'right',
  },
  policyBox: {
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fefce8',
    borderRadius: 4,
    padding: 8,
    marginBottom: 14,
  },
  policyTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#854d0e',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  policyText: {
    fontSize: 7.5,
    color: '#713f12',
    lineHeight: 1.3,
  },
  signaturesSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  signaturesTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  signaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  signatoryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#ffffff',
  },
  signatoryRole: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  signatoryDetail: {
    fontSize: 7,
    color: '#64748b',
    marginBottom: 22,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#94a3b8',
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
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

export const PaymentCertificatePdf: React.FC<{ data: PaymentCertificateData }> = ({ data }) => {
  const { project, employer, contractor, consultant, financials, certificateNo, valuationDate } = data;

  return (
    <Document title={`Interim Payment Certificate - ${certificateNo}`}>
      <Page size="A4" style={styles.page}>
        {/* Header Banner */}
        <View style={styles.headerBanner}>
          <View>
            <Text style={styles.brandTitle}>{contractor.name}</Text>
            <Text style={styles.subBrand}>
              Kenyan Standard Construction Contract • NCA Category: {contractor.ncaCategory || 'NCA 1'}
            </Text>
          </View>
          <View style={styles.certificateBadge}>
            <Text style={styles.certificateBadgeText}>{certificateNo}</Text>
            <Text style={styles.dateText}>Valuation Date: {valuationDate}</Text>
          </View>
        </View>

        {/* Title Bar */}
        <View style={styles.documentTitleBox}>
          <Text style={styles.documentTitle}>Interim Payment Certificate (IPC)</Text>
        </View>

        {/* 2-Column Parties & Project Info */}
        <View style={styles.gridTwoCol}>
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Project & Contract Particulars</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Project Name:</Text>
              <Text style={styles.infoValue}>{project.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Project Code:</Text>
              <Text style={styles.infoValue}>{project.code}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Site Location:</Text>
              <Text style={styles.infoValue}>{project.location || 'Nairobi, Kenya'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>NCA Reg. Number:</Text>
              <Text style={styles.infoValue}>{project.ncaRegistrationNo || 'NCA-PRJ-2026'}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeader}>Contracting Parties & Consultant</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Employer / Client:</Text>
              <Text style={styles.infoValue}>{employer.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Main Contractor:</Text>
              <Text style={styles.infoValue}>{contractor.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Contractor KRA PIN:</Text>
              <Text style={styles.infoValue}>{contractor.kraPin || 'P051234567Z'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Quantity Surveyor:</Text>
              <Text style={styles.infoValue}>{consultant.qsName} ({consultant.boraqsRegistrationNo})</Text>
            </View>
          </View>
        </View>

        {/* Financial Valuation Ledger Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderColItem}>Item</Text>
            <Text style={styles.tableHeaderColDesc}>Description of Valuation</Text>
            <Text style={styles.tableHeaderColAmount}>Amount ({contractor.currency})</Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.colItem}>1.0</Text>
            <Text style={styles.colDesc}>Original Agreed Contract Sum</Text>
            <Text style={styles.colAmount}>{financials.contractSum}</Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.colItem}>2.0</Text>
            <Text style={styles.colDesc}>Net Approved Variations to Date</Text>
            <Text style={styles.colAmount}>{financials.approvedVariations}</Text>
          </View>

          <View style={styles.tableRowHighlight}>
            <Text style={styles.colItem}>3.0</Text>
            <Text style={styles.colDescBold}>Current Approved Contract Sum (1.0 + 2.0)</Text>
            <Text style={styles.colAmount}>{financials.revisedContractSum}</Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.colItem}>4.0</Text>
            <Text style={styles.colDescBold}>Gross Valuation (Work Executed to Date)</Text>
            <Text style={styles.colAmount}>{financials.grossValuation}</Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.colItem}>5.0</Text>
            <Text style={styles.colDesc}>
              Less: Retention Deduction ({financials.retentionDeductionRate} up to {financials.retentionMaxCapRate} Cap of KES {financials.retentionMaxCapAmount})
            </Text>
            <Text style={styles.colAmountDeduction}>- {financials.retentionDeducted}</Text>
          </View>

          <View style={styles.tableRowHighlight}>
            <Text style={styles.colItem}>6.0</Text>
            <Text style={styles.colDescBold}>Cumulative Net Certified Valuation (4.0 - 5.0)</Text>
            <Text style={styles.colAmount}>{financials.cumulativeNetValuation}</Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.colItem}>7.0</Text>
            <Text style={styles.colDesc}>Less: Previous Certified Interim Payments</Text>
            <Text style={styles.colAmountDeduction}>- {financials.previousPaymentsCertified}</Text>
          </View>

          <View style={styles.tableRowGrandTotal}>
            <Text style={{ width: '10%', color: '#ffffff', fontSize: 9 }}>8.0</Text>
            <Text style={styles.colDescTotal}>Net Amount Due for Interim Payment</Text>
            <Text style={styles.colAmountTotal}>KES {financials.netAmountDue}</Text>
          </View>
        </View>

        {/* Kenyan Retention Terms Callout */}
        <View style={styles.policyBox}>
          <Text style={styles.policyTitle}>Contractual Retention Fund Terms (Reference Provisions)</Text>
          <Text style={styles.policyText}>
            Interim retention deduction of {financials.retentionDeductionRate} applies on gross valuation up to a maximum cap of {financials.retentionMaxCapRate} (KES {financials.retentionMaxCapAmount}). In accordance with standard building subcontract terms, 50% of the retention fund is typically released upon Practical Completion (Handover) and the remaining 50% upon issuance of the Final Certificate at the expiry of the Defects Liability Period (DLP).
          </Text>
          <Text style={{ fontSize: 6.5, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
            NOTICE: This document is a software-generated payment valuation record. It does not constitute statutory certification under the Architects and Quantity Surveyors Act (Cap 525). Official valuation certificates must be validated and stamped by a registered Quantity Surveyor.
          </Text>
        </View>

        {/* Signatures Block */}
        <View style={styles.signaturesSection}>
          <Text style={styles.signaturesTitle}>Professional Approvals & Contractual Signatures</Text>
          <View style={styles.signaturesRow}>
            <View style={styles.signatoryCard}>
              <Text style={styles.signatoryRole}>Quantity Surveyor (Valuer)</Text>
              <Text style={styles.signatoryDetail}>{consultant.qsName} • BORAQS: {consultant.boraqsRegistrationNo}</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Signature & Professional Stamp</Text>
            </View>

            <View style={styles.signatoryCard}>
              <Text style={styles.signatoryRole}>Main Contractor</Text>
              <Text style={styles.signatoryDetail}>{contractor.name} • PIN: {contractor.kraPin || 'KRA PIN'}</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Authorized Contractor Signature</Text>
            </View>

            <View style={styles.signatoryCard}>
              <Text style={styles.signatoryRole}>Employer / Developer</Text>
              <Text style={styles.signatoryDetail}>{employer.name}</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Employer Certification & Approval</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>MjengoLedger Immutable Financial System • Certificate: {certificateNo}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
