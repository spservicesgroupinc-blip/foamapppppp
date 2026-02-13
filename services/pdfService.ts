import jsPDF from 'jspdf';
import { AppSettings, Estimate, Customer, JobStatus } from '../types';

// ============================================================
// Types for editable PDF sections
// ============================================================
export interface PDFLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  total: string;
}

export interface PDFDocumentData {
  // Header
  documentTitle: string; // e.g. "ESTIMATE", "WORK ORDER", "INVOICE"
  documentNumber: string;
  documentDate: string;

  // Company info (from settings)
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  logoDataUrl: string | null;

  // Customer / Bill-To
  customerName: string;
  customerCompany: string;
  customerAddress: string;
  customerCityStateZip: string;
  customerPhone: string;
  customerEmail: string;

  // Job info
  jobName: string;
  jobAddress: string;

  // Line items
  lineItems: PDFLineItem[];

  // Totals
  subtotal: string;
  taxLabel: string;
  taxAmount: string;
  total: string;

  // Footer
  notes: string;
  termsAndConditions: string;
  thankYouMessage: string;
}

// ============================================================
// Build default document data from estimate + customer + settings
// ============================================================
export const buildPDFDocumentData = (
  estimate: Estimate,
  customer: Customer | undefined,
  settings: AppSettings
): PDFDocumentData => {
  const docType = getDocumentType(estimate.status);

  const lineItems: PDFLineItem[] = estimate.items.map(item => ({
    description: item.description,
    quantity: String(item.quantity),
    unit: item.unit,
    unitPrice: item.unitPrice.toFixed(2),
    total: item.total.toFixed(2),
  }));

  const termsMap: Record<string, string> = {
    'ESTIMATE': 'This estimate is valid for 30 days from the date above. Prices are subject to change after expiration. A signed acceptance is required to proceed.',
    'WORK ORDER': 'Work will be performed according to the specifications outlined above. Any changes to scope must be approved in writing and may affect pricing.',
    'INVOICE': 'Payment is due within 30 days of invoice date. Late payments may be subject to a 1.5% monthly finance charge.',
  };

  return {
    documentTitle: docType,
    documentNumber: estimate.number,
    documentDate: new Date(estimate.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    companyName: settings.companyName,
    companyAddress: settings.companyAddress,
    companyPhone: settings.companyPhone,
    companyEmail: settings.companyEmail,
    logoDataUrl: null, // Will be populated by the modal if logo is available
    customerName: customer?.name || 'N/A',
    customerCompany: customer?.companyName || '',
    customerAddress: customer?.address || '',
    customerCityStateZip: customer
      ? `${customer.city}, ${customer.state} ${customer.zip}`.trim()
      : '',
    customerPhone: customer?.phone || '',
    customerEmail: customer?.email || '',
    jobName: estimate.jobName || 'Spray Foam Insulation',
    jobAddress: estimate.jobAddress || '',
    lineItems,
    subtotal: estimate.subtotal.toFixed(2),
    taxLabel: `Tax (${settings.taxRate}%)`,
    taxAmount: estimate.tax.toFixed(2),
    total: estimate.total.toFixed(2),
    notes: estimate.notes || '',
    termsAndConditions: termsMap[docType] || termsMap['ESTIMATE'],
    thankYouMessage: 'Thank you for your business!',
  };
};

const getDocumentType = (status: JobStatus): string => {
  switch (status) {
    case JobStatus.INVOICED:
    case JobStatus.PAID:
      return 'INVOICE';
    case JobStatus.WORK_ORDER:
      return 'WORK ORDER';
    default:
      return 'ESTIMATE';
  }
};

// ============================================================
// Generate the actual PDF from PDFDocumentData
// ============================================================
export const generatePDFFromData = (data: PDFDocumentData): jsPDF => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const brandColor: [number, number, number] = [185, 28, 28]; // brand-700 red
  const darkText: [number, number, number] = [30, 41, 59]; // slate-800
  const medText: [number, number, number] = [100, 116, 139]; // slate-500
  const lightBg: [number, number, number] = [248, 250, 252]; // slate-50
  const borderColor: [number, number, number] = [226, 232, 240]; // slate-200

  // Helper: check if we need a new page
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }
  };

  // ── HEADER AREA ──────────────────────────────────────────
  // Brand bar across top
  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pageWidth, 6, 'F');

  y = 30;

  // Logo or company name
  if (data.logoDataUrl) {
    try {
      doc.addImage(data.logoDataUrl, 'PNG', margin, y, 120, 50);
      y += 60;
    } catch {
      // Fallback to text if image fails
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkText);
      doc.text(data.companyName, margin, y + 18);
      y += 30;
    }
  } else {
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkText);
    doc.text(data.companyName, margin, y + 18);
    y += 30;
  }

  // Company contact line
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...medText);
  const contactLine = [data.companyAddress, data.companyPhone, data.companyEmail]
    .filter(Boolean)
    .join('  |  ');
  doc.text(contactLine, margin, y);
  y += 20;

  // Document type badge (right side)
  const badgeWidth = 160;
  const badgeX = pageWidth - margin - badgeWidth;
  doc.setFillColor(...brandColor);
  doc.roundedRect(badgeX, 30, badgeWidth, 36, 3, 3, 'F');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(data.documentTitle, badgeX + badgeWidth / 2, 54, { align: 'center' });

  // Doc number and date (right side, below badge)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...medText);
  doc.text(`#${data.documentNumber}`, badgeX + badgeWidth, 80, { align: 'right' });
  doc.text(data.documentDate, badgeX + badgeWidth, 92, { align: 'right' });

  // Divider
  y += 10;
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // ── BILL TO / JOB SITE ──────────────────────────────────
  const colWidth = contentWidth / 2 - 10;

  // Bill To
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...brandColor);
  doc.text('BILL TO', margin, y);

  // Job Site
  doc.text('JOB SITE', margin + colWidth + 20, y);

  y += 14;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkText);
  doc.text(data.customerName, margin, y);
  doc.text(data.jobName, margin + colWidth + 20, y);

  y += 14;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...medText);

  if (data.customerCompany) {
    doc.text(data.customerCompany, margin, y);
    y += 12;
  }
  let leftY = y;
  if (data.customerAddress) {
    doc.text(data.customerAddress, margin, leftY);
    leftY += 12;
  }
  if (data.customerCityStateZip) {
    doc.text(data.customerCityStateZip, margin, leftY);
    leftY += 12;
  }
  if (data.customerPhone) {
    doc.text(data.customerPhone, margin, leftY);
    leftY += 12;
  }
  if (data.customerEmail) {
    doc.text(data.customerEmail, margin, leftY);
    leftY += 12;
  }

  // Job address on right column
  let rightY = y;
  if (data.jobAddress) {
    doc.text(data.jobAddress, margin + colWidth + 20, rightY);
    rightY += 12;
  }

  y = Math.max(leftY, rightY) + 20;

  // ── LINE ITEMS TABLE ─────────────────────────────────────
  checkPageBreak(80);

  // Table header
  const colDesc = margin;
  const colQty = margin + contentWidth * 0.50;
  const colUnit = margin + contentWidth * 0.60;
  const colPrice = margin + contentWidth * 0.73;
  const colTotal = margin + contentWidth * 0.87;

  doc.setFillColor(...lightBg);
  doc.rect(margin, y, contentWidth, 22, 'F');
  doc.setDrawColor(...borderColor);
  doc.rect(margin, y, contentWidth, 22, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...medText);
  doc.text('DESCRIPTION', colDesc + 8, y + 14);
  doc.text('QTY', colQty + 4, y + 14);
  doc.text('UNIT', colUnit + 4, y + 14);
  doc.text('PRICE', colPrice + 4, y + 14);
  doc.text('TOTAL', colTotal + 4, y + 14);

  y += 22;

  // Table rows
  doc.setFontSize(9);
  data.lineItems.forEach((item, idx) => {
    checkPageBreak(30);
    const rowH = 24;

    // Alternate row bg
    if (idx % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(252, 252, 253);
    }
    doc.rect(margin, y, contentWidth, rowH, 'F');
    doc.setDrawColor(...borderColor);
    doc.line(margin, y + rowH, pageWidth - margin, y + rowH);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkText);
    // Truncate long descriptions
    const maxDescWidth = colQty - colDesc - 16;
    const descText = doc.splitTextToSize(item.description, maxDescWidth);
    doc.text(descText[0] || '', colDesc + 8, y + 15);

    doc.setTextColor(...medText);
    doc.text(item.quantity, colQty + 4, y + 15);
    doc.text(item.unit, colUnit + 4, y + 15);

    doc.setTextColor(...darkText);
    doc.text(`$${item.unitPrice}`, colPrice + 4, y + 15);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${item.total}`, colTotal + 4, y + 15);

    y += rowH;
  });

  // ── TOTALS ───────────────────────────────────────────────
  y += 10;
  checkPageBreak(80);

  const totalsX = margin + contentWidth * 0.60;
  const totalsValueX = pageWidth - margin;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...medText);
  doc.text('Subtotal', totalsX, y + 14);
  doc.setTextColor(...darkText);
  doc.text(`$${data.subtotal}`, totalsValueX, y + 14, { align: 'right' });

  y += 20;
  doc.setTextColor(...medText);
  doc.text(data.taxLabel, totalsX, y + 14);
  doc.setTextColor(...darkText);
  doc.text(`$${data.taxAmount}`, totalsValueX, y + 14, { align: 'right' });

  y += 24;
  // Total highlight box
  doc.setFillColor(...brandColor);
  doc.roundedRect(totalsX - 8, y, pageWidth - margin - totalsX + 8, 30, 3, 3, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL', totalsX + 4, y + 20);
  doc.text(`$${data.total}`, totalsValueX - 8, y + 20, { align: 'right' });

  y += 50;

  // ── NOTES ────────────────────────────────────────────────
  if (data.notes) {
    checkPageBreak(60);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('NOTES', margin, y);
    y += 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...medText);
    const noteLines = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 12 + 10;
  }

  // ── TERMS & CONDITIONS ───────────────────────────────────
  if (data.termsAndConditions) {
    checkPageBreak(60);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('TERMS & CONDITIONS', margin, y);
    y += 12;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...medText);
    const termLines = doc.splitTextToSize(data.termsAndConditions, contentWidth);
    doc.text(termLines, margin, y);
    y += termLines.length * 10 + 16;
  }

  // ── THANK YOU ────────────────────────────────────────────
  if (data.thankYouMessage) {
    checkPageBreak(40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bolditalic');
    doc.setTextColor(...brandColor);
    doc.text(data.thankYouMessage, pageWidth / 2, y, { align: 'center' });
    y += 20;
  }

  // ── FOOTER BAR ───────────────────────────────────────────
  doc.setFillColor(...brandColor);
  doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(
    `${data.companyName}  •  ${data.companyPhone}  •  ${data.companyEmail}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  return doc;
};

// ============================================================
// Convenience: download PDF
// ============================================================
export const downloadPDF = (data: PDFDocumentData): void => {
  const doc = generatePDFFromData(data);
  const filename = `${data.documentTitle.replace(/\s+/g, '_')}_${data.documentNumber}.pdf`;
  doc.save(filename);
};

// ============================================================
// Generate PDF as Blob (for uploading to Supabase Storage)
// ============================================================
export const generatePDFBlob = (data: PDFDocumentData): Blob => {
  const doc = generatePDFFromData(data);
  return doc.output('blob');
};

export const getPDFFilename = (data: PDFDocumentData): string => {
  return `${data.documentTitle.replace(/\s+/g, '_')}_${data.documentNumber}.pdf`;
};

// ============================================================
// Load logo from URL into a data URL (for embedding in PDF)
// ============================================================
export const loadLogoAsDataUrl = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};
