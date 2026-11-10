import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { SiteDiaryReportData } from './types';
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
    borderBottomColor: '#d97706',
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
  diaryBadge: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'flex-end',
  },
  diaryDate: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#92400e',
  },
  diaryStatus: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#b45309',
    marginTop: 2,
  },
  documentTitleBox: {
    backgroundColor: '#92400e',
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
  notesBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  notesTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  notesText: {
    fontSize: 8,
    color: '#334155',
    lineHeight: 1.3,
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
  tableRowTotal: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  colTrade: {
    width: '70%',
    fontSize: 8,
    color: '#1e293b',
  },
  colHeadcount: {
    width: '30%',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    textAlign: 'right',
  },
  colTradeTotal: {
    width: '70%',
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  colHeadcountTotal: {
    width: '30%',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textAlign: 'right',
  },
  // Delivery table
  colMatName: {
    width: '35%',
    fontSize: 8,
    color: '#1e293b',
  },
  colMatQty: {
    width: '20%',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  colMatSupplier: {
    width: '25%',
    fontSize: 8,
    color: '#475569',
  },
  colMatNote: {
    width: '20%',
    fontSize: 8,
    color: '#64748b',
    textAlign: 'right',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  photoCard: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 6,
    backgroundColor: '#f8fafc',
  },
  photoCaption: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  photoTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  photoGps: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#0284c7',
  },
  photoTime: {
    fontSize: 7,
    color: '#64748b',
  },
  verifiedBadge: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#059669',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  signaturesSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
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
    marginBottom: 20,
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

export const SiteDiaryReportPdf: React.FC<{ data: SiteDiaryReportData }> = ({ data }) => {
  const { project, contractor, diary, laborHeadcounts, totalLaborHeadcount, materialDeliveries, photos } = data;

  return (
    <Document title={`Site Diary - ${project.code} - ${diary.entryDate}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBanner}>
          <View>
            <Text style={styles.brandTitle}>{contractor.name}</Text>
            <Text style={styles.subBrand}>Site Operations & Supervisor Field Records</Text>
          </View>
          <View style={styles.diaryBadge}>
            <Text style={styles.diaryDate}>{diary.entryDate}</Text>
            <Text style={styles.diaryStatus}>STATUS: {diary.siteStatus}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.documentTitleBox}>
          <Text style={styles.documentTitle}>Daily Site Diary & Field Inspection Report</Text>
        </View>

        {/* Metadata Grid */}
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
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>NCA Number:</Text>
              <Text style={styles.metaValue}>{project.ncaRegistrationNo || 'NCA Reg.'}</Text>
            </View>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaCardHeader}>Site Conditions & Personnel</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Weather Condition:</Text>
              <Text style={styles.metaValue}>{diary.weather}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Operational Status:</Text>
              <Text style={styles.metaValue}>{diary.siteStatus}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Recorded By:</Text>
              <Text style={styles.metaValue}>{diary.recordedByName}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Total Headcount:</Text>
              <Text style={styles.metaValue}>{totalLaborHeadcount} Personnel</Text>
            </View>
          </View>
        </View>

        {/* General Notes */}
        {diary.generalNotes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>Site Supervisor Log / Shift Notes</Text>
            <Text style={styles.notesText}>{diary.generalNotes}</Text>
          </View>
        )}

        {/* Labor Headcount Matrix */}
        <Text style={styles.sectionTitle}>Labor Headcount Matrix (Trades on Site)</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ width: '70%', fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155' }}>
              Trade / Skill Category
            </Text>
            <Text style={{ width: '30%', fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155', textAlign: 'right' }}>
              Headcount (Persons)
            </Text>
          </View>

          {laborHeadcounts.length > 0 ? (
            laborHeadcounts.map((l, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.colTrade}>{l.tradeType}</Text>
                <Text style={styles.colHeadcount}>{l.headcount}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text style={styles.colTrade}>No trade breakdown logged for this shift</Text>
              <Text style={styles.colHeadcount}>0</Text>
            </View>
          )}

          <View style={styles.tableRowTotal}>
            <Text style={styles.colTradeTotal}>Total Site Headcount</Text>
            <Text style={styles.colHeadcountTotal}>{totalLaborHeadcount} Persons</Text>
          </View>
        </View>

        {/* Material Deliveries */}
        <Text style={styles.sectionTitle}>Material Deliveries & Inbound Shipments</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={{ width: '35%', fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155' }}>Material Description</Text>
            <Text style={{ width: '20%', fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155' }}>Quantity & Unit</Text>
            <Text style={{ width: '25%', fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155' }}>Supplier</Text>
            <Text style={{ width: '20%', fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155', textAlign: 'right' }}>Delivery Note</Text>
          </View>

          {materialDeliveries.length > 0 ? (
            materialDeliveries.map((m, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={styles.colMatName}>{m.materialName}</Text>
                <Text style={styles.colMatQty}>{m.quantity} {m.unit}</Text>
                <Text style={styles.colMatSupplier}>{m.supplierName || 'Direct'}</Text>
                <Text style={styles.colMatNote}>{m.deliveryNote || 'N/A'}</Text>
              </View>
            ))
          ) : (
            <View style={styles.tableRow}>
              <Text style={styles.colMatName}>No inbound deliveries logged on this date</Text>
              <Text style={styles.colMatQty}>-</Text>
              <Text style={styles.colMatSupplier}>-</Text>
              <Text style={styles.colMatNote}>-</Text>
            </View>
          )}
        </View>

        {/* Photo Evidence Grid */}
        <Text style={styles.sectionTitle}>Geotagged Photo Evidence & Progress Record</Text>
        {photos.length > 0 ? (
          <View style={styles.photoGrid}>
            {photos.map((p, idx) => (
              <View key={idx} style={styles.photoCard}>
                <Text style={styles.photoCaption}>{p.caption || 'Verified Site Activity'}</Text>
                <View style={styles.photoTagRow}>
                  <Text style={styles.photoGps}>
                    GPS: {p.gpsLatitude?.toFixed(4)}, {p.gpsLongitude?.toFixed(4)}
                  </Text>
                  <Text style={styles.photoTime}>{p.takenAt}</Text>
                </View>
                <Text style={styles.verifiedBadge}>
                  {p.isNairobiGeotagged ? '✓ Nairobi Geotag Verified (NCA Compliant)' : '✓ Verified Site Asset'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.notesBox, { marginBottom: 14 }]}>
            <Text style={styles.notesText}>No photo evidence attached to this diary record.</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signaturesSection}>
          <View style={styles.signaturesRow}>
            <View style={styles.signatoryCard}>
              <Text style={styles.signatoryRole}>Site Supervisor</Text>
              <Text style={styles.signatoryDetail}>{diary.recordedByName} • Field Shift Officer</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Supervisor Signature & Date</Text>
            </View>

            <View style={styles.signatoryCard}>
              <Text style={styles.signatoryRole}>Project Manager / Resident Engineer</Text>
              <Text style={styles.signatoryDetail}>Consulting Engineer / PM Verification</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>PM / Engineer Review & Signature</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>{PRODUCT_NAME} Daily Site Diary • Project: {project.code}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
