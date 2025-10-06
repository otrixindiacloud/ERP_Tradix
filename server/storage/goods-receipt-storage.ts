// Note: Not implementing full IGoodsReceiptStorage yet (subset needed for E2E).
import { db } from "../db";
import { insertGoodsReceiptHeaderSchema, insertGoodsReceiptItemSchema, goodsReceiptHeaders, goodsReceiptItems, supplierLpos, suppliers } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from 'crypto';

export class GoodsReceiptStorage {
  private generateReceiptNumber() {
    return `GRN-${new Date().toISOString().slice(0,10)}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  }

  async createGoodsReceiptHeader(receipt: any) {
    try {
      console.log('[GoodsReceiptStorage.createGoodsReceiptHeader][START]', { incoming: receipt });
      const base: any = { ...receipt };
      if (!base.receiptNumber) base.receiptNumber = this.generateReceiptNumber();
      if (!base.id) base.id = randomUUID(); // Workaround missing DB default
      if (!base.status) base.status = 'Draft';
      if (!base.receiptDate) base.receiptDate = new Date().toISOString().slice(0,10);
      const normalizeDate = (d: any) => {
        if (!d) return d; if (typeof d === 'string' && d.length >= 10) return d.slice(0,10); if (d instanceof Date) return d.toISOString().slice(0,10); return d;
      };
      base.receiptDate = normalizeDate(base.receiptDate);
      base.expectedDeliveryDate = normalizeDate(base.expectedDeliveryDate);
      base.actualDeliveryDate = normalizeDate(base.actualDeliveryDate);
      if (!base.supplierId && base.supplierLpoId) {
        console.warn('[GoodsReceiptStorage.createGoodsReceiptHeader] Missing supplierId; derivation from supplierLpoId not implemented');
      }
      // Parse without id (schema omits id)
      const parseInput = { ...base };
      delete parseInput.id;
      let toInsert: any;
      try {
        toInsert = insertGoodsReceiptHeaderSchema.parse(parseInput);
      } catch (zerr) {
        console.error('[GoodsReceiptStorage.createGoodsReceiptHeader] Validation failed', zerr, { parseInput });
        throw zerr;
      }
      const assignedId = base.id;
      console.log('[GoodsReceiptStorage.createGoodsReceiptHeader][ID RESOLUTION]', { assignedId });
      const projected = {
        id: assignedId,
        receiptNumber: toInsert.receiptNumber,
        supplierLpoId: toInsert.supplierLpoId,
        supplierId: toInsert.supplierId,
        lpoNumber: toInsert.lpoNumber,
        receiptDate: toInsert.receiptDate,
        expectedDeliveryDate: toInsert.expectedDeliveryDate,
        actualDeliveryDate: toInsert.actualDeliveryDate,
        receivedBy: toInsert.receivedBy,
        status: toInsert.status,
        notes: toInsert.notes,
        totalItems: toInsert.totalItems,
        totalQuantityExpected: toInsert.totalQuantityExpected,
        totalQuantityReceived: toInsert.totalQuantityReceived,
        discrepancyFlag: toInsert.discrepancyFlag
      };
      console.log('[GoodsReceiptStorage.createGoodsReceiptHeader][PROJECTED]', projected);
      try {
        const inserted = await db.insert(goodsReceiptHeaders).values(projected as any).returning();
        console.log('[GoodsReceiptStorage.createGoodsReceiptHeader][PRIMARY OK]', { id: inserted[0]?.id });
        return inserted[0];
      } catch (errPrimary) {
        console.error('[GoodsReceiptStorage.createGoodsReceiptHeader] Primary insert failed', errPrimary);
        const minimal = {
          id: projected.id,
          receiptNumber: projected.receiptNumber,
          supplierLpoId: projected.supplierLpoId,
          supplierId: projected.supplierId,
          receiptDate: projected.receiptDate,
          status: projected.status || 'Draft'
        };
        console.log('[GoodsReceiptStorage.createGoodsReceiptHeader][MINIMAL RETRY]', minimal);
        try {
          const inserted2 = await db.insert(goodsReceiptHeaders).values(minimal as any).returning();
          console.log('[GoodsReceiptStorage.createGoodsReceiptHeader][SECONDARY OK]', { id: inserted2[0]?.id });
          return inserted2[0];
        } catch (errSecondary) {
          console.error('[GoodsReceiptStorage.createGoodsReceiptHeader] Secondary insert failed', errSecondary);
          throw errPrimary;
        }
      }
    } catch (err) {
      console.error('[GoodsReceiptStorage.createGoodsReceiptHeader] Error', err, { input: receipt });
      throw err;
    }
  }

  async createGoodsReceiptItem(item: any) {
    try {
      const start = Date.now();
      const base = { ...item };
      console.log('[GoodsReceiptStorage.createGoodsReceiptItem][INPUT]', base);
      if (!base.itemDescription) base.itemDescription = base.description || 'Item';
      if (!base.quantityExpected && base.quantityReceived) base.quantityExpected = base.quantityReceived;
      // Normalize potential legacy field names
      if (base.goodsReceiptId && !base.receiptHeaderId) {
        base.receiptHeaderId = base.goodsReceiptId; // legacy compatibility
      }
      try {
        const parsed = insertGoodsReceiptItemSchema.parse(base);
        console.log('[GoodsReceiptStorage.createGoodsReceiptItem][PARSED]', parsed);
        // Table currently still has legacy text PK without default; ensure id provided
        const rowToInsert: any = { id: randomUUID(), ...parsed };
        console.log('[GoodsReceiptStorage.createGoodsReceiptItem][ROW TO INSERT]', rowToInsert);
        let inserted;
        try {
          inserted = await db.insert(goodsReceiptItems).values(rowToInsert).returning();
        } catch (dbErr: any) {
          // Surface postgres error details if present
            const pgInfo = {
              code: dbErr?.code,
              detail: dbErr?.detail,
              table: dbErr?.table,
              constraint: dbErr?.constraint,
              message: dbErr?.message,
            };
            console.error('[GoodsReceiptStorage.createGoodsReceiptItem][DB ERROR]', pgInfo);
            // Attach a safe error for upper layers
            const wrapped = new Error(dbErr?.message || 'DB insert failed for goods receipt item');
            (wrapped as any).db = pgInfo;
            throw wrapped;
        }
        const row = inserted[0];
        console.log('[GoodsReceiptStorage.createGoodsReceiptItem][SUCCESS]', { id: row?.id, ms: Date.now() - start });
        return row;
      } catch (inner) {
        console.error('[GoodsReceiptStorage.createGoodsReceiptItem][ERROR]', inner);
        throw inner;
      }
    } catch (err) {
      console.error('[GoodsReceiptStorage.createGoodsReceiptItem] Error', err, { input: item });
      throw err;
    }
  }

  async getGoodsReceiptHeaders(filters?: any) {
    try {
      // Join with supplier LPOs to get LPO number and supplier information
      const query = db
        .select({
          id: goodsReceiptHeaders.id,
          receiptNumber: goodsReceiptHeaders.receiptNumber,
          supplierLpoId: goodsReceiptHeaders.supplierLpoId,
          supplierId: goodsReceiptHeaders.supplierId,
          lpoNumber: goodsReceiptHeaders.lpoNumber,
          receiptDate: goodsReceiptHeaders.receiptDate,
          expectedDeliveryDate: goodsReceiptHeaders.expectedDeliveryDate,
          actualDeliveryDate: goodsReceiptHeaders.actualDeliveryDate,
          receivedBy: goodsReceiptHeaders.receivedBy,
          status: goodsReceiptHeaders.status,
          notes: goodsReceiptHeaders.notes,
          totalItems: goodsReceiptHeaders.totalItems,
          totalQuantityExpected: goodsReceiptHeaders.totalQuantityExpected,
          totalQuantityReceived: goodsReceiptHeaders.totalQuantityReceived,
          discrepancyFlag: goodsReceiptHeaders.discrepancyFlag,
          createdAt: goodsReceiptHeaders.createdAt,
          updatedAt: goodsReceiptHeaders.updatedAt,
          // LPO information from join
          lpoNumberFromLpo: supplierLpos.lpoNumber,
          lpoDate: supplierLpos.lpoDate,
          lpoStatus: supplierLpos.status,
          lpoTotalAmount: supplierLpos.totalAmount,
          lpoCurrency: supplierLpos.currency,
          // Supplier information
          supplierName: suppliers.name,
          supplierEmail: suppliers.email,
          supplierPhone: suppliers.phone,
          supplierContactPerson: suppliers.contactPerson,
        })
        .from(goodsReceiptHeaders)
        .leftJoin(supplierLpos, eq(goodsReceiptHeaders.supplierLpoId, supplierLpos.id))
        .leftJoin(suppliers, eq(goodsReceiptHeaders.supplierId, suppliers.id))
        .orderBy(desc(goodsReceiptHeaders.createdAt));

      return await query;
    } catch (error) {
      console.error('[GoodsReceiptStorage.getGoodsReceiptHeaders] Error:', error);
      throw error;
    }
  }

  async getGoodsReceiptHeader(id: string) {
    const r = await db
      .select({
        id: goodsReceiptHeaders.id,
        receiptNumber: goodsReceiptHeaders.receiptNumber,
        supplierLpoId: goodsReceiptHeaders.supplierLpoId,
        supplierId: goodsReceiptHeaders.supplierId,
        lpoNumber: goodsReceiptHeaders.lpoNumber,
        receiptDate: goodsReceiptHeaders.receiptDate,
        expectedDeliveryDate: goodsReceiptHeaders.expectedDeliveryDate,
        actualDeliveryDate: goodsReceiptHeaders.actualDeliveryDate,
        receivedBy: goodsReceiptHeaders.receivedBy,
        status: goodsReceiptHeaders.status,
        notes: goodsReceiptHeaders.notes,
        totalItems: goodsReceiptHeaders.totalItems,
        totalQuantityExpected: goodsReceiptHeaders.totalQuantityExpected,
        totalQuantityReceived: goodsReceiptHeaders.totalQuantityReceived,
        discrepancyFlag: goodsReceiptHeaders.discrepancyFlag,
        createdAt: goodsReceiptHeaders.createdAt,
        updatedAt: goodsReceiptHeaders.updatedAt,
      })
      .from(goodsReceiptHeaders)
      .where(eq(goodsReceiptHeaders.id, id))
      .limit(1);
    return r[0];
  }

  async getGoodsReceiptItems(headerId: string) {
    return db.select().from(goodsReceiptItems).where(eq(goodsReceiptItems.receiptHeaderId, headerId));
  }

  async createGoodsReceiptItemsBulk(itemsArr: any[]) {
    if (!itemsArr.length) return [];
    const prepared = itemsArr.map(it => {
      const base = { ...it };
      if (!base.itemDescription) base.itemDescription = base.description || 'Item';
      if (!base.quantityExpected && base.quantityReceived) base.quantityExpected = base.quantityReceived;
      return insertGoodsReceiptItemSchema.parse(base);
    });
    return db.insert(goodsReceiptItems).values(prepared as any).returning();
  }

  async approveGoodsReceipt(id: string, approvedBy?: string) {
    try {
      console.log('[GoodsReceiptStorage.approveGoodsReceipt][START]', { id, approvedBy });
      
      // Update the goods receipt header status to Approved
      const updated = await db
        .update(goodsReceiptHeaders)
        .set({ 
          status: 'Approved',
          updatedAt: new Date()
        })
        .where(eq(goodsReceiptHeaders.id, id))
        .returning();
      
      if (!updated.length) {
        throw new Error('Goods receipt not found');
      }
      
      console.log('[GoodsReceiptStorage.approveGoodsReceipt][SUCCESS]', { id: updated[0]?.id });
      return updated[0];
    } catch (err) {
      console.error('[GoodsReceiptStorage.approveGoodsReceipt] Error', err, { id, approvedBy });
      throw err;
    }
  }

  async updateGoodsReceiptStatus(id: string, status: string) {
    try {
      console.log('[GoodsReceiptStorage.updateGoodsReceiptStatus][START]', { id, status });
      
      const updated = await db
        .update(goodsReceiptHeaders)
        .set({ 
          status,
          updatedAt: new Date()
        })
        .where(eq(goodsReceiptHeaders.id, id))
        .returning();
      
      if (!updated.length) {
        throw new Error('Goods receipt not found');
      }
      
      console.log('[GoodsReceiptStorage.updateGoodsReceiptStatus][SUCCESS]', { id: updated[0]?.id });
      return updated[0];
    } catch (err) {
      console.error('[GoodsReceiptStorage.updateGoodsReceiptStatus] Error', err, { id, status });
      throw err;
    }
  }

  async updateGoodsReceiptHeader(id: string, data: any) {
    try {
      console.log('[GoodsReceiptStorage.updateGoodsReceiptHeader][START]', { id, data });
      
      const updateData = {
        ...data,
        updatedAt: new Date()
      };
      
      const updated = await db
        .update(goodsReceiptHeaders)
        .set(updateData)
        .where(eq(goodsReceiptHeaders.id, id))
        .returning();
      
      if (!updated.length) {
        throw new Error('Goods receipt not found');
      }
      
      console.log('[GoodsReceiptStorage.updateGoodsReceiptHeader][SUCCESS]', { id: updated[0]?.id });
      return updated[0];
    } catch (err) {
      console.error('[GoodsReceiptStorage.updateGoodsReceiptHeader] Error', err, { id, data });
      throw err;
    }
  }

  async deleteGoodsReceiptHeader(id: string) {
    try {
      console.log('[GoodsReceiptStorage.deleteGoodsReceiptHeader][START]', { id });
      
      // First delete related goods receipt items
      await db
        .delete(goodsReceiptItems)
        .where(eq(goodsReceiptItems.receiptHeaderId, id));
      
      // Then delete the goods receipt header
      const deleted = await db
        .delete(goodsReceiptHeaders)
        .where(eq(goodsReceiptHeaders.id, id))
        .returning();
      
      if (!deleted.length) {
        return false; // Not found
      }
      
      console.log('[GoodsReceiptStorage.deleteGoodsReceiptHeader][SUCCESS]', { id });
      return true;
    } catch (err) {
      console.error('[GoodsReceiptStorage.deleteGoodsReceiptHeader] Error', err, { id });
      throw err;
    }
  }
}
