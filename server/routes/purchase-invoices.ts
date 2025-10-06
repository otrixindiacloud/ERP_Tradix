import type { Express } from "express";
import { storage } from "../storage";
import { insertPurchaseInvoiceSchema, insertPurchaseInvoiceItemSchema } from "../../shared/schema";
import { generatePurchaseInvoicePdf } from "../pdf/pdf-utils";
import { z } from "zod";

export function registerPurchaseInvoiceRoutes(app: Express) {
  // Create purchase invoice
  app.post("/api/purchase-invoices", async (req, res) => {
    try {
      console.log('[PURCHASE INVOICE][RAW BODY]', JSON.stringify(req.body, null, 2));
      
      // Handle both old format (just invoice data) and new format (invoice + items)
      if (req.body.invoice && req.body.items) {
        // New format with items
        console.log('[PURCHASE INVOICE][INVOICE]', req.body.invoice);
        console.log('[PURCHASE INVOICE][ITEMS]', req.body.items);
        
        const validatedInvoice = insertPurchaseInvoiceSchema.parse(req.body.invoice);
        console.log('[PURCHASE INVOICE][INVOICE PARSED]', validatedInvoice);
        
        const validatedItems = z.array(insertPurchaseInvoiceItemSchema).parse(req.body.items);
        console.log('[PURCHASE INVOICE][ITEMS PARSED]', validatedItems);
        
        const purchaseInvoice = await storage.createPurchaseInvoice(validatedInvoice, validatedItems);
        res.status(201).json(purchaseInvoice);
      } else {
        // Old format without items
        const validatedData = insertPurchaseInvoiceSchema.parse(req.body);
        const purchaseInvoice = await storage.createPurchaseInvoice(validatedData);
        res.status(201).json(purchaseInvoice);
      }
    } catch (error) {
      console.error("Error creating purchase invoice:", error);
      res.status(400).json({ message: "Failed to create purchase invoice", error: error.message });
    }
  });

  // List purchase invoices
  app.get("/api/purchase-invoices", async (req, res) => {
    try {
      const purchaseInvoices = await storage.getPurchaseInvoices();
      res.json(purchaseInvoices);
    } catch (error) {
      console.error("Error fetching purchase invoices:", error);
      res.status(500).json({ message: "Failed to fetch purchase invoices" });
    }
  });

  // Get single purchase invoice
  app.get("/api/purchase-invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const purchaseInvoice = await storage.getPurchaseInvoice(id);
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
      res.json(purchaseInvoice);
    } catch (error) {
      console.error("Error fetching purchase invoice:", error);
      res.status(500).json({ message: "Failed to fetch purchase invoice" });
    }
  });

  // Get purchase invoice items
  app.get("/api/purchase-invoices/:id/items", async (req, res) => {
    try {
      const { id } = req.params;
      const items = await storage.getPurchaseInvoiceItems(id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching purchase invoice items:", error);
      res.status(500).json({ message: "Failed to fetch purchase invoice items" });
    }
  });

  // Update purchase invoice
  app.patch("/api/purchase-invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const purchaseInvoice = await storage.updatePurchaseInvoice(id, req.body);
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
      res.json(purchaseInvoice);
    } catch (error) {
      console.error("Error updating purchase invoice:", error);
      res.status(400).json({ message: "Failed to update purchase invoice", error: error.message });
    }
  });

  // Delete purchase invoice
  app.delete("/api/purchase-invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePurchaseInvoice(id);
      if (!deleted) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
      res.json({ message: "Purchase invoice deleted successfully" });
    } catch (error) {
      console.error("Error deleting purchase invoice:", error);
      res.status(500).json({ message: "Failed to delete purchase invoice", error: error.message });
    }
  });

  // Generate PDF for purchase invoice
  app.get("/api/purchase-invoices/:id/pdf", async (req, res) => {
    try {
      const { id } = req.params;
      const { mode = 'enhanced' } = req.query;
      
      // Get purchase invoice
      const purchaseInvoice = await storage.getPurchaseInvoice(id);
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }

      // Get invoice items (from goods receipt items if available)
      let invoiceItems = [];
      if (purchaseInvoice.goodsReceiptId) {
        try {
          invoiceItems = await storage.getGoodsReceiptItems(purchaseInvoice.goodsReceiptId);
        } catch (error) {
          console.warn("Could not fetch goods receipt items:", error);
        }
      }

      // Get supplier information
      let supplier = {};
      if (purchaseInvoice.supplierId) {
        try {
          supplier = await storage.getSupplier(purchaseInvoice.supplierId) || {};
        } catch (error) {
          console.warn("Could not fetch supplier information:", error);
        }
      }

      // Generate PDF
      const pdfResult = generatePurchaseInvoicePdf({
        invoice: purchaseInvoice,
        items: invoiceItems,
        supplier: supplier,
        mode: mode as 'enhanced' | 'simple'
      });

      // Set response headers
      res.setHeader('Content-Type', pdfResult.contentType);
      res.setHeader('Content-Length', pdfResult.byteLength);
      res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.fileName}"`);
      
      // Send PDF buffer
      res.send(pdfResult.buffer);
    } catch (error) {
      console.error("Error generating purchase invoice PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF", error: error.message });
    }
  });
}

export default registerPurchaseInvoiceRoutes;
