import { db } from "../db";
import { salesOrders, salesOrderItems, quotations, quotationItems, items, customers, purchaseOrders, suppliers } from "@shared/schema";
import { eq, and, desc, sql, or, like } from "drizzle-orm";
import { validateUUID, SYSTEM_USER_ID } from "@shared/utils/uuid";
import { ISalesOrderStorage } from "./interfaces";
import { BaseStorage } from "./base";

export class SalesOrderStorage extends BaseStorage implements ISalesOrderStorage {
  async getSalesOrders(limit = 50, offset = 0, filters?: {
    status?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    pendingSupplierLpo?: boolean;
  }) {
    // Build query with left join to customers so we can embed minimal customer object
    const conditions = [] as any[];
    if (filters) {
      if (filters.status) conditions.push(eq(salesOrders.status, filters.status as any));
      if (filters.customerId) conditions.push(eq(salesOrders.customerId, filters.customerId));
      if (filters.dateFrom) conditions.push(sql`${salesOrders.orderDate} >= ${filters.dateFrom}`);
      if (filters.dateTo) conditions.push(sql`${salesOrders.orderDate} <= ${filters.dateTo}`);
      if (filters.search) conditions.push(sql`${salesOrders.orderNumber} ILIKE ${`%${filters.search}%`}`);
    }

    let query = db
      .select({ 
        so: salesOrders, 
        cust: customers,
        quot: quotations
      })
      .from(salesOrders)
      .leftJoin(customers, eq(salesOrders.customerId, customers.id))
      .leftJoin(quotations, eq(salesOrders.quotationId, quotations.id));

    // Drizzle ORM chaining: .where() must come after .leftJoin()
    if (conditions.length) {
      query = query.where(and(...conditions));
    }

    const rows = await query.orderBy(desc(salesOrders.createdAt)).limit(limit).offset(offset);
    // Map to enriched shape with embedded customer + quotation + transition flag
    return rows.map(r => {
      const c = r.cust ? {
        id: (r.cust as any).id,
        name: (r.cust as any).name || (r.cust as any).customerName || (r.cust as any).companyName || (r.cust as any).fullName,
        customerType: (r.cust as any).customerType || null,
        address: (r.cust as any).address || (r.cust as any).billingAddress || null,
      } : null;
      const q = r.quot ? {
        id: (r.quot as any).id,
        quoteNumber: (r.quot as any).quoteNumber,
        revision: (r.quot as any).revision,
        status: (r.quot as any).status,
      } : null;
      return { ...r.so, customer: c, quotation: q, __customerEmbedded: true };
    });
  }

  async getSalesOrder(id: string) {
    const result = await db
      .select({
        salesOrder: salesOrders,
        customer: customers,
        quotation: quotations,
      })
      .from(salesOrders)
      .leftJoin(customers, eq(salesOrders.customerId, customers.id))
      .leftJoin(quotations, eq(salesOrders.quotationId, quotations.id))
      .where(eq(salesOrders.id, id))
      .limit(1);
    
    if (result.length === 0) {
      return null;
    }
    const row = result[0];
    const customer = row.customer
      ? {
          id: (row.customer as any).id,
          name:
            (row.customer as any).name ||
            (row.customer as any).customerName ||
            (row.customer as any).companyName ||
            (row.customer as any).fullName,
          email: (row.customer as any).email ?? null,
          isActive: (row.customer as any).isActive ?? null,
          createdAt: (row.customer as any).createdAt ?? null,
          updatedAt: (row.customer as any).updatedAt ?? null,
          phone: (row.customer as any).phone ?? null,
          address:
            (row.customer as any).address ??
            (row.customer as any).billingAddress ??
            null,
          customerType: (row.customer as any).customerType ?? null,
          vatNumber: (row.customer as any).vatNumber ?? null,
          trnNumber: (row.customer as any).trnNumber ?? null,
          companyName: (row.customer as any).companyName ?? null,
          paymentTerms: (row.customer as any).paymentTerms ?? null,
        }
      : null;
    const quotation = row.quotation
      ? {
          id: (row.quotation as any).id,
          quoteNumber: (row.quotation as any).quoteNumber,
          revision: (row.quotation as any).revision,
          status: (row.quotation as any).status,
        }
      : null;
    return { ...row.salesOrder, customer, quotation, __customerEmbedded: true };
  }

