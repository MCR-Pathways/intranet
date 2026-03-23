/**
 * Certificate PDF generation using @react-pdf/renderer.
 *
 * Generates MCR Pathways branded certificates of completion.
 * Server-only — uses Node.js APIs for PDF rendering.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 60,
    fontFamily: "Helvetica",
  },
  header: {
    textAlign: "center",
    marginBottom: 40,
  },
  orgName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#213350",
    marginBottom: 4,
  },
  orgSubtitle: {
    fontSize: 10,
    color: "#6b7280",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  divider: {
    height: 3,
    backgroundColor: "#213350",
    marginVertical: 24,
    borderRadius: 2,
  },
  thinDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 20,
  },
  certificateTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#213350",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 32,
  },
  presentedTo: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  learnerName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#213350",
    textAlign: "center",
    marginBottom: 24,
  },
  completionText: {
    fontSize: 12,
    color: "#4b5563",
    textAlign: "center",
    lineHeight: 1.6,
    marginBottom: 8,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#213350",
    textAlign: "center",
    marginBottom: 24,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 40,
    marginTop: 16,
  },
  detailItem: {
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 9,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 12,
    color: "#213350",
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 60,
    right: 60,
    textAlign: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
});

// ─── Certificate Document ───────────────────────────────────────────────────

export interface CertificateData {
  recipientName: string;
  courseTitle: string;
  completionDate: string;
  certificateNumber: string;
}

/**
 * React PDF Document component for certificate generation.
 * Usage: const pdfBuffer = await renderToBuffer(<CertificateDocument data={...} />)
 */
export function CertificateDocument({ data }: { data: CertificateData }) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", orientation: "landscape", style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.orgName }, "MCR Pathways"),
        React.createElement(
          Text,
          { style: styles.orgSubtitle },
          "Changing the Destiny of Care Experienced Young People"
        )
      ),
      // Divider
      React.createElement(View, { style: styles.divider }),
      // Certificate title
      React.createElement(
        Text,
        { style: styles.certificateTitle },
        "Certificate of Completion"
      ),
      React.createElement(
        Text,
        { style: styles.subtitle },
        "This certificate is awarded to"
      ),
      // Learner name
      React.createElement(
        Text,
        { style: styles.learnerName },
        data.recipientName
      ),
      // Completion text
      React.createElement(
        Text,
        { style: styles.completionText },
        "for successfully completing the course"
      ),
      React.createElement(
        Text,
        { style: styles.courseTitle },
        data.courseTitle
      ),
      // Thin divider
      React.createElement(View, { style: styles.thinDivider }),
      // Details row
      React.createElement(
        View,
        { style: styles.detailsRow },
        React.createElement(
          View,
          { style: styles.detailItem },
          React.createElement(Text, { style: styles.detailLabel }, "Date"),
          React.createElement(
            Text,
            { style: styles.detailValue },
            data.completionDate
          )
        ),
        React.createElement(
          View,
          { style: styles.detailItem },
          React.createElement(
            Text,
            { style: styles.detailLabel },
            "Certificate No."
          ),
          React.createElement(
            Text,
            { style: styles.detailValue },
            data.certificateNumber
          )
        )
      ),
      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(
          Text,
          { style: styles.footerText },
          `MCR Pathways · ${data.certificateNumber} · Issued ${data.completionDate}`
        )
      )
    )
  );
}

/**
 * Generate a certificate PDF as a Buffer.
 * Server-only — calls @react-pdf/renderer.
 */
export async function generateCertificatePdf(
  data: CertificateData
): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const element = React.createElement(CertificateDocument, { data });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  return Buffer.from(buffer);
}
