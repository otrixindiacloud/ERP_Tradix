# EmailJS Templates Setup Guide

This guide explains how to set up EmailJS templates for automated email sending in your ERP system.

## EmailJS Configuration

The system is configured with the following EmailJS credentials:
- **Public Key**: `Py17HAlLnrbB4HGhw`
- **Service ID**: `service_b7vwpdh`
- **Template ID**: `template_3i2972k` (default)
- **Contact Email**: `dheerajprajapat561@gmail.com`

## Required EmailJS Templates

You need to create the following templates in your EmailJS dashboard:

### 1. Invoice Template (`template_invoice`)
**Subject**: `Invoice - Golden Tag WLL - {{document_number}}`

**Body**:
```
Dear {{to_name}},

Please find attached your Invoice #{{document_number}}.

{{message}}

If you have any questions, please don't hesitate to contact us.

Best regards,
{{from_name}} Team

---
Golden Tag WLL
Email: {{reply_to}}
```

### 2. Proforma Invoice Template (`template_proforma_invoice`)
**Subject**: `Proforma Invoice - Golden Tag WLL - {{document_number}}`

**Body**:
```
Dear {{to_name}},

Please find attached your Proforma Invoice #{{document_number}}.

{{message}}

If you have any questions, please don't hesitate to contact us.

Best regards,
{{from_name}} Team

---
Golden Tag WLL
Email: {{reply_to}}
```

### 3. Quotation Template (`template_quotation`)
**Subject**: `Quotation - Golden Tag WLL - {{document_number}}`

**Body**:
```
Dear {{to_name}},

Please find attached your Quotation #{{document_number}}.

{{message}}

If you have any questions, please don't hesitate to contact us.

Best regards,
{{from_name}} Team

---
Golden Tag WLL
Email: {{reply_to}}
```

### 4. Goods Receipt Template (`template_goods_receipt`)
**Subject**: `Goods Receipt - Golden Tag WLL - {{document_number}}`

**Body**:
```
Dear {{to_name}},

Please find attached your Goods Receipt #{{document_number}}.

{{message}}

If you have any questions, please don't hesitate to contact us.

Best regards,
{{from_name}} Team

---
Golden Tag WLL
Email: {{reply_to}}
```

### 5. Sales Order Template (`template_sales_order`)
**Subject**: `Sales Order - Golden Tag WLL - {{document_number}}`

**Body**:
```
Dear {{to_name}},

Please find attached your Sales Order #{{document_number}}.

{{message}}

If you have any questions, please don't hesitate to contact us.

Best regards,
{{from_name}} Team

---
Golden Tag WLL
Email: {{reply_to}}
```

## Template Variables

Each template uses the following variables:
- `{{to_email}}` - Recipient's email address
- `{{to_name}}` - Recipient's name
- `{{from_name}}` - Sender's name (Golden Tag WLL)
- `{{subject}}` - Email subject
- `{{message}}` - Custom message (optional)
- `{{document_type}}` - Type of document (INVOICE, QUOTATION, etc.)
- `{{document_number}}` - Document number
- `{{company_name}}` - Company name (Golden Tag WLL)
- `{{reply_to}}` - Reply-to email address
- `{{pdf_download_url}}` - URL to download the PDF (if available)

## Setup Instructions

1. **Login to EmailJS Dashboard**
   - Go to https://dashboard.emailjs.com/
   - Login with your EmailJS account

2. **Create Templates**
   - Navigate to "Email Templates" section
   - Create each template with the IDs and content provided above
   - Make sure to use the exact template IDs as specified

3. **Configure Service**
   - Ensure your service `service_b7vwpdh` is properly configured
   - Verify the service is connected to your email provider (Gmail, etc.)

4. **Test Templates**
   - Use the EmailJS dashboard to test each template
   - Verify that all variables are properly substituted

## Features Implemented

### 1. EmailSendButton Component
- Reusable button component for sending emails
- Supports all document types (invoice, quotation, proforma invoice, goods receipt, sales order)
- Handles PDF generation and email preparation
- Shows loading states and error handling

### 2. EmailSendDialog Component
- Modal dialog for composing emails
- Pre-fills customer information
- Allows custom messages
- Handles PDF attachments

### 3. API Endpoints
- `/api/email/invoice/:id` - Prepare invoice for email
- `/api/email/quotation/:id` - Prepare quotation for email
- `/api/email/proforma-invoice/:id` - Prepare proforma invoice for email
- `/api/email/goods-receipt/:id` - Prepare goods receipt for email
- `/api/email/sales-order/:id` - Prepare sales order for email

### 4. Integration Points
- **Invoicing Page**: Email buttons in table and detail view
- **Quotation Detail Page**: Email button for sending quotations
- **Future Integration**: Can be easily added to other pages

## Usage

1. **In the UI**: Click the "Send Email" button on any document
2. **Email Dialog**: Review recipient details and add custom message
3. **Send**: Click "Send Email" to dispatch the email with PDF attachment

## Security Notes

- EmailJS credentials are public and meant for client-side use
- PDF data is base64 encoded and sent as data URLs
- Consider implementing server-side email sending for production use
- Add rate limiting to prevent spam

## Troubleshooting

1. **Email not sending**: Check EmailJS service configuration
2. **Template not found**: Verify template IDs match exactly
3. **PDF not attaching**: Check if PDF generation is working
4. **Variables not substituting**: Ensure template variables match the code

## Future Enhancements

1. **Server-side email sending**: Move to server-side for better security
2. **Email templates management**: Add UI for managing email templates
3. **Bulk email sending**: Send multiple documents at once
4. **Email tracking**: Track email delivery and opens
5. **Custom email signatures**: Allow custom signatures per user

