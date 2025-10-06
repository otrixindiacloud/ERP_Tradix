import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, InvoiceItem, Item, Customer, Quotation, QuotationItem } from '../../shared/schema';

// Core reusable interfaces
export interface PdfGenerateResult {
  buffer: Buffer;
  byteLength: number;
  fileName: string;
  contentType: string; // always application/pdf for now
}

export interface InvoicePdfContext {
  invoice: Invoice;
  items: (InvoiceItem & { item?: Item })[];
  customer: Customer;
  related?: { salesOrder?: any; delivery?: any };
  mode?: 'enhanced' | 'simple';
}

export interface QuotationPdfContext {
  quotation: Quotation;
  items: (QuotationItem & { item?: Item })[];
  customer: Customer;
  mode?: 'enhanced' | 'simple';
}

// Currency formatting centralised
export function fmtCurrency(amount: number | string | null | undefined, currency = 'BHD') {
  const n = amount == null ? 0 : (typeof amount === 'string' ? parseFloat(amount) : amount);
  if (Number.isNaN(n)) return `${currency} 0.00`;
  return `${currency} ${n.toFixed(2)}`;
}

export function fmtDate(date: string | Date | null | undefined) {
  if (!date) return '';
  try { return new Date(date).toLocaleDateString('en-GB'); } catch { return ''; }
}

function baseDoc(): any { return new jsPDF(); }

// Convert number to words (simple, supports up to billions) for amount in words section
function numberToWords(num: number): string {
  if (!Number.isFinite(num)) return '';
  if (num === 0) return 'Zero';
  const belowTwenty = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','Ten','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function words(n: number): string {
    if (n < 20) return belowTwenty[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10?'-'+belowTwenty[n%10]:'');
    if (n < 1000) return belowTwenty[Math.floor(n/100)] + ' Hundred' + (n%100? ' ' + words(n%100):'');
    if (n < 1_000_000) return words(Math.floor(n/1000)) + ' Thousand' + (n%1000? ' ' + words(n%1000):'');
    if (n < 1_000_000_000) return words(Math.floor(n/1_000_000)) + ' Million' + (n%1_000_000? ' ' + words(n%1_000_000):'');
    return words(Math.floor(n/1_000_000_000)) + ' Billion' + (n%1_000_000_000? ' ' + words(n%1_000_000_000):'');
  }
  return words(Math.floor(num));
}

function amountInWords(total: number, currency: string) {
  const integerPart = Math.floor(total);
  const fractional = Math.round((total - integerPart) * 100);
  const words = numberToWords(integerPart) || 'Zero';
  return `${currency} ${words} ${fractional > 0 ? fractional + '/100' : ''}`.trim();
}