  async createSalesOrder(salesOrder: any) {
    const orderNumber = `SO-${new Date().getFullYear()}-${String(await this.getNextSequenceNumber()).padStart(3, '0')}`;
    
    const newSalesOrder = {
      // id omitted -> DB default gen_random_uuid()
      orderNumber,
      ...salesOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const result = await db.insert(salesOrders).values(newSalesOrder).returning();
    return result[0];
  }

  async updateSalesOrder(id: string, salesOrder: any) {
    const updatedSalesOrder = {
      ...salesOrder,
      updatedAt: new Date(),
    };

    const result = await db
      .update(salesOrders)
      .set(updatedSalesOrder)
      .where(eq(salesOrders.id, id))
      .returning();
    
    return result[0];
  }

  async deleteSalesOrder(id: string) {
    await db.delete(salesOrders).where(eq(salesOrders.id, id));
  }

  async createSalesOrderFromQuotation(quotationId: string, userId?: string) {
    // Get the quotation with its items
    const quotation = await db.select().from(quotations).where(eq(quotations.id, quotationId)).limit(1);
    if (!quotation[0]) {
      throw new Error('Quotation not found');
    }

    const quotationData = quotation[0];

    // Validate that quotation is accepted
    if (quotationData.status !== 'Accepted') {
      throw new Error('Quotation must be accepted before creating sales order');
    }

    // Get customer PO information from purchaseOrders table
    const customerPo = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.quotationId, quotationId))
      .limit(1);
    
