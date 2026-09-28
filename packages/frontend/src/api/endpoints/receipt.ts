import { apiClient } from '../client';

export interface CreateReceiptPayload {
  poId: string;
  receiptType: 'DIRECT_REQUESTER' | 'WAREHOUSE';
  deliveryNoteNumber?: string;
  receivedDate: string;
  notes?: string;
  items: Array<{
    poItemId: string;
    quantityReceived: number;
    quantityRejected?: number;
    conditionNotes?: string;
  }>;
}

export interface ReceiptItemData {
  id: string;
  grId: string;
  poItemId: string;
  itemName?: string | null;
  uom?: string | null;
  quantityOrdered?: number | null;
  quantityReceived: number;
  quantityRejected: number;
  conditionNotes?: string | null;
}

export interface ReceiptNcrData {
  id: string;
  ncrNumber: string;
  grId: string;
  poId: string;
  description: string;
  actionRequired: string;
  isResolved: boolean;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface ReceiptDetailData {
  id: string;
  grNumber: string;
  poId: string;
  poNumber?: string | null;
  vendorName?: string | null;
  receiptType: 'DIRECT_REQUESTER' | 'WAREHOUSE';
  deliveryNoteNumber?: string | null;
  receivedDate: string;
  receivedBy: string;
  receivedByName?: string | null;
  notes?: string | null;
  createdAt: string;
  items: ReceiptItemData[];
  ncrRecords: ReceiptNcrData[];
  linkedInvoiceId?: string | null;
}

export const receiptApi = {
  list: (params?: { poId?: string }) =>
    apiClient.get('/receipts', { params }).then((res) => res.data),

  getById: (id: string): Promise<{ success: boolean; data: ReceiptDetailData }> =>
    apiClient.get(`/receipts/${id}`).then((res) => res.data),

  create: (data: CreateReceiptPayload) =>
    apiClient.post('/receipts', data).then((res) => res.data),

  listNcrs: (params?: { poId?: string; isResolved?: boolean }) =>
    apiClient.get('/ncrs', { params }).then((res) => res.data),
};