// Enhanced invoice PDF - Clean Tax Invoice format matching professional UI design
export function buildEnhancedInvoicePdf(ctx: InvoicePdfContext): Buffer {
  const { invoice, items, customer } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Page numbering and copy type (top)
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Page No. 1 of 1', 15, 15);
  doc.text('Original Copy', pageWidth - 15, 15, { align: 'right' });

  // Main header - TAX INVOICE
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', pageWidth / 2, 35, { align: 'center' });

  // Company details section
  const companyY = 45;
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text('GOLDEN STYLE W.L.L', pageWidth / 2, companyY, { align: 'center' });
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.text('Building 728, Road 2012, Town 2564, Bahrain', pageWidth / 2, companyY + 6, { align: 'center' });
  doc.text('Mobile: +973 12345678 | Email: info@goldenstyle.com', pageWidth / 2, companyY + 12, { align: 'center' });
  doc.text('VAT Reg No: 100004744700962', pageWidth / 2, companyY + 18, { align: 'center' });

  // Invoice details section
  const invoiceDetailsY = companyY + 35;
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.text('Invoice Number:', 15, invoiceDetailsY);
  doc.text(`INV-${invoice.invoiceNumber}`, 70, invoiceDetailsY);
  doc.text('Invoice Date:', 15, invoiceDetailsY + 6);
  doc.text(fmtDate((invoice as any).invoiceDate || invoice.createdAt), 70, invoiceDetailsY + 6);
  doc.text('Due Date:', 15, invoiceDetailsY + 12);
  doc.text(fmtDate((invoice as any).dueDate), 70, invoiceDetailsY + 12);
  doc.text('Place of Supply:', 15, invoiceDetailsY + 18);
  doc.text('Bahrain', 70, invoiceDetailsY + 18);
  doc.text('Reverse Charge:', 15, invoiceDetailsY + 24);
  doc.text('No', 70, invoiceDetailsY + 24);
  
  // Billing and Shipping Details section
  const billingY = invoiceDetailsY + 35;
  
  // Billing Details (left column)
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text('Billing Details', 15, billingY);
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  const customerName = (customer as any).customerName || customer.name || 'Customer';
  doc.text(customerName, 15, billingY + 8);
  
  // Split long text to prevent cutoff
  const billingInfo = `GSTIN: ${customer.taxId || 'N/A'} | Mobile: ${customer.phone || 'N/A'}`;
  const emailInfo = `Email: ${customer.email || 'N/A'}`;
  doc.text(billingInfo, 15, billingY + 14);
  doc.text(emailInfo, 15, billingY + 20);
  doc.text(customer.address || 'Address not provided', 15, billingY + 26);
  
  // Shipping Details (right column)
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text('Shipping Details', pageWidth / 2 + 15, billingY);
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.text(customerName, pageWidth / 2 + 15, billingY + 8);
  doc.text(billingInfo, pageWidth / 2 + 15, billingY + 14);
  doc.text(emailInfo, pageWidth / 2 + 15, billingY + 20);
  doc.text(customer.address || 'Address not provided', pageWidth / 2 + 15, billingY + 26);

  // Items table with clean design
  const tableStartY = billingY + 35;
  const currency = (invoice as any).currency || 'BHD';
  
  const rows = items.map((it, i) => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.unitPrice) || 0;
    const discountRate = Number(it.discountPercentage) || 0;
    const discountAmount = (rate * qty * discountRate) / 100;
    const netAmount = (rate * qty) - discountAmount;
    const vatRate = Number(it.taxRate) || 10; // Default 10% VAT
    const vatAmount = (netAmount * vatRate) / 100;
    const lineTotal = netAmount + vatAmount;
    
    return [
      (i + 1).toString(),
      it.description || 'Item Description',
      (it as any).hsnCode || 'N/A',
      qty.toFixed(2),
      'Pcs',
      rate.toFixed(2),
      discountRate > 0 ? `${discountRate.toFixed(2)}%` : '0.00%',
      `${vatRate}%`,
      lineTotal.toFixed(2)
    ];
  });

  // Add discount row if there's a discount
  const totalDiscount = items.reduce((sum, it) => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.unitPrice) || 0;
    const discountRate = Number(it.discountPercentage) || 0;
    return sum + (rate * qty * discountRate) / 100;
  }, 0);

  if (totalDiscount > 0) {
    rows.push(['', '', '', '', '', '', 'Discount', '', `-${totalDiscount.toFixed(2)}`]);
  }

  // Add total row
  const grandTotal = items.reduce((sum, it) => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.unitPrice) || 0;
    const discountRate = Number(it.discountPercentage) || 0;
    const discountAmount = (rate * qty * discountRate) / 100;
    const netAmount = (rate * qty) - discountAmount;
    const vatRate = Number(it.taxRate) || 10;
    const vatAmount = (netAmount * vatRate) / 100;
    return sum + netAmount + vatAmount;
  }, 0) - totalDiscount;

  rows.push(['', '', '', '', '', '', 'Total', '', grandTotal.toFixed(2)]);

  autoTable(doc, {
    startY: tableStartY,
    head: [['Sr.', 'Item Description', 'HSN/SAC', 'Qty', 'Unit', 'List Price', 'Disc.', 'Tax %', 'Amount (₹)']],
    body: rows,
    styles: { 
      fontSize: 8, 
      cellPadding: 6, 
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      valign: 'middle',
      overflow: 'linebreak',
      cellWidth: 15,
      textColor: [0, 0, 0]
    },
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
      cellPadding: 5,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },  // Sr.
      1: { cellWidth: 50, halign: 'left' }, // Item Description
      2: { cellWidth: 18, halign: 'center' }, // HSN/SAC
      3: { cellWidth: 12, halign: 'center' }, // Qty
      4: { cellWidth: 10, halign: 'center' }, // Unit
      5: { cellWidth: 18, halign: 'right' }, // List Price
      6: { cellWidth: 12, halign: 'center' }, // Disc.
      7: { cellWidth: 12, halign: 'center' }, // Tax %
      8: { cellWidth: 18, halign: 'right' }  // Amount
    },
    margin: { left: 10, right: 10 },
    pageBreak: 'auto',
    tableWidth: 'wrap',
    showHead: 'everyPage'
  });

  const afterItemsTable = (doc as any).lastAutoTable?.finalY || tableStartY + 40;

  // Amount calculations
  const subtotal = Number((invoice as any).subtotal) || items.reduce((sum, it) => sum + ((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)), 0);
  const discountPerc = Number((invoice as any).discountPercentage) || 0;
  const discountAmount = Number((invoice as any).discountAmount) || (subtotal * discountPerc / 100);
  const taxRate = Number((invoice as any).taxRate) || 10;
  const taxAmount = Number((invoice as any).taxAmount) || ((subtotal - discountAmount) * taxRate / 100);
  const total = Number((invoice as any).totalAmount) || (subtotal - discountAmount + taxAmount);
  const paidAmount = Number((invoice as any).paidAmount) || 0;
  const outstandingAmount = Number((invoice as any).outstandingAmount) || (total - paidAmount);

  // Summary sections - Two column layout
  const summaryY = afterItemsTable + 10;
  
  // Left side - Total in words
  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.text('Total in Words:', 15, summaryY);
  doc.setFont('helvetica', 'normal');
  const amountWords = `Rs. ${amountInWords(total, currency)}`;
  const splitAmountWords = doc.splitTextToSize(amountWords, (pageWidth / 2) - 20);
  doc.text(splitAmountWords, 15, summaryY + 6);
  
  // Right side - Terms and Conditions (requested instead of Settlement/Bank details)
  doc.setFont('helvetica', 'bold').setFontSize(9);
  doc.text('Terms and Conditions', pageWidth / 2 + 15, summaryY);
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.text('E & O.E', pageWidth / 2 + 15, summaryY + 6);
  const termsRight = [
    '1. Goods once sold will not be taken back.',
    '2. Interest @ 18% p.a. will be charged if payment is delayed.',
    "3. Subject to 'Bahrain' jurisdiction only."
  ];
  termsRight.forEach((t, i) => {
    const split = doc.splitTextToSize(t, (pageWidth / 2) - 25);
    doc.text(split, pageWidth / 2 + 15, summaryY + 12 + (i * 6));
  });
  
  // Tax breakdown - full width below the two columns
  const taxY = summaryY + 20;
  const saleAmount = subtotal - discountAmount;
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;
  const taxBreakdown1 = `Sale @${taxRate}% = ${saleAmount.toFixed(2)}, CGST = ${cgst.toFixed(2)}, SGST = ${sgst.toFixed(2)}`;
  const taxBreakdown2 = `Total Sale = ${saleAmount.toFixed(2)}, Tax = ${taxAmount.toFixed(2)}, Cess = 0.00, Add. Cess = 0.00`;
  
  const splitTax1 = doc.splitTextToSize(taxBreakdown1, pageWidth - 30);
  const splitTax2 = doc.splitTextToSize(taxBreakdown2, pageWidth - 30);
  doc.text(splitTax1, 15, taxY);
  doc.text(splitTax2, 15, taxY + 6);

  // Footer sections removed as Terms & Conditions now shown to the right of Total in Words

  return Buffer.from(doc.output('arraybuffer'));
}

