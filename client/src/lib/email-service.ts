import emailjs from '@emailjs/browser';
import { EMAILJS_CONFIG, EMAIL_TEMPLATES, EMAIL_SUBJECTS } from './emailjs-config';

// Initialize EmailJS
emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);

export interface EmailAttachment {
  name: string;
  data: string; // base64 encoded PDF data
  type: string;
}

export interface EmailData {
  to_email: string;
  to_name?: string;
  from_name: string;
  subject: string;
  message: string;
  document_type: string;
  document_number: string;
  company_name: string;
  attachment?: EmailAttachment;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  emailId?: string;
}

export class EmailService {
  private static instance: EmailService;
  
  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Send email with PDF attachment
   */
  async sendEmailWithPdf(
    toEmail: string,
    toName: string,
    documentType: 'invoice' | 'proforma_invoice' | 'quotation' | 'goods_receipt' | 'sales_order',
    documentNumber: string,
    pdfData: string, // base64 encoded PDF
    customMessage?: string
  ): Promise<SendEmailResult> {
    try {
      const templateId = this.getTemplateId(documentType);
      const subject = this.getSubject(documentType, documentNumber);
      
      const templateParams = {
        to_email: toEmail,
        to_name: toName,
        from_name: 'Golden Tag WLL',
        subject: subject,
        message: customMessage || this.getDefaultMessage(documentType, documentNumber),
        document_type: documentType.toUpperCase(),
        document_number: documentNumber,
        company_name: 'Golden Tag WLL',
        reply_to: EMAILJS_CONFIG.CONTACT_EMAIL
      };

      // Send email using EmailJS
      const response = await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        templateId,
        templateParams
      );

      // For PDF attachment, we'll need to use a different approach
      // EmailJS doesn't directly support file attachments in the free tier
      // We'll include the PDF as a downloadable link or use a different method
      
      return {
        success: true,
        message: 'Email sent successfully',
        emailId: response.text
      };
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  /**
   * Send email with PDF as downloadable link
   */
  async sendEmailWithPdfLink(
    toEmail: string,
    toName: string,
    documentType: 'invoice' | 'proforma_invoice' | 'quotation' | 'goods_receipt' | 'sales_order',
    documentNumber: string,
    pdfDownloadUrl: string,
    customMessage?: string
  ): Promise<SendEmailResult> {
    try {
      console.log('Sending email with PDF link...');
      console.log('Document type:', documentType);
      console.log('Document number:', documentNumber);
      
      const templateId = this.getTemplateId(documentType);
      const subject = this.getSubject(documentType, documentNumber);
      
      const templateParams = {
        to_email: toEmail,
        to_name: toName,
        from_name: 'Golden Tag WLL',
        subject: subject,
        message: customMessage || this.getDefaultMessage(documentType, documentNumber),
        document_type: documentType.toUpperCase(),
        document_number: documentNumber,
        company_name: 'Golden Tag WLL',
        pdf_download_url: pdfDownloadUrl,
        reply_to: EMAILJS_CONFIG.CONTACT_EMAIL
      };

      console.log('Template params:', templateParams);

      const response = await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        templateId,
        templateParams
      );

      console.log('EmailJS response:', response);

      return {
        success: true,
        message: 'Email sent successfully',
        emailId: response.text
      };
    } catch (error) {
      console.error('Error sending email with PDF:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  /**
   * Send simple email without attachment
   */
  async sendSimpleEmail(
    toEmail: string,
    toName: string,
    subject: string,
    message: string
  ): Promise<SendEmailResult> {
    try {
      console.log('Sending simple email with EmailJS...');
      console.log('Service ID:', EMAILJS_CONFIG.SERVICE_ID);
      console.log('Template ID:', EMAILJS_CONFIG.TEMPLATE_ID);
      console.log('Public Key:', EMAILJS_CONFIG.PUBLIC_KEY);
      
      const templateParams = {
        to_email: toEmail,
        to_name: toName,
        from_name: 'Golden Tag WLL',
        subject: subject,
        message: message,
        reply_to: EMAILJS_CONFIG.CONTACT_EMAIL
      };

      console.log('Template params:', templateParams);

      const response = await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID,
        templateParams
      );

      console.log('EmailJS response:', response);

      return {
        success: true,
        message: 'Email sent successfully',
        emailId: response.text
      };
    } catch (error) {
      console.error('Error sending email:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  private getTemplateId(documentType: string): string {
    // For now, use the default template for all document types
    // TODO: Create specific templates in EmailJS dashboard
    return EMAILJS_CONFIG.TEMPLATE_ID;
  }

  private getSubject(documentType: string, documentNumber: string): string {
    const baseSubject = EMAIL_SUBJECTS[documentType.toUpperCase() as keyof typeof EMAIL_SUBJECTS] || 'Document - Golden Tag WLL';
    return `${baseSubject} - ${documentNumber}`;
  }

  private getDefaultMessage(documentType: string, documentNumber: string): string {
    const documentName = documentType.replace('_', ' ').toUpperCase();
    return `Dear Customer,\n\nPlease find attached your ${documentName} #${documentNumber}.\n\nIf you have any questions, please don't hesitate to contact us.\n\nBest regards,\nGolden Tag WLL Team`;
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();

