import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Eye, Trash, Package, Scan, AlertTriangle, Check, Clock, CheckCircle, Truck, CheckCircle2, XCircle } from "lucide-react";
import DataTable, { Column } from "@/components/tables/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatCurrency, getStatusColor } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState as ReactState, useEffect as ReactEffect } from "react";

// Component for displaying delivered shipments ready for goods receipt
function DeliveredShipmentsSection({ createGoodsReceipt }: { createGoodsReceipt: any }) {
  const [deliveredShipments, setDeliveredShipments] = ReactState<any[]>([]);
  const [isLoading, setIsLoading] = ReactState(false);
  const [expandedShipment, setExpandedShipment] = ReactState<string | null>(null);
  const [supplierDetails, setSupplierDetails] = ReactState<Record<string, any>>({});
  const [customerDetails, setCustomerDetails] = ReactState<Record<string, any>>({});
  const { toast } = useToast();

  // Fetch delivered shipments from API
  ReactEffect(() => {
    const fetchDeliveredShipments = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/shipments?status=Delivered&limit=50');
        if (response.ok) {
          const data = await response.json();
          console.log('Fetched delivered shipments:', data);
          setDeliveredShipments(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error fetching delivered shipments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeliveredShipments();
  }, []);

  // Check for delivered shipment data from sessionStorage (from shipment tracking page)
  ReactEffect(() => {
    const storedData = sessionStorage.getItem('deliveredShipmentData');
    if (storedData) {
      try {
        const shipmentData = JSON.parse(storedData);
        console.log('Received delivered shipment data:', shipmentData);
        
        // Add to the list if not already present
        setDeliveredShipments(prev => {
          const exists = prev.some(s => s.id === shipmentData.shipmentId);
          if (!exists) {
            return [shipmentData, ...prev];
          }
          return prev;
        });
        
        // Clear the stored data
        sessionStorage.removeItem('deliveredShipmentData');
      } catch (error) {
        console.error('Error parsing delivered shipment data:', error);
      }
    }
  }, []);

  // Fetch supplier/carrier details
  const fetchSupplierDetails = async (supplierId: string) => {
    if (supplierDetails[supplierId]) return supplierDetails[supplierId];
    
    try {
      // Try suppliers endpoint first, then carriers if not found
      let response = await fetch(`/api/suppliers/${supplierId}`);
      if (!response.ok) {
        response = await fetch(`/api/carriers/${supplierId}`);
      }
      
      if (response.ok) {
        const supplier = await response.json();
        setSupplierDetails(prev => ({ ...prev, [supplierId]: supplier }));
        return supplier;
      }
    } catch (error) {
      console.error('Error fetching supplier/carrier details:', error);
    }
    return null;
  };

  // Fetch customer details
  const fetchCustomerDetails = async (customerName: string) => {
    if (customerDetails[customerName]) return customerDetails[customerName];
    
    try {
      const response = await fetch(`/api/customers?search=${encodeURIComponent(customerName)}`);
      if (response.ok) {
        const customers = await response.json();
        const customer = customers.find((c: any) => c.name === customerName);
        if (customer) {
          setCustomerDetails(prev => ({ ...prev, [customerName]: customer }));
          return customer;
        }
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
    }
    return null;
  };

  const handleGenerateGoodsReceipt = async (shipment: any) => {
    try {
      // Check if supplier ID is available, or use carrier as supplier
      let supplierId = shipment.supplierId || shipment.supplier?.id;
      let supplierName = shipment.supplierName || shipment.supplier?.name;
      
      // If no supplier ID, try to use carrier as supplier
      if (!supplierId && shipment.carrierId) {
        supplierId = shipment.carrierId;
        supplierName = shipment.carrierName || shipment.carrier?.name;
      }
      
      if (!supplierId) {
        toast({
          title: "Missing Supplier Information",
          description: "This shipment doesn't have supplier or carrier information. Cannot create goods receipt.",
          variant: "destructive",
        });
        return;
      }

      // Generate receipt number
      const receiptNumber = `GRN-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
      
      // Prepare goods receipt header data
      const goodsReceiptHeader = {
        receiptNumber: receiptNumber,
        supplierLpoId: shipment.lpoId || null,
        supplierId: supplierId,
        receiptDate: new Date().toISOString().split('T')[0],
        expectedDeliveryDate: shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        actualDeliveryDate: shipment.actualDelivery ? new Date(shipment.actualDelivery).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        receivedBy: 'system',
        status: 'Draft',
        notes: `Generated from shipment ${shipment.shipmentNumber || shipment.trackingNumber}. ${supplierName ? `Supplier: ${supplierName}` : 'Carrier: ' + (shipment.carrierName || 'Unknown')}. Customer: ${shipment.customerName || 'Unknown'}.${shipment.lpoNumber ? ` LPO: ${shipment.lpoNumber}` : ''}${shipment.declaredValue ? ` Value: ${shipment.currency || 'BHD'} ${parseFloat(shipment.declaredValue).toLocaleString()}` : ''}.`,
        lpoNumber: shipment.lpoNumber || null,
        totalItems: shipment.items?.length || 0,
        totalQuantityExpected: shipment.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0,
        totalQuantityReceived: 0,
        discrepancyFlag: false
      };

      // Prepare goods receipt items from shipment items
      let goodsReceiptItems = (shipment.items || []).map((item: any, index: number) => ({
        itemDescription: item.itemDescription || item.description || `Item ${index + 1}`,
        quantityExpected: item.quantity || 0,
        quantityReceived: item.quantity || 0,
        unitCost: item.unitCost || item.unitPrice || "0.00",
        totalCost: ((item.quantity || 0) * parseFloat(item.unitCost || item.unitPrice || "0")).toString(),
        supplierCode: item.supplierCode || item.supplier_code || "",
        barcode: item.barcode || "",
        itemId: item.itemId || null,
        lpoItemId: item.lpoItemId || null,
        storageLocation: "MAIN",
        condition: "Good",
        notes: item.notes || ""
      }));

      // If no items in shipment, create a placeholder item
      if (goodsReceiptItems.length === 0) {
        goodsReceiptItems = [{
          itemDescription: `Shipment from ${shipment.carrierName || 'Unknown Carrier'}`,
          quantityExpected: 1,
          quantityReceived: 1,
          unitCost: shipment.declaredValue || "0.00",
          totalCost: shipment.declaredValue || "0.00",
          supplierCode: "",
          barcode: "",
          itemId: null,
          lpoItemId: null,
          storageLocation: "MAIN",
          condition: "Good",
          notes: `Generated from shipment ${shipment.shipmentNumber || shipment.trackingNumber}`
        }];
      }

      console.log('Creating goods receipt with items:', { header: goodsReceiptHeader, items: goodsReceiptItems });

      // Call the batch create mutation with header and items
      await createGoodsReceipt.mutateAsync({
        header: goodsReceiptHeader,
        items: goodsReceiptItems
      });

      // Show success notification
      toast({
        title: "Goods Receipt Generated",
        description: `Goods receipt created successfully for shipment ${shipment.shipmentNumber || shipment.trackingNumber}`,
      });

      // Remove the shipment from the delivered shipments list
      setDeliveredShipments(prev => prev.filter(s => s.id !== shipment.id && s.shipmentId !== shipment.id && s.shipmentId !== shipment.shipmentId));

    } catch (error) {
      console.error('Error generating goods receipt:', error);
      const errorMessage = (error as any)?.message || "Failed to generate goods receipt. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="h-8 w-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-600">Loading delivered shipments...</p>
      </div>
    );
  }

  if (!deliveredShipments || deliveredShipments.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Truck className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">No Delivered Shipments</h4>
            <p className="text-gray-600">There are no delivered shipments ready for goods receipt generation.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deliveredShipments.slice(0, 3).map((shipment: any) => {
        const isExpanded = expandedShipment === (shipment.shipmentId || shipment.id);
        const supplier = supplierDetails[shipment.supplierId] || null;
        const customer = customerDetails[shipment.customerName] || null;
        
        return (
          <div key={shipment.shipmentId || shipment.id} className="bg-white border border-green-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span className="text-xs font-medium text-green-700">Delivered</span>
                    </div>
                    <span className="text-xs text-gray-500">•</span>
                    <h4 className="text-sm font-semibold text-gray-800 truncate">
                      {shipment.shipmentNumber || shipment.trackingNumber}
                    </h4>
                    <span className="text-xs text-gray-500">•</span>
                    <span className="text-xs font-medium text-gray-600 truncate">
                      {shipment.supplierName || shipment.carrierName || 'Unknown Supplier'}
                    </span>
                    {shipment.trackingNumber && shipment.trackingNumber !== shipment.shipmentNumber && (
                      <>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-blue-600 font-mono">
                          {shipment.trackingNumber}
                        </span>
                      </>
                    )}
                  </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-1">
                            <div className="flex items-center gap-1">
                              <Package className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">Customer:</span> {shipment.customerName || 'Unknown'}
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">LPO Value:</span> {shipment.currency || 'BHD'} {parseFloat(shipment.declaredValue || '0').toLocaleString()}
                            </div>
                            <div className="flex items-center gap-1">
                              <Truck className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">Items:</span> {shipment.items?.length || 0} items
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">Delivered:</span> {shipment.actualDelivery ? new Date(shipment.actualDelivery).toLocaleDateString() : 'Not set'}
                            </div>
                            {shipment.lpoNumber && (
                              <div className="flex items-center gap-1">
                                <Package className="h-3 w-3 text-gray-400" />
                                <span className="font-medium">LPO:</span> {shipment.lpoNumber}
                              </div>
                            )}
                    {shipment.carrierName && (
                      <div className="flex items-center gap-1">
                        <Truck className="h-3 w-3 text-gray-400" />
                        <span className="font-medium">Carrier:</span> {shipment.carrierName}
                      </div>
                    )}
                    {shipment.origin && shipment.destination && (
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3 text-gray-400" />
                        <span className="font-medium">Route:</span> {shipment.origin} → {shipment.destination}
                      </div>
                    )}
                  </div>
                  
                  {/* Items Preview */}
                  {shipment.items && shipment.items.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">Items:</div>
                      <div className="space-y-1 max-h-16 overflow-y-auto">
                        {shipment.items.slice(0, 3).map((item: any, index: number) => (
                          <div key={index} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                            <span className="font-medium">{item.quantity || 1}x</span> {item.itemDescription || 'Item'}
                            {item.unitCost && (
                              <span className="ml-2 text-gray-500">
                                @ {shipment.currency || 'BHD'} {parseFloat(item.unitCost).toLocaleString()}
                              </span>
                            )}
                          </div>
                        ))}
                        {shipment.items.length > 3 && (
                          <div className="text-xs text-gray-400 italic">
                            +{shipment.items.length - 3} more items
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                              {/* Supplier/Carrier Details */}
                              {(shipment.supplierId || shipment.carrierId) && (
                                <div className="bg-blue-50 rounded-lg p-3">
                                  <h5 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                                    <Truck className="h-4 w-4" />
                                    {shipment.supplierId ? 'Supplier' : 'Carrier'} Information
                                  </h5>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="font-medium text-blue-700">Name:</span> {supplier?.name || shipment.supplierName || shipment.carrierName || 'Unknown'}
                                    </div>
                                    <div>
                                      <span className="font-medium text-blue-700">Email:</span> {supplier?.email || 'N/A'}
                                    </div>
                                    <div>
                                      <span className="font-medium text-blue-700">Phone:</span> {supplier?.phone || 'N/A'}
                                    </div>
                                    <div>
                                      <span className="font-medium text-blue-700">Address:</span> {supplier?.address || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              )}

                      {/* Customer Details */}
                      {shipment.customerName && (
                        <div className="bg-purple-50 rounded-lg p-3">
                          <h5 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Customer Information
                          </h5>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="font-medium text-purple-700">Name:</span> {customer?.name || shipment.customerName}
                            </div>
                            <div>
                              <span className="font-medium text-purple-700">Email:</span> {customer?.email || 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium text-purple-700">Phone:</span> {customer?.phone || 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium text-purple-700">Address:</span> {customer?.address || 'N/A'}
                            </div>
                          </div>
                        </div>
                      )}

                              {/* LPO Information */}
                              {shipment.lpoNumber && (
                                <div className="bg-green-50 rounded-lg p-3">
                                  <h5 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    LPO Information
                                  </h5>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="font-medium text-green-700">LPO Number:</span> {shipment.lpoNumber}
                                    </div>
                                    <div>
                                      <span className="font-medium text-green-700">LPO Value:</span> {shipment.currency || 'BHD'} {parseFloat(shipment.declaredValue || '0').toLocaleString()}
                                    </div>
                                    {shipment.lpoId && (
                                      <div className="col-span-2">
                                        <span className="font-medium text-green-700">LPO ID:</span> {shipment.lpoId}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Detailed Items */}
                              {shipment.items && shipment.items.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <h5 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Items Details ({shipment.items.length} items)
                                    {shipment.lpoNumber && (
                                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                        LPO: {shipment.lpoNumber}
                                      </span>
                                    )}
                                  </h5>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {shipment.items.map((item: any, index: number) => (
                              <div key={index} className="bg-white rounded p-2 border border-gray-200">
                                <div className="flex justify-between items-start mb-1">
                                  <div className="font-medium text-sm text-gray-800">
                                    {item.itemDescription || 'Item'}
                                  </div>
                                  <div className="text-sm font-semibold text-green-700">
                                    {shipment.currency || 'BHD'} {parseFloat(item.totalCost || '0').toLocaleString()}
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                                  <div>
                                    <span className="font-medium">Qty:</span> {item.quantity || 1} {item.unitOfMeasure || 'pcs'}
                                  </div>
                                  <div>
                                    <span className="font-medium">Unit Cost:</span> {shipment.currency || 'BHD'} {parseFloat(item.unitCost || '0').toLocaleString()}
                                  </div>
                                  <div>
                                    <span className="font-medium">Code:</span> {item.supplierCode || item.barcode || 'N/A'}
                                  </div>
                                </div>
                                {shipment.lpoNumber && (
                                  <div className="mt-1 text-xs text-blue-600 font-medium">
                                    <span className="font-medium">LPO:</span> {shipment.lpoNumber}
                                  </div>
                                )}
                                {item.specialInstructions && (
                                  <div className="mt-1 text-xs text-gray-500 italic">
                                    Note: {item.specialInstructions}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs px-2 py-1"
                  onClick={() => {
                    const shipmentId = shipment.shipmentId || shipment.id;
                    if (isExpanded) {
                      setExpandedShipment(null);
                            } else {
                              setExpandedShipment(shipmentId);
                              // Fetch additional details when expanding
                              if (shipment.supplierId || shipment.carrierId) {
                                fetchSupplierDetails(shipment.supplierId || shipment.carrierId);
                              }
                              if (shipment.customerName) {
                                fetchCustomerDetails(shipment.customerName);
                              }
                            }
                  }}
                >
                  {isExpanded ? 'Less' : 'More'} Details
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-md font-medium text-xs flex-shrink-0"
                  onClick={() => handleGenerateGoodsReceipt(shipment)}
                >
                  + Generate Goods Receipt
                </Button>
              </div>
            </div>
          </div>
        );
      })}
      
      {deliveredShipments.length > 3 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-blue-700">
            <Package className="h-4 w-4" />
            <span className="text-sm font-medium">
              {deliveredShipments.length - 3} more delivered shipments available
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoodsReceipt() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLpo, setSelectedLpo] = useState<any>(null);
  const [receiptData, setReceiptData] = useState({
    storageLocation: "",
    notes: "",
    items: [] as any[],
  });
  // Dialog state for view/delete/status change actions on Goods Receipt Header
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: supplierLpos, isLoading } = useQuery({
    queryKey: ["/api/supplier-lpos"],
  });

  const { data: goodsReceipts } = useQuery({
    queryKey: ["/api/goods-receipt-headers"],
  });

  // Mutation for deleting a goods receipt header
  const deleteGoodsReceipt = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/goods-receipt-headers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goods-receipt-headers"] });
      setDeleteDialogOpen(false);
      setSelectedReceipt(null);
      toast({ title: "Deleted", description: "Goods receipt deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete goods receipt", variant: "destructive" });
    },
  });

  const createGoodsReceipt = useMutation({
    mutationFn: async (data: any) => {
      // If data has header and items, use the batch endpoint
      if (data.header && data.items) {
        return await apiRequest("POST", "/api/goods-receipts", data);
      }
      // Otherwise use the header-only endpoint
      return await apiRequest("POST", "/api/goods-receipt-headers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goods-receipt-headers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-lpos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: "Success",
        description: "Goods receipt created successfully",
      });
      setSelectedLpo(null);
      setReceiptData({ storageLocation: "", notes: "", items: [] });
    },
    onError: (error: any) => {
      console.error("Error creating goods receipt:", error);
      toast({
        title: "Error",
        description: "Failed to create goods receipt",
        variant: "destructive",
      });
    },
  });


  // Mutation for approving goods receipt
  const approveGoodsReceipt = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/goods-receipt-headers/${id}/approve`, { approvedBy: "current_user" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goods-receipt-headers"] });
      toast({ title: "Success", description: "Goods receipt approved successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve goods receipt", variant: "destructive" });
    },
  });

  // Mutation for updating goods receipt status
  const updateGoodsReceiptStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/goods-receipt-headers/${id}/status`, { status });
    },
    onSuccess: async (_, { id, status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/goods-receipt-headers"] });
      
      // If status is "Complete", create a purchase invoice
      if (status === "Complete") {
        try {
          // Get the goods receipt details to create purchase invoice
          const response = await apiRequest("GET", `/api/goods-receipt-headers/${id}`);
          const goodsReceipt = await response.json();
          
          if (goodsReceipt) {
            // Generate invoice number
            const invoiceNumber = `PI-${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
            
            // Prepare purchase invoice data
            const purchaseInvoiceData = {
              invoiceNumber: invoiceNumber,
              supplierId: goodsReceipt.supplierId,
              goodsReceiptId: goodsReceipt.id,
              lpoId: goodsReceipt.supplierLpoId || undefined,
              status: "Draft",
              paymentStatus: "Unpaid",
              invoiceDate: new Date().toISOString().split('T')[0],
              dueDate: goodsReceipt.expectedDeliveryDate || new Date().toISOString().split('T')[0],
              receivedDate: goodsReceipt.actualDeliveryDate || new Date().toISOString().split('T')[0],
              subtotal: goodsReceipt.totalItems ? (goodsReceipt.totalItems * 100).toString() : "0.00", // Placeholder calculation
              taxAmount: "0.00",
              discountAmount: "0.00",
              totalAmount: goodsReceipt.totalItems ? (goodsReceipt.totalItems * 100).toString() : "0.00", // Placeholder calculation
              paidAmount: "0.00",
              remainingAmount: goodsReceipt.totalItems ? (goodsReceipt.totalItems * 100).toString() : "0.00", // Placeholder calculation
              currency: "BHD",
              paymentTerms: goodsReceipt.notes || "",
              notes: `Generated from completed goods receipt ${goodsReceipt.receiptNumber}. LPO: ${goodsReceipt.lpoNumber || 'N/A'}`,
              attachments: [],
              isRecurring: false
            };

            // Fetch goods receipt items to include in purchase invoice
            console.log('Fetching goods receipt items for ID:', goodsReceipt.id);
            const itemsResponse = await apiRequest("GET", `/api/goods-receipt-headers/${goodsReceipt.id}/items`);
            
            if (!itemsResponse.ok) {
              throw new Error(`Failed to fetch goods receipt items: ${itemsResponse.status} ${itemsResponse.statusText}`);
            }
            
            const goodsReceiptItems = await itemsResponse.json();
            console.log('Fetched goods receipt items:', goodsReceiptItems);
            
            // Calculate totals from actual items
            let subtotal = 0;
            let totalAmount = 0;
            const purchaseInvoiceItems = goodsReceiptItems.map((item: any) => {
              const unitPrice = parseFloat(item.unitCost || "0");
              const quantity = item.quantityReceived || item.quantityExpected || 0;
              const totalPrice = unitPrice * quantity;
              subtotal += totalPrice;
              
              return {
                goodsReceiptItemId: item.id,
                lpoItemId: item.lpoItemId,
                itemId: item.itemId,
                variantId: item.variantId,
                barcode: item.barcode,
                supplierCode: item.supplierCode,
                itemDescription: item.itemDescription,
                quantity: quantity,
                unitPrice: unitPrice.toString(),
                totalPrice: totalPrice.toString(),
                taxRate: "0",
                taxAmount: "0",
                discountRate: "0",
                discountAmount: "0",
                unitOfMeasure: item.unitOfMeasure,
                storageLocation: item.storageLocation,
                batchNumber: item.batchNumber,
                expiryDate: item.expiryDate || undefined,
                condition: item.condition || "Good",
                notes: item.discrepancyReason
              };
            });
            
            totalAmount = subtotal; // For now, no tax or discount
            
            // Update purchase invoice data with calculated totals
            const updatedPurchaseInvoiceData = {
              ...purchaseInvoiceData,
              subtotal: subtotal.toString(),
              totalAmount: totalAmount.toString(),
              remainingAmount: totalAmount.toString()
            };

            // Validate data before creating purchase invoice
            if (!updatedPurchaseInvoiceData.supplierId) {
              throw new Error('Missing supplier ID for purchase invoice');
            }
            if (!updatedPurchaseInvoiceData.goodsReceiptId) {
              throw new Error('Missing goods receipt ID for purchase invoice');
            }
            if (purchaseInvoiceItems.length === 0) {
              throw new Error('No items found to create purchase invoice');
            }
            
            // Validate each item
            for (const item of purchaseInvoiceItems) {
              if (!item.itemDescription) {
                throw new Error('Item description is required for all items');
              }
              if (!item.quantity || item.quantity <= 0) {
                throw new Error('Valid quantity is required for all items');
              }
              if (!item.unitPrice || parseFloat(item.unitPrice) < 0) {
                throw new Error('Valid unit price is required for all items');
              }
            }

            // Create purchase invoice with items
            console.log('Creating purchase invoice with data:', {
              invoice: updatedPurchaseInvoiceData,
              items: purchaseInvoiceItems
            });
            
            const invoiceResponse = await apiRequest("POST", "/api/purchase-invoices", {
              invoice: updatedPurchaseInvoiceData,
              items: purchaseInvoiceItems
            });
            
            if (!invoiceResponse.ok) {
              const errorData = await invoiceResponse.json();
              throw new Error(`Purchase invoice creation failed: ${errorData.message || 'Unknown error'}`);
            }
            
            const createdInvoice = await invoiceResponse.json();
            
            // Invalidate purchase invoices query to refresh the data
            queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
            // Also invalidate any queries that might have different filter parameters
            queryClient.invalidateQueries({ 
              predicate: (query) => query.queryKey[0] === "/api/purchase-invoices" 
            });
            // Force refetch of purchase invoices data
            queryClient.refetchQueries({ 
              queryKey: ["/api/purchase-invoices"] 
            });
            
            toast({ 
              title: "Success", 
              description: `Goods receipt completed and purchase invoice ${invoiceNumber} created successfully` 
            });
          }
        } catch (error) {
          console.error("Error creating purchase invoice:", error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          toast({ 
            title: "Warning", 
            description: `Goods receipt completed but failed to create purchase invoice: ${errorMessage}`, 
            variant: "destructive" 
          });
        }
      } else {
        toast({ title: "Success", description: "Goods receipt status updated successfully" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update goods receipt status", variant: "destructive" });
    },
  });


  // Filter for confirmed supplier LPOs ready for goods receipt
  const lposArray =
    supplierLpos && typeof supplierLpos === "object" && "data" in supplierLpos && Array.isArray((supplierLpos as any).data)
      ? (supplierLpos as any).data
      : Array.isArray(supplierLpos)
      ? supplierLpos
      : [];
  const confirmedLpos = lposArray.filter((lpo: any) => lpo.status === "Confirmed");
  
  const filteredLpos = confirmedLpos?.filter((lpo: any) =>
    lpo.lpoNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lpo.supplierName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: Column<any>[] = [
    {
      key: "lpoNumber",
      header: "LPO Number",
      render: (value: string) => (
        <span className="font-mono text-sm text-blue-600 font-medium">{value}</span>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (supplier: any) => (
        <div>
          <p className="text-sm font-medium text-gray-900">
            {supplier?.name || "Unknown Supplier"}
          </p>
          <p className="text-xs text-gray-600">
            {supplier?.contactPerson || "-"}
          </p>
        </div>
      ),
    },
    {
      key: "totalAmount",
      header: "LPO Value",
      render: (value: number) => value ? formatCurrency(value) : "-",
      className: "text-right",
    },
    {
      key: "expectedDeliveryDate",
      header: "Expected Delivery",
      render: (value: string) => {
        const isOverdue = value && new Date(value) < new Date();
        return (
          <div className={isOverdue ? "text-red-600" : ""}>
            {value ? formatDate(value) : "-"}
            {isOverdue && <span className="ml-1 text-xs">(Overdue)</span>}
          </div>
        );
      },
    },
    {
      key: "receiptStatus",
      header: "Receipt Status",
      render: (_, lpo: any) => {
        const receipt = (Array.isArray(goodsReceipts) ? goodsReceipts : []).find((gr: any) => gr.supplierLpoId === lpo.id);
        if (!receipt) {
          return (
            <Badge variant="outline" className="text-orange-600">
              <Package className="h-3 w-3 mr-1" />
              Pending Receipt
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className={getStatusColor(receipt.status)}>
            {receipt.status}
          </Badge>
        );
      },
    },
    {
      key: "lpoDate",
      header: "LPO Date",
      render: (value: string) => formatDate(value),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_, lpo: any) => {
        const receipt = (Array.isArray(goodsReceipts) ? goodsReceipts : []).find((gr: any) => gr.supplierLpoId === lpo.id);
        return (
          <div className="flex items-center space-x-2">
            {!receipt && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLpo(lpo);
                  // Initialize receipt data with LPO items
                  setReceiptData({
                    storageLocation: "",
                    notes: "",
                    items: lpo.items?.map((item: any) => ({
                      ...item,
                      receivedQuantity: item.quantity,
                      damagedQuantity: 0,
                    })) || [],
                  });
                }}
                data-testid={`button-receive-${lpo.id}`}
              >
                <Package className="h-4 w-4 mr-1" />
                Receive Goods
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                console.log("View LPO details:", lpo);
              }}
              data-testid={`button-view-${lpo.id}`}
            >
              <Scan className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const receiptStats = {
    pending: confirmedLpos?.filter((lpo: any) => 
      !(Array.isArray(goodsReceipts) ? goodsReceipts : [])?.some((gr: any) => gr.supplierLpoId === lpo.id)
    ).length || 0,
    partial: (Array.isArray(goodsReceipts) ? goodsReceipts : [])?.filter((gr: any) => gr.status === "Partial").length || 0,
    completed: (Array.isArray(goodsReceipts) ? goodsReceipts : [])?.filter((gr: any) => gr.status === "Complete").length || 0,
    approved: (Array.isArray(goodsReceipts) ? goodsReceipts : [])?.filter((gr: any) => gr.status === "Approved").length || 0,
    discrepancy: (Array.isArray(goodsReceipts) ? goodsReceipts : [])?.filter((gr: any) => gr.status === "Discrepancy").length || 0,
  };

  const handleItemQuantityChange = (index: number, field: string, value: number) => {
    const updatedItems = [...receiptData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setReceiptData({ ...receiptData, items: updatedItems });
  };

  const processGoodsReceipt = () => {
    if (!selectedLpo || !receiptData.storageLocation.trim()) {
      toast({
        title: "Error",
        description: "Please provide storage location",
        variant: "destructive",
      });
      return;
    }

    const hasDiscrepancy = receiptData.items.some(item => 
      item.receivedQuantity !== item.quantity || item.damagedQuantity > 0
    );

    const status = hasDiscrepancy ? "Discrepancy" : "Complete";

    createGoodsReceipt.mutate({
      supplierLpoId: selectedLpo.id,
      storageLocation: receiptData.storageLocation,
      notes: receiptData.notes,
      status,
      items: receiptData.items,
    });
  };

  return (
    <div>
      {/* Enhanced Card-style header with orange theme */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-hidden mb-6">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-bl from-orange-50/50 to-transparent rounded-bl-full"></div>
        <div className="absolute bottom-0 left-0 w-48 h-24 bg-gradient-to-tr from-orange-100/30 to-transparent rounded-tr-full"></div>
        <div className="relative px-8 py-6 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg border border-orange-100">
                <Truck className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-black mb-1" data-testid="text-page-title">
                  Goods Receipt
                </h2>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                    <Package className="h-3 w-3 mr-1" />
                    Step 7
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                    <span className="text-gray-600 text-sm font-medium">
                      Processing incoming shipments
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-gray-600 text-base max-w-2xl leading-relaxed">
              Receive and validate goods against supplier LPOs with barcode scanning and quality control
            </p>
          </div>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mt-1">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Pending Receipt</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="stat-pending-receipt">
                  {receiptStats.pending}
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  Confirmed LPOs awaiting receipt
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mt-1">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Partial Receipt</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-partial-receipt">
                  {receiptStats.partial}
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  Partially received shipments
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mt-1">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Complete Receipt</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-complete-receipt">
                  {receiptStats.completed}
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  Fully received shipments
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mt-1">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Approved</p>
                <p className="text-2xl font-bold text-emerald-600" data-testid="stat-approved-receipt">
                  {receiptStats.approved}
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  Approved receipts
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mt-1">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Discrepancies</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-discrepancy-receipt">
                  {receiptStats.discrepancy}
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  Receipts with issues
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deliveries Ready for Goods Receipt */}
      <Card className="bg-gradient-to-br from-green-50 via-white to-green-50 border-green-200 shadow-lg mb-6">
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Truck className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Deliveries Ready for Goods Receipt</h3>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DeliveredShipmentsSection createGoodsReceipt={createGoodsReceipt} />
        </CardContent>
      </Card>

      {/* Goods Receipt Table - Goods Receipt Headers (single table only) */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Goods Receipt Headers</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={Array.isArray(goodsReceipts) ? goodsReceipts : []}
            columns={[
              {
                key: "receiptNumber",
                header: "Receipt Number",
                render: (v: any, row: any) => <span className="font-mono text-xs">{v || row.id}</span>
              },
              {
                key: "supplierName",
                header: "Supplier Name",
                render: (v: any, row: any) => {
                  return (
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {row.supplierName || "Unknown Supplier"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.supplierId ? `ID: ${row.supplierId.slice(0, 8)}...` : ""}
                      </div>
                    </div>
                  );
                }
              },
              {
                key: "lpoNumber",
                header: "LPO Number",
                render: (v: any, row: any) => {
                  return (
                    <div className="text-sm">
                      <div className="font-mono text-blue-600 font-medium">
                        {row.lpoNumber || v || row.supplierLpoId || "N/A"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.lpoDate ? formatDate(row.lpoDate) : ""}
                      </div>
                    </div>
                  );
                }
              },
              { key: "storageLocation", header: "Storage Location" },
              {
                key: "lpoValue",
                header: "LPO Value",
                render: (v: any, row: any) => {
                  return (
                    <div className="text-sm text-right">
                      <div className="font-medium text-gray-900">
                        {row.lpoTotalAmount ? formatCurrency(parseFloat(row.lpoTotalAmount)) : "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.lpoCurrency || ""}
                      </div>
                    </div>
                  );
                }
              },
              { key: "status", header: "Status", render: (v: any) => {
           let color = "bg-gray-100 text-gray-700 border-gray-300";
           if (v === "Draft") color = "bg-yellow-100 text-yellow-700 border-yellow-300";
           else if (v === "Pending") color = "bg-gray-100 text-gray-700 border-gray-300";
           else if (v === "Partial") color = "bg-blue-100 text-blue-700 border-blue-300";
           else if (v === "Complete" || v === "Completed") color = "bg-green-100 text-green-700 border-green-300";
           else if (v === "Approved") color = "bg-emerald-100 text-emerald-700 border-emerald-300";
           else if (v === "Discrepancy") color = "bg-red-100 text-red-700 border-red-300";
           return <Badge variant="outline" className={color}>{v}</Badge>;
              } },
              { key: "createdAt", header: "Created At", render: (v: any) => v ? formatDate(v) : "-" },
              {
                key: "actions",
                header: "Actions",
                render: (_: any, row: any) => (
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" onClick={() => { setSelectedReceipt(row); setViewDialogOpen(true); }} title="View">
                      <Eye className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setSelectedReceipt(row); setStatusChangeDialogOpen(true); }} title="Change Status">
                      <Clock className="h-4 w-4 text-purple-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setSelectedReceipt(row); setDeleteDialogOpen(true); }} title="Delete">
                      <Trash className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ),
              },
            ]}
            isLoading={isLoading}
            emptyMessage="No goods receipt headers found."
          />
        </CardContent>
      </Card>
      {/* Dialogs for view/edit/delete actions */}
      <Dialog open={viewDialogOpen} onOpenChange={(open) => { setViewDialogOpen(open); if (!open) setSelectedReceipt(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-5 w-5 text-blue-600" />
              <DialogTitle className="text-blue-700">Goods Receipt Details</DialogTitle>
            </div>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4 p-2">
              <div className="grid grid-cols-2 gap-4 bg-blue-50 rounded p-3 mb-2">
                <div><span className="font-semibold text-gray-700">Receipt Number:</span> <span className="font-mono">{selectedReceipt.receiptNumber || selectedReceipt.id}</span></div>
                <div><span className="font-semibold text-gray-700">LPO Number:</span> <span className="font-mono text-blue-600">{selectedReceipt.lpoNumber || selectedReceipt.supplierLpoId || "N/A"}</span></div>
                <div><span className="font-semibold text-gray-700">LPO ID:</span> <span className="font-mono">{selectedReceipt.supplierLpoId}</span></div>
                <div><span className="font-semibold text-gray-700">Supplier Name:</span> <span className="font-mono">{selectedReceipt.supplierName || "Unknown Supplier"}</span></div>
                <div><span className="font-semibold text-gray-700">Storage Location:</span> <span className="font-mono">{selectedReceipt.storageLocation || "-"}</span></div>
                <div><span className="font-semibold text-gray-700">LPO Value:</span> <span className="font-mono">{
                  selectedReceipt.lpoTotalAmount ? `${formatCurrency(parseFloat(selectedReceipt.lpoTotalAmount))} ${selectedReceipt.lpoCurrency || ''}` : "-"
                }</span></div>
                <div><span className="font-semibold text-gray-700">Status:</span> {
                  (() => {
                    let color = "bg-gray-100 text-gray-700 border-gray-300";
                    const v = selectedReceipt.status;
                    if (v === "Draft") color = "bg-yellow-100 text-yellow-700 border-yellow-300";
                    else if (v === "Pending") color = "bg-gray-100 text-gray-700 border-gray-300";
                    else if (v === "Partial") color = "bg-blue-100 text-blue-700 border-blue-300";
                    else if (v === "Complete" || v === "Completed") color = "bg-green-100 text-green-700 border-green-300";
                    else if (v === "Approved") color = "bg-emerald-100 text-emerald-700 border-emerald-300";
                    else if (v === "Discrepancy") color = "bg-red-100 text-red-700 border-red-300";
                    return <Badge className={color}>{v || selectedReceipt.id}</Badge>;
                  })()
                }</div>
                <div><span className="font-semibold text-gray-700">Created At:</span> <span className="font-mono">{selectedReceipt.createdAt ? formatDate(selectedReceipt.createdAt) : "-"}</span></div>
                <div><span className="font-semibold text-gray-700">Updated At:</span> <span className="font-mono">{selectedReceipt.updatedAt ? formatDate(selectedReceipt.updatedAt) : "-"}</span></div>
                <div><span className="font-semibold text-gray-700">Notes:</span> <span className="font-mono">{selectedReceipt.notes || "-"}</span></div>
              </div>
              {Array.isArray(selectedReceipt.items) && selectedReceipt.items.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Items</div>
                  <ul className="text-xs bg-white rounded border p-2">
                    {selectedReceipt.items.map((item: any, idx: number) => (
                      <li key={idx} className="mb-1 flex gap-2 items-center">
                        <Package className="h-3 w-3 text-orange-500" />
                        <span className="font-mono">{item.barcode || item.id}</span> — {item.description || item.itemId || item.id} (Qty: {item.quantity})
                        {selectedReceipt.lpoNumber && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                            LPO: {selectedReceipt.lpoNumber}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setSelectedReceipt(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Trash className="h-5 w-5 text-red-600" />
              <DialogTitle className="text-red-700">Delete Goods Receipt</DialogTitle>
            </div>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4 p-2">
              <div className="bg-red-50 rounded p-2 text-sm text-red-700 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Are you sure you want to delete this goods receipt?
              </div>
              <div className="text-xs text-gray-500">Receipt ID: <span className="font-mono">{selectedReceipt.id}</span></div>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" type="button" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  type="button"
                  onClick={() => deleteGoodsReceipt.mutate(selectedReceipt.id)}
                  disabled={deleteGoodsReceipt.isPending}
                >
                  {deleteGoodsReceipt.isPending ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusChangeDialogOpen} onOpenChange={(open) => { setStatusChangeDialogOpen(open); if (!open) setSelectedReceipt(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <DialogTitle className="text-purple-700">Change Status</DialogTitle>
            </div>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="bg-purple-50 rounded p-3 mb-4">
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Receipt Number:</span> {selectedReceipt.receiptNumber || selectedReceipt.id}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Current Status:</span> 
                  <Badge variant="outline" className="ml-2">
                    {selectedReceipt.status}
                  </Badge>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
                <select
                  className="w-full border rounded px-3 py-2 bg-white"
                  value={selectedReceipt.status || ""}
                  onChange={e => setSelectedReceipt({ ...selectedReceipt, status: e.target.value })}
                >
                  <option value="Draft">Draft</option>
                  <option value="Pending">Pending</option>
                  <option value="Partial">Partial</option>
                  <option value="Complete">Complete</option>
                  <option value="Approved">Approved</option>
                  <option value="Discrepancy">Discrepancy</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" type="button" onClick={() => setStatusChangeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    updateGoodsReceiptStatus.mutate({ 
                      id: selectedReceipt.id, 
                      status: selectedReceipt.status 
                    });
                    setStatusChangeDialogOpen(false);
                  }}
                  disabled={updateGoodsReceiptStatus.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {updateGoodsReceiptStatus.isPending ? "Updating..." : "Update Status"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Goods Receipt Dialog */}
      <Dialog open={!!selectedLpo} onOpenChange={() => setSelectedLpo(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Goods Receipt</DialogTitle>
          </DialogHeader>
          {selectedLpo && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">LPO Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">LPO Number:</span> {selectedLpo.lpoNumber}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Supplier:</span> {selectedLpo.supplier?.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Expected Delivery:</span> {selectedLpo.expectedDeliveryDate ? formatDate(selectedLpo.expectedDeliveryDate) : "N/A"}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">LPO Value:</span> {formatCurrency(selectedLpo.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Storage Location <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter storage location..."
                    value={receiptData.storageLocation}
                    onChange={(e) => setReceiptData({ ...receiptData, storageLocation: e.target.value })}
                    data-testid="input-storage-location"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Receipt Notes
                  </label>
                  <Input
                    type="text"
                    placeholder="Additional notes..."
                    value={receiptData.notes}
                    onChange={(e) => setReceiptData({ ...receiptData, notes: e.target.value })}
                    data-testid="input-receipt-notes"
                  />
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-4">Items Receipt Verification</h4>
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-6 gap-4 p-3 bg-gray-50 border-b text-sm font-medium text-gray-700">
                    <div>Item</div>
                    <div>Barcode</div>
                    <div>Ordered Qty</div>
                    <div>Received Qty</div>
                    <div>Damaged Qty</div>
                    <div>Status</div>
                  </div>
                  {receiptData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-6 gap-4 p-3 border-b items-center">
                      <div className="text-sm">{item.description || item.itemId}</div>
                      <div className="text-xs font-mono">{item.barcode || "N/A"}</div>
                      <div className="text-sm font-medium">{item.quantity}</div>
                      <div>
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={item.receivedQuantity}
                          onChange={(e) => handleItemQuantityChange(index, "receivedQuantity", parseInt(e.target.value) || 0)}
                          className="w-20"
                          data-testid={`input-received-qty-${index}`}
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          min="0"
                          max={item.receivedQuantity}
                          value={item.damagedQuantity}
                          onChange={(e) => handleItemQuantityChange(index, "damagedQuantity", parseInt(e.target.value) || 0)}
                          className="w-20"
                          data-testid={`input-damaged-qty-${index}`}
                        />
                      </div>
                      <div>
                        {item.receivedQuantity === item.quantity && item.damagedQuantity === 0 ? (
                          <Badge className="underline decoration-green-500 text-green-700">
                            <Check className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        ) : (
                          <Badge className="underline decoration-orange-500 text-orange-700">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Discrepancy
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedLpo(null)}
                  data-testid="button-cancel-receipt"
                >
                  Cancel
                </Button>
                <Button
                  onClick={processGoodsReceipt}
                  disabled={!receiptData.storageLocation.trim() || createGoodsReceipt.isPending}
                  data-testid="button-process-receipt"
                >
                  {createGoodsReceipt.isPending ? "Processing..." : "Process Receipt"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