export function buildSimpleInvoicePdf(ctx: InvoicePdfContext): Buffer {
  const { invoice } = ctx;
  const doc = baseDoc();
  doc.setFontSize(16).setFont('helvetica','bold').text('INVOICE',20,20);
  doc.setFontSize(10).setFont('helvetica','normal').text(`Invoice #: ${invoice.invoiceNumber}`,20,30);
  return Buffer.from(doc.output('arraybuffer'));
}

export function generateInvoicePdf(ctx: InvoicePdfContext): PdfGenerateResult {
  const buffer = (ctx.mode === 'simple' ? buildSimpleInvoicePdf(ctx) : buildEnhancedInvoicePdf(ctx));
  return { buffer, byteLength: buffer.length, fileName: `invoice-${ctx.invoice.invoiceNumber}.pdf`, contentType: 'application/pdf' };
}

export function generateQuotationPdf(ctx: QuotationPdfContext): PdfGenerateResult {
  if (ctx.mode === 'simple') {
    const { quotation, items, customer } = ctx;
    const doc = baseDoc();
    doc.setFontSize(18).setFont('helvetica','bold').text('QUOTATION',20,20);
    doc.setFontSize(10).setFont('helvetica','normal');
    doc.text(`Quote #: ${(quotation as any).quotationNumber || quotation.quoteNumber}`,20,30);
    doc.text(`Date: ${fmtDate((quotation as any).quotationDate || (quotation as any).quoteDate || quotation.createdAt)}`,20,36);
    doc.setFont('helvetica','bold').text('Customer:',20,48);
    doc.setFont('helvetica','normal').text((customer as any).customerName || customer.name || '',20,54);
    const rows = items.map((it,i)=>[
      (i+1).toString(),
      it.description || '',
      it.quantity.toString(),
      fmtCurrency(it.unitPrice, (quotation as any).currency || 'BHD'),
      fmtCurrency(it.lineTotal, (quotation as any).currency || 'BHD')
    ]);
    autoTable(doc, { startY: 70, head: [['#','Description','Qty','Unit','Total']], body: rows, styles:{fontSize:8}, headStyles:{fillColor:[255,255,255], textColor:0}});
    const buffer = Buffer.from(doc.output('arraybuffer'));
    return { buffer, byteLength: buffer.length, fileName: `quotation-${(quotation as any).quotationNumber || quotation.quoteNumber}.pdf`, contentType: 'application/pdf' };
  }

  // Enhanced template replicating provided layout image
  const { quotation, items, customer } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(16).setFont('helvetica','bold').text('QUOTATION', pageWidth/2, 15, { align: 'center' });
  doc.setFontSize(8).setFont('helvetica','normal');

  // Meta table (Quotation No, Date, Customer Code, Sales Person, Payment Terms, Quote Validity / Lead Time placeholders)
  const customerCode = (customer as any).customerCode || (customer as any).code || '';
  const salesPerson = (quotation as any).salesPerson || (quotation as any).createdBy || '';
  const paymentTerms = (quotation as any).terms ? ((quotation as any).terms.split('\n')[0].slice(0,40)) : '30 Days';
  const leadTime = (quotation as any).leadTime || '10 days after receiving agreed LPO';
  const qDate = fmtDate((quotation as any).quoteDate || quotation.createdAt);
  const validUntil = fmtDate((quotation as any).validUntil);
  autoTable(doc, {
    startY: 22,
    head: [[ 'Quotation No', 'Quotation Date', 'Customer Code', 'Sales Person', 'Payment Terms', 'Lead Time / Validity' ]],
    body: [[
      (quotation as any).quotationNumber || quotation.quoteNumber,
      qDate,
      customerCode,
      String(salesPerson).slice(0,12),
      paymentTerms,
      validUntil || leadTime
    ]],
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [255,255,255], textColor:0, fontStyle:'bold' },
    margin: { left: 15, right: 15 }
  });

  const afterMeta = (doc as any).lastAutoTable.finalY + 3;
  // Customer Address & Contact table (two columns) – placeholders for contact person
  const addressLines = [
    (customer as any).customerName || customer.name || '',
    customer.address || '',
    customer.email || '',
    (customer as any).phone || customer.phone || ''
  ].filter(Boolean);
  const addressText = addressLines.length ? addressLines.join('\n') : 'No Address';
  const contactPerson = (quotation as any).contactPerson || (customer as any).contactPerson || '---';
  const contactLines = [ contactPerson, (customer as any).contactEmail || customer.email || '', (customer as any).contactPhone || customer.phone || '' ].filter(Boolean).join('\n');
  autoTable(doc, {
    startY: afterMeta,
    body: [
      [ { content: 'Customer Name & Address:\n' + addressText, styles: { halign:'left' } }, { content: 'Customer Contact Person:\n' + contactLines, styles:{ halign:'left'} } ]
    ],
    styles: { fontSize: 7, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: (pageWidth-30)/2 }, 1: { cellWidth: (pageWidth-30)/2 } },
    theme: 'grid',
    margin: { left: 15, right: 15 }
  });

  const afterAddress = (doc as any).lastAutoTable.finalY + 5;
  // Enhanced Items table with comprehensive columns for professional quotation
  const currency = (quotation as any).currency || 'BHD';
  const itemRows = items.map((it,i)=> {
    const qty = Number(it.quantity)||0;
    const unit = Number(it.unitPrice)||0;
    const discPerc = Number((quotation as any).discountPercentage)||0; // per-item discount not stored; using header discount
    const gross = qty*unit;
    const discAmt = gross * discPerc/100;
    const net = gross - discAmt;
    const vatPerc = Number((quotation as any).taxRate) || 0; // may not exist; fallback 0
    const vatAmt = net * vatPerc/100;
    const lineTotal = net + vatAmt;
    
    // Enhanced description with specifications
    let enhancedDesc = it.description || 'Product Description';
    if ((it as any).supplierCode) enhancedDesc += `\nCode: ${(it as any).supplierCode}`;
    if ((it as any).barcode) enhancedDesc += `\nBarcode: ${(it as any).barcode}`;
    if ((it as any).item?.category) enhancedDesc += `\nCategory: ${(it as any).item.category}`;
    if ((it as any).specifications) enhancedDesc += `\nSpecs: ${(it as any).specifications}`;
    
    return [
      (i+1).toString(),
      enhancedDesc,
      `${qty} PCS`,
      `${currency} ${unit.toFixed(3)}`,
      discPerc?`${discPerc.toFixed(1)}%`:'0%',
      `${currency} ${discAmt.toFixed(2)}`,
      `${currency} ${net.toFixed(2)}`,
      vatPerc?`${vatPerc.toFixed(1)}%`:'0%',
      `${currency} ${vatAmt.toFixed(2)}`
    ];
  });
  
  autoTable(doc, {
    startY: afterAddress,
    head: [[ 'S.I.', 'Item Description & Specifications', 'Qty', 'Unit Rate', 'Disc. %', 'Disc. Amt', 'Net Total', 'VAT %', 'VAT Amt' ]],
    body: itemRows,
    styles: { 
      fontSize: 7, 
      cellPadding: 4, 
      valign:'middle',
      lineColor: [0, 0, 0], // Black borders
      lineWidth: 0.1,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [0, 0, 0] // Black text
    },
    headStyles: { 
      fillColor: [255, 255, 255], // White header background
      textColor: [0, 0, 0], // Black text
      fontStyle:'bold',
      halign: 'center',
      fontSize: 8,
      cellPadding: 4,
      lineColor: [0, 0, 0], // Black borders
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 8, halign:'center' }, // S.I.
      1: { cellWidth: 45, halign: 'left' }, // Item Description & Specifications
      2: { cellWidth: 12, halign:'center' }, // Qty
      3: { cellWidth: 15, halign:'right' }, // Unit Rate
      4: { cellWidth: 10, halign:'center' }, // Disc. %
      5: { cellWidth: 12, halign:'right' }, // Disc. Amt
      6: { cellWidth: 18, halign:'right' }, // Net Total
      7: { cellWidth: 10, halign:'center' }, // VAT %
      8: { cellWidth: 15, halign:'right' }  // VAT Amt
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250] // Light gray alternating rows
    },
    margin: { left: 20, right: 20 },
    pageBreak: 'auto',
    tableWidth: 'wrap',
    showHead: 'everyPage'
  });

  const afterItems = (doc as any).lastAutoTable.finalY + 4;
  // Summary tables (align right) – Total, Discount, Net, VAT, Grand Total
  const subtotal = Number((quotation as any).subtotal)|| itemRows.reduce((s,r)=> s + Number(r[7]),0);
  const discountAmount = Number((quotation as any).discountAmount)||0;
  const taxAmount = Number((quotation as any).taxAmount)||0;
  const totalAmount = Number((quotation as any).totalAmount)|| (subtotal - discountAmount + taxAmount);
  autoTable(doc, {
    startY: afterItems,
    theme: 'plain',
    body: [
      ['Total Amount', subtotal.toFixed(2)],
      ['Discount Amount', discountAmount.toFixed(2)],
      ['VAT Amount', taxAmount.toFixed(2)],
      ['Grand Total', totalAmount.toFixed(2)]
    ],
    styles: { fontSize:7, cellPadding:2 },
    columnStyles: { 0: { halign:'right', cellWidth: 40, fontStyle:'bold' }, 1: { halign:'right', cellWidth: 25, fontStyle:'bold' } },
    margin: { left: pageWidth - 15 - 65, right: 15 }
  });

  const afterSummary = (doc as any).lastAutoTable.finalY + 6;
  // Amount in words
  doc.setFont('helvetica','bold').setFontSize(7).text(`${currency} In Words:`, 15, afterSummary);
  doc.setFont('helvetica','normal');
  doc.text(amountInWords(totalAmount, currency) + ' ONLY', 15, afterSummary + 4);

  // Remarks / Notes box
  const remarks = (quotation as any).notes || (quotation as any).terms || '';
  const remarksLines = doc.splitTextToSize('Remarks:\n' + (remarks || '---'), pageWidth - 30);
  autoTable(doc, {
    startY: afterSummary + 8,
    body: [[ { content: remarksLines.join('\n'), styles: { fontSize:7, halign:'left' } }]],
    styles: { cellPadding: 3 },
    margin: { left: 15, right: 15 },
    theme: 'grid'
  });

  const afterRemarks = (doc as any).lastAutoTable.finalY + 6;
  // Terms line (validity) & signatures
  const validity = validUntil ? `This quote is valid until ${validUntil}` : 'This quote is valid for 15 days';
  doc.setFont('helvetica','normal').setFontSize(7).text(validity, 15, afterRemarks);
  const sigY = afterRemarks + 14;
  doc.setFont('helvetica','normal').text('_________________________', 15, sigY);
  doc.text('_________________________', pageWidth/2 + 20, sigY);
  doc.setFont('helvetica','bold').setFontSize(7).text('Authorized Signatory', 15, sigY + 5);
  doc.text('Customer Signature Date & Stamp', pageWidth/2 + 20, sigY + 5);

  const buffer = Buffer.from(doc.output('arraybuffer'));
  return { buffer, byteLength: buffer.length, fileName: `quotation-${(quotation as any).quotationNumber || quotation.quoteNumber}.pdf`, contentType: 'application/pdf' };
}

