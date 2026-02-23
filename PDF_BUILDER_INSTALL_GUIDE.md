# PDF Builder — Installation Guide for Another App

This guide explains how to port the PDF Builder feature (editable PDF preview modal + PDF generation service) into another React + TypeScript project.

---

## Files to Copy

Copy these files into your new project, preserving the folder structure:

```
services/pdfService.ts      — PDF generation engine (uses jsPDF)
components/PDFPreviewModal.tsx — React modal UI for editing & exporting PDFs
```

---

## Dependencies

Install the required npm packages:

```bash
npm install jspdf lucide-react
```

| Package | Purpose |
|---------|---------|
| `jspdf` | Generates the actual PDF document |
| `lucide-react` | Icons used in the modal UI (X, FileDown, Plus, Trash2, etc.) |

---

## Types Required

Both files import from a `../types` file. You need to define (or copy) these types in your project:

### Enums

```typescript
export enum JobStatus {
  ESTIMATE = 'Estimate',
  WORK_ORDER = 'Work Order',
  INVOICED = 'Invoiced',
  // add your own statuses as needed
}

export enum DocumentType {
  ESTIMATE = 'ESTIMATE',
  WORK_ORDER = 'WORK ORDER',
  INVOICE = 'INVOICE',
}
```

### Helper Functions

```typescript
// Maps a job status to a document type
export const statusToDocumentType = (status: JobStatus): DocumentType => {
  switch (status) {
    case JobStatus.INVOICED:
      return DocumentType.INVOICE;
    case JobStatus.WORK_ORDER:
      return DocumentType.WORK_ORDER;
    default:
      return DocumentType.ESTIMATE;
  }
};

// Formats a document number with a prefix (EST-001, WO-001, INV-001)
export const formatDocumentNumber = (baseNumber: string, docType: DocumentType): string => {
  const raw = baseNumber.replace(/^(EST|WO|INV)-?/i, '');
  const prefixMap: Record<DocumentType, string> = {
    [DocumentType.ESTIMATE]: 'EST',
    [DocumentType.WORK_ORDER]: 'WO',
    [DocumentType.INVOICE]: 'INV',
  };
  return `${prefixMap[docType]}-${raw}`;
};
```

### Interfaces

```typescript
export interface Customer {
  id: string;
  name: string;
  companyName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  // ...any other fields your app uses
}

export interface Estimate {
  id: string;
  number: string;
  date: string;
  status: JobStatus;
  jobName: string;
  jobAddress: string;
  items: {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
  // ...any other fields your app uses
}

export interface AppSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  logoUrl: string;
  taxRate: number;
  // ...any other fields your app uses
}
```

---

## Supabase Cloud Save (Optional)

The modal has a "Save PDF" button that uploads to Supabase Storage via `services/storage.ts` and its `savePDFToSupabase()` function.

**If you don't need cloud saving**, remove these from `PDFPreviewModal.tsx`:
- The import: `import { savePDFToSupabase } from '../services/storage';`
- The `handleSaveToSupabase` function and its related state (`isSaving`, `saveSuccess`)
- The "Save PDF" button in the modal footer

**If you want cloud saving**, also copy the `savePDFToSupabase` function from `services/storage.ts` and configure your Supabase client.

---

## CSS / Styling

The modal uses **Tailwind CSS** classes. Make sure your project has Tailwind configured. Key classes used:
- Layout: `fixed inset-0 z-50`, `flex`, `grid grid-cols-12`
- Colors: `bg-brand-600`, `text-brand-500`, `bg-slate-50`, etc.
- If you don't have a custom `brand` color in your Tailwind config, replace `brand-*` classes with `blue-*` (or your preferred color)

---

## How to Use in Your App

Import and render the modal wherever you need it:

```tsx
import PDFPreviewModal from './components/PDFPreviewModal';

// In your component:
const [showPDF, setShowPDF] = useState(false);

// Trigger it (e.g., from a button click):
<button onClick={() => setShowPDF(true)}>Generate PDF</button>

// Render the modal:
{showPDF && (
  <PDFPreviewModal
    estimate={yourEstimateObject}
    customer={yourCustomerObject}
    settings={yourAppSettings}
    initialDocumentType={DocumentType.ESTIMATE}  // optional override
    onClose={() => setShowPDF(false)}
    onSaved={() => console.log('PDF saved!')}    // optional callback
  />
)}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `estimate` | `Estimate` | Yes | The job/estimate data to build the PDF from |
| `customer` | `Customer \| undefined` | Yes | Customer info for the "Bill To" section |
| `settings` | `AppSettings` | Yes | Company info, logo URL, tax rate |
| `initialDocumentType` | `DocumentType` | No | Force a specific doc type (default: auto-detected from estimate status) |
| `onClose` | `() => void` | Yes | Called when modal is closed |
| `onSaved` | `() => void` | No | Called after successful cloud save |

---

## Feature Summary

The PDF Builder provides:
- **3 document types**: Estimate, Work Order, Invoice — switchable via tabs
- **Editable fields**: Company info, customer info, line items, notes, terms
- **Line item management**: Add, remove, edit rows with auto-calculated totals
- **Tax calculation**: Automatic based on configurable tax rate
- **Company logo**: Embedded from a URL (loaded as data URL)
- **Color-coded branding**: Blue for estimates, amber for work orders, green for invoices
- **Type-specific sections**: Validity/signature for estimates, work scope for work orders, payment terms for invoices
- **Export**: Download as PDF file locally
- **Cloud save**: Upload to Supabase Storage (optional)

---

## Quick Start Checklist

1. [ ] Copy `services/pdfService.ts` and `components/PDFPreviewModal.tsx`
2. [ ] Run `npm install jspdf lucide-react`
3. [ ] Add the required types (`DocumentType`, `Estimate`, `Customer`, `AppSettings`, etc.) to your types file
4. [ ] Ensure Tailwind CSS is configured (with `brand` color or replace with `blue`)
5. [ ] Remove or configure the Supabase save feature
6. [ ] Import `PDFPreviewModal` and pass the required props
7. [ ] Test it!
