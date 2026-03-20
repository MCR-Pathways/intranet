import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export interface CertificateData {
  recipientName: string;
  courseTitle: string;
  completionDate: string;
  certificateNumber: string;
}

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 0,
  },
  header: {
    backgroundColor: "#1B2B4B",
    paddingVertical: 40,
    paddingHorizontal: 60,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    color: "#FFFFFF",
    fontWeight: "bold",
    letterSpacing: 3,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#CBD5E1",
    letterSpacing: 2,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 80,
    paddingVertical: 40,
  },
  presentedTo: {
    fontSize: 12,
    color: "#64748B",
    letterSpacing: 2,
    marginBottom: 16,
    textTransform: "uppercase",
  },
  recipientName: {
    fontSize: 36,
    color: "#1B2B4B",
    fontWeight: "bold",
    marginBottom: 32,
    textAlign: "center",
  },
  divider: {
    width: 120,
    height: 2,
    backgroundColor: "#1B2B4B",
    marginBottom: 32,
  },
  courseLabel: {
    fontSize: 11,
    color: "#64748B",
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  courseTitle: {
    fontSize: 20,
    color: "#334155",
    textAlign: "center",
    marginBottom: 40,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 60,
    marginTop: 16,
  },
  detailBlock: {
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 9,
    color: "#94A3B8",
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 12,
    color: "#475569",
  },
  footer: {
    backgroundColor: "#1B2B4B",
    paddingVertical: 16,
    alignItems: "center",
  },
  footerText: {
    fontSize: 9,
    color: "#94A3B8",
    letterSpacing: 1,
  },
});

export function CertificateDocument({ data }: { data: CertificateData }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MCR Pathways</Text>
          <Text style={styles.headerSubtitle}>Certificate of Completion</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.presentedTo}>This is presented to</Text>
          <Text style={styles.recipientName}>{data.recipientName}</Text>
          <View style={styles.divider} />
          <Text style={styles.courseLabel}>
            For successfully completing the course
          </Text>
          <Text style={styles.courseTitle}>{data.courseTitle}</Text>

          <View style={styles.detailsRow}>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Date of Completion</Text>
              <Text style={styles.detailValue}>{data.completionDate}</Text>
            </View>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Certificate Number</Text>
              <Text style={styles.detailValue}>{data.certificateNumber}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>MCR Pathways</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateCertificatePdf(
  data: CertificateData
): Promise<Buffer> {
  return renderToBuffer(<CertificateDocument data={data} />);
}