// Purchase Invoice PDF Context
export interface PurchaseInvoicePdfContext {
  invoice: any; // PurchaseInvoice type
  items: any[]; // PurchaseInvoiceItem type
  supplier: any; // Supplier type
  mode?: 'enhanced' | 'simple';
}

// Purchase Invoice PDF Generation
export function buildEnhancedPurchaseInvoicePdf(ctx: PurchaseInvoicePdfContext): Buffer {
  const { invoice, items, supplier } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Professional header - black and white
  doc.setFillColor(255, 255, 255); // White background
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  // Main header - Purchase Invoice
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('PURCHASE INVOICE', pageWidth / 2, 22, { align: 'center' });
  
  // Add a line below header
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.line(0, 35, pageWidth, 35);
  
  // Top right corner - Invoice details (black text)
  const invoiceDetailsY = 45;
  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Invoice No :', pageWidth - 80, invoiceDetailsY);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoiceNumber || 'N/A', pageWidth - 50, invoiceDetailsY);
  doc.setFont('helvetica', 'bold');
  doc.text('Date :', pageWidth - 80, invoiceDetailsY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(fmtDate(invoice.invoiceDate || invoice.createdAt), pageWidth - 50, invoiceDetailsY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text('Due Date :', pageWidth - 80, invoiceDetailsY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(fmtDate(invoice.dueDate), pageWidth - 50, invoiceDetailsY + 10);

  // Company details (top left) - black text
  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Company: GOLDEN STYLE W.L.L', 20, invoiceDetailsY);
  doc.setFont('helvetica', 'normal');
  doc.text('VAT Reg No: 100004744700962', 20, invoiceDetailsY + 5);
  doc.text('Building 728, Road 2012, Town 2564, Bahrain', 20, invoiceDetailsY + 10);
  
  // Core invoice meta table
  const companyTableY = 65;
  const coreHead = [['Invoice Type','Status','Purchase Order','Goods Receipt','Payment Terms','Currency','Payment Method']];
  const coreBody = [[
    'Purchase Invoice',
    invoice.status || 'Draft',
    invoice.purchaseOrderNumber || 'N/A',
    invoice.goodsReceiptNumber || 'N/A',
    invoice.paymentTerms || '30 Days',
    invoice.currency || 'BHD',
    invoice.paymentMethod || 'Bank Transfer'
  ]];
  autoTable(doc, {
    startY: companyTableY,
    head: coreHead,
    body: coreBody,
    styles: { 
      fontSize: 7, 
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    headStyles: { 
      fillColor: [255, 255, 255], // White header
      textColor: [0, 0, 0], // Black text
      fontStyle: 'bold',
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255] // White alternating rows
    },
    margin: { left: 12, right: 12 },
    didParseCell: (data:any) => { if (data.section==='head') data.cell.styles.halign='center'; }
  });

  // Supplier information section
  const afterCompanyTable = (doc as any).lastAutoTable?.finalY + 10 || companyTableY + 25;
  
  // Supplier Name and Bill To headers with professional styling
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0); // Black text
  doc.text('Supplier Name :', 20, afterCompanyTable);
  doc.text('Bill To :', pageWidth / 2 + 20, afterCompanyTable);
  
  // Add underline for headers
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.line(20, afterCompanyTable + 2, 20 + 100, afterCompanyTable + 2);
  doc.line(pageWidth / 2 + 20, afterCompanyTable + 2, pageWidth / 2 + 20 + 50, afterCompanyTable + 2);
  
  // Supplier details
  doc.setFont('helvetica', 'bold').setFontSize(9);
  doc.setTextColor(0, 0, 0);
  const supplierName = supplier?.name || supplier?.supplierName || invoice.supplierName || 'Supplier';
  doc.text(supplierName.toUpperCase(), 20, afterCompanyTable + 8);
  
  // Supplier address and details (left side)
  const supplierDetailsY = afterCompanyTable + 15;
  const supplierLines = [
    supplier?.address || 'Supplier Address',
    supplier?.email || invoice.supplierEmail || 'supplier@email.com',
    supplier?.phone || invoice.supplierPhone || 'Phone: N/A',
    supplier?.taxId ? `Tax ID: ${supplier.taxId}` : 'Tax ID: N/A'
  ];
  
  doc.setFont('helvetica', 'normal').setFontSize(8);
  doc.setTextColor(0, 0, 0);
  supplierLines.forEach((line, idx) => {
    doc.text(line, 20, supplierDetailsY + idx * 5);
  });

  // Bill to address (right side) - Company details
  const billToLines = [
    'GOLDEN STYLE W.L.L',
    'Building 728, Road 2012, Town 2564',
    'Bahrain',
    'VAT Reg: 100004744700962'
  ];
  
  doc.setFont('helvetica', 'bold').setFontSize(8);
  doc.setTextColor(0, 0, 0);
  billToLines.forEach((line, idx) => {
    doc.text(line, pageWidth / 2 + 20, supplierDetailsY + idx * 5);
  });

  // Add a section header for items
  const itemsHeaderY = supplierDetailsY + 24;
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('ITEMS & SERVICES', 20, itemsHeaderY);
  
  // Add underline for items header
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.line(20, itemsHeaderY + 2, 20 + 120, itemsHeaderY + 2);

  // Enhanced Items table
  const tableStartY = itemsHeaderY + 6;
  const currency = invoice.currency || 'BHD';
  
  const rows = items.map((it, i) => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.unitPrice) || 0;
    const discountRate = Number(it.discountRate) || 0;
    const discountAmount = Number(it.discountAmount) || (rate * qty * discountRate) / 100;
    const netAmount = (rate * qty) - discountAmount;
    const vatRate = Number(it.taxRate) || 0;
    const vatAmount = Number(it.taxAmount) || (netAmount * vatRate) / 100;
    const lineTotal = Number(it.totalPrice) || (netAmount + vatAmount);
    
    // Enhanced description with item details
    let enhancedDesc = it.itemDescription || it.description || 'Item Description';
    if (it.supplierCode) enhancedDesc += `\nSupplier Code: ${it.supplierCode}`;
    if (it.barcode) enhancedDesc += `\nBarcode: ${it.barcode}`;
    if (it.notes) enhancedDesc += `\nNotes: ${it.notes}`;
    
    return [
      (i + 1).toString(),
      enhancedDesc,
      `${qty} ${it.unitOfMeasure || 'PCS'}`,
      `${currency} ${rate.toFixed(3)}`,
      discountRate > 0 ? `${discountRate.toFixed(1)}%` : '0%',
      `${currency} ${discountAmount.toFixed(2)}`,
      `${currency} ${netAmount.toFixed(2)}`,
      `${vatRate}%`,
      `${currency} ${vatAmount.toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [['S.I.', 'Description & Item Details', 'Qty', 'Unit Rate', 'Disc. %', 'Disc. Amt', 'Net Amount', 'VAT %', 'VAT Amt']],
    body: rows,
    styles: { 
      fontSize: 5, 
      cellPadding: 1, 
      lineColor: [0, 0, 0], // Black borders
      lineWidth: 0.1,
      valign: 'middle',
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [0, 0, 0] // Black text
    },
    headStyles: { 
      fillColor: [255, 255, 255], // White header background
      textColor: [0, 0, 0], // Black text
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 6,
      cellPadding: 1,
      lineColor: [0, 0, 0], // Black borders
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 6, halign: 'center' }, // S.I.
      1: { cellWidth: 40, halign: 'left' }, // Description & Item Details
      2: { cellWidth: 9, halign: 'center' }, // Qty
      3: { cellWidth: 12, halign: 'right' }, // Unit Rate
      4: { cellWidth: 8, halign: 'center' }, // Disc. %
      5: { cellWidth: 10, halign: 'right' }, // Disc. Amt
      6: { cellWidth: 15, halign: 'right' }, // Net Amount
      7: { cellWidth: 8, halign: 'center' }, // VAT %
      8: { cellWidth: 12, halign: 'right' }  // VAT Amt
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255] // White alternating rows
    },
    margin: { left: 12, right: 12 },
    // Keep the entire table on a single page
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    tableWidth: 'wrap',
    showHead: 'firstPage'
  });

  const afterItemsTable = (doc as any).lastAutoTable?.finalY || tableStartY + 40;

  // Amount calculations
  const subtotal = Number(invoice.subtotal) || 0;
  const discountAmount = Number(invoice.discountAmount) || 0;
  const taxAmount = Number(invoice.taxAmount) || 0;
  const total = Number(invoice.totalAmount) || 0;
  const paidAmount = Number(invoice.paidAmount) || 0;
  const remainingAmount = Number(invoice.remainingAmount) || (total - paidAmount);

  // Keep summary on same page; compress spacing
  let finStartY = afterItemsTable + 4;
  autoTable(doc, {
    startY: finStartY,
    head: [[`${currency} Summary`, 'Amount']],
    body: [
      ['Subtotal', `${currency} ${subtotal.toFixed(2)}`],
      ['Discount', `${currency} ${discountAmount.toFixed(2)}`],
      ['Tax Amount', `${currency} ${taxAmount.toFixed(2)}`],
      ['Total', `${currency} ${total.toFixed(2)}`],
      ['Paid', `${currency} ${paidAmount.toFixed(2)}`],
      ['Remaining', `${currency} ${remainingAmount.toFixed(2)}`]
    ],
    styles: { 
      fontSize: 7, 
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    headStyles: { 
      fillColor: [255, 255, 255], // White header
      textColor: [0, 0, 0], // Black text
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: { 
      0: { cellWidth: 70, halign: 'left', fontStyle: 'bold' }, 
      1: { cellWidth: 36, halign: 'right', fontStyle: 'bold' } 
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255] // White alternating rows
    },
    margin: { left: pageWidth - 118, right: 12 }
  });

  let summaryY = (doc as any).lastAutoTable?.finalY + 4;

  // Summary box styling
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  
  // Summary labels and amounts
  const summaryItems = [
    ['Amount Chargeable (in words):', ''],
    [amountInWords(total, currency), ''],
    ['Subtotal:', subtotal.toFixed(2)],
    ['Discount:', discountAmount.toFixed(2)],
    ['Tax:', taxAmount.toFixed(2)],
    ['Total*:', total.toFixed(2)],
    ['Paid:', paidAmount.toFixed(2)],
    ['Remaining:', remainingAmount.toFixed(2)]
  ];

  let currentY = summaryY;
  summaryItems.forEach(([label, amount], idx) => {
    if (idx < 2) {
      // Amount in words section
      doc.setFont('helvetica', 'bold').setFontSize(7);
      doc.text(label, 20, currentY);
      if (amount) {
        doc.setFont('helvetica', 'normal');
        doc.text(amount, 20, currentY + 5);
      }
      currentY += (idx === 0) ? 4 : 8;
    } else {
      // Financial amounts
      doc.setFont('helvetica', 'normal').setFontSize(7);
      doc.text(label, pageWidth - 80, currentY);
      doc.setFont('helvetica', 'bold');
      doc.text(`${currency} ${amount}`, pageWidth - 25, currentY, { align: 'right' });
      if (label.includes('Total*')) {
        doc.line(pageWidth - 80, currentY + 1, pageWidth - 20, currentY + 1);
      }
      currentY += 5;
    }
  });

  // Footer/meta positioning respecting page bottom
  const footerTop = Math.min(pageHeight - 22, currentY + 8);
  doc.setFontSize(7).setTextColor(0, 0, 0);
  doc.text('Generated by GT ERP System', 20, footerTop);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth - 20, footerTop, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
}

export function buildSimplePurchaseInvoicePdf(ctx: PurchaseInvoicePdfContext): Buffer {
  const { invoice } = ctx;
  const doc = baseDoc();
  doc.setFontSize(16).setFont('helvetica','bold').text('PURCHASE INVOICE',20,20);
  doc.setFontSize(10).setFont('helvetica','normal').text(`Invoice #: ${invoice.invoiceNumber}`,20,30);
  doc.text(`Supplier: ${invoice.supplierName}`,20,36);
  doc.text(`Total: ${invoice.currency} ${Number(invoice.totalAmount || 0).toFixed(2)}`,20,42);
  return Buffer.from(doc.output('arraybuffer'));
}

export function generatePurchaseInvoicePdf(ctx: PurchaseInvoicePdfContext): PdfGenerateResult {
  const buffer = (ctx.mode === 'simple' ? buildSimplePurchaseInvoicePdf(ctx) : buildEnhancedPurchaseInvoicePdf(ctx));
  return { 
    buffer, 
    byteLength: buffer.length, 
    fileName: `purchase-invoice-${ctx.invoice.invoiceNumber}.pdf`, 
    contentType: 'application/pdf' 
  };
}

export type { InvoicePdfContext as InvoicePdfOptions, QuotationPdfContext as QuotationPdfOptions, PurchaseInvoicePdfContext as PurchaseInvoicePdfOptions };