    if (!customerPo[0]) {
      throw new Error('Customer PO must be uploaded before creating sales order');
    }
    const quotationItemsData = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, quotationId));

    // Generate sales order number
    const orderNumber = `SO-${new Date().getFullYear()}-${String(await this.getNextSequenceNumber()).padStart(3, '0')}`;

    // Create the sales order
    const salesOrderData = {
      orderNumber,
      quotationId,
      customerId: quotationData.customerId,
      customerPoNumber: customerPo[0].poNumber,
      customerPoDocument: customerPo[0].documentPath,
      orderDate: new Date(),
      status: 'Draft' as const,
      totalAmount: quotationData.totalAmount,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const result = await db.insert(salesOrders).values(salesOrderData).returning();
    const createdSalesOrder = result[0];

    // Create sales order items from quotation items
    if (quotationItemsData.length > 0) {
      // Determine a valid itemId to satisfy FK (use first existing item or create a generic one)
      let existingItem = (await db.select().from(items).limit(1))[0];
      if (!existingItem) {
        const created = await db.insert(items).values({
          supplierCode: `GEN-${Date.now()}`,
          description: 'Generic Item',
        }).returning();
        existingItem = created[0];
      }
      const fallbackItemId = existingItem.id;

      const salesOrderItemsData = quotationItemsData.map(qi => {
        const qty = Number(qi.quantity) || 0;
        const unit = Number(qi.unitPrice) || 0;
        const lineTotal = Number(qi.lineTotal) || unit * qty;
        return {
          salesOrderId: createdSalesOrder.id,
          itemId: fallbackItemId,
          quantity: qty,
          unitPrice: unit.toFixed(2),
          totalPrice: lineTotal.toFixed(2),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });
      await db.insert(salesOrderItems).values(salesOrderItemsData);
    }

    return createdSalesOrder;
  }

  async createAmendedSalesOrder(parentOrderId: string, reason: string, userId?: string) {
    // Get the parent sales order
    const parentOrder = await this.getSalesOrder(parentOrderId);
    if (!parentOrder) {
      throw new Error('Parent sales order not found');
    }
    
    // Instead of creating a new row, update the existing sales order with amendment information
    const updatedSalesOrder = {
      amendmentReason: reason,
      amendedBy: userId,
      amendedAt: new Date(),
      updatedAt: new Date(),
      // Keep the same order number and version - no new v2 data
      // Just mark it as amended
      isAmended: true,
    };

    const result = await db
      .update(salesOrders)
      .set(updatedSalesOrder)
      .where(eq(salesOrders.id, parentOrderId))
      .returning();
    
    return result[0];
  }

  async validateCustomerLpo(id: string, validationData: { status: string; notes?: string; validatedBy: string }) {
    const salesOrder = await this.getSalesOrder(id);
    if (!salesOrder) {
      throw new Error('Sales order not found');
    }

    const updatedSalesOrder = {
      customerLpoValidationStatus: validationData.status,
      customerLpoValidatedBy: validationData.validatedBy,
      customerLpoValidatedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db
      .update(salesOrders)
      .set(updatedSalesOrder)
      .where(eq(salesOrders.id, id))
      .returning();
    
    return result[0];
  }

  // Sales Order Item operations
  async getSalesOrderItems(salesOrderId: string) {
    return db
      .select({
        id: salesOrderItems.id,
        salesOrderId: salesOrderItems.salesOrderId,
        itemId: salesOrderItems.itemId,
        lineNumber: salesOrderItems.lineNumber,
        quantity: salesOrderItems.quantity,
        unitPrice: salesOrderItems.unitPrice,
        totalPrice: salesOrderItems.totalPrice,
        deliveryRequirement: salesOrderItems.deliveryRequirement,
        specialInstructions: salesOrderItems.specialInstructions,
        // Item details
        supplierCode: items.supplierCode,
        barcode: items.barcode,
        description: items.description,
        category: items.category,
        unitOfMeasure: items.unitOfMeasure,
        // Supplier details
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        supplierEmail: suppliers.email,
        supplierPhone: suppliers.phone,
        supplierAddress: suppliers.address,
        supplierContactPerson: suppliers.contactPerson,
      })
      .from(salesOrderItems)
      .leftJoin(items, eq(salesOrderItems.itemId, items.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .where(eq(salesOrderItems.salesOrderId, salesOrderId));
  }

  async getSalesOrderItem(id: string) {
    const result = await db.select().from(salesOrderItems).where(eq(salesOrderItems.id, id)).limit(1);
    return result[0];
  }

  async createSalesOrderItem(item: any) {
    const newItem = {
      ...item,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const result = await db.insert(salesOrderItems).values(newItem).returning();
    return result[0];
  }

  async updateSalesOrderItem(id: string, item: any) {
    const updatedItem = {
      ...item,
      updatedAt: new Date(),
    };

    const result = await db
      .update(salesOrderItems)
      .set(updatedItem)
      .where(eq(salesOrderItems.id, id))
      .returning();
    
    return result[0];
  }

  async deleteSalesOrderItem(id: string) {
    await db.delete(salesOrderItems).where(eq(salesOrderItems.id, id));
  }

  async bulkCreateSalesOrderItems(items: any[]) {
    const itemsWithIds = items.map(item => ({
      ...item,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await db.insert(salesOrderItems).values(itemsWithIds).returning();
    return result;
  }

  private async getNextSequenceNumber(): Promise<number> {
    const result = await db.execute(sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'SO-\\d{4}-(\\d+)') AS INTEGER)), 0) + 1 AS next_number
      FROM sales_orders
      WHERE order_number LIKE 'SO-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%'
    `);
    const row: any = result.rows?.[0];
    return row?.next_number || 1;
  }

  /**
   * Get lineage (root + amendments) for a given order id. Root first then amendments by amendment_sequence.
   */
  async getSalesOrderLineage(orderId: string) {
    const current = await db.select().from(salesOrders).where(eq(salesOrders.id, orderId)).limit(1);
    if (!current.length) return [];
    let root = current[0];
    if (root.parentOrderId) {
      const maybeRoot = await db.select().from(salesOrders).where(eq(salesOrders.id, root.parentOrderId)).limit(1);
      if (maybeRoot.length) root = maybeRoot[0];
    }
    const lineage: any = await db.execute(sql`
      SELECT * FROM sales_orders
      WHERE id = ${root.id} OR parent_order_id = ${root.id}
      ORDER BY CASE WHEN amendment_sequence IS NULL THEN 0 ELSE amendment_sequence END
    `);
    return lineage.rows;
  }
}
