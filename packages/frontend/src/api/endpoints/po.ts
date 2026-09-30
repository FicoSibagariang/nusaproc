import { apiClient } from '../client';

export interface CreatePoPayload {
  vendorId: string;
  vendorBankAccountId: string;
  paymentTermType: 'ADVANCE_OR_COD' | 'PAY_AFTER_RECEIPT';
  taxAmount?: number;
  termsAndConditions: string;
  items: Array<{
    prItemId: string;
    lineNumber?: number;
    itemName: string;
    quantityOrdered: number;
    uom: string;
    unitPrice: number;
  }>;
}

export interface UpdatePoPayload {
  vendorId?: string;
  vendorBankAccountId?: string;
  paymentTermType?: 'ADVANCE_OR_COD' | 'PAY_AFTER_RECEIPT';
  taxAmount?: number;
  termsAndConditions?: string;
  reason?: string;
  items?: Array<{
    prItemId: string;
    lineNumber?: number;
    itemName: string;
    quantityOrdered: number;
    uom: string;
    unitPrice: number;
  }>;
}

export interface AmendPoPayload {
  reason: string;
  updatedTermsAndConditions?: string;
}

export interface PoItemDetail {
  id: string;
  poId: string;
  prItemId: string;
  lineNumber: number;
  itemName: string;
  quantityOrdered: number;
  quantityReceived?: number;
  quantityInvoiced?: number;
  uom: string;
  unitPrice: number;
  subtotal: number;
}

export interface PoAmendmentDetail {
  id: string;
  poId: string;
  amendmentNumber: number;
  changeSummary: string;
  previousSnapshot?: Record<string, unknown>;
  requestedBy?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface PoDetailData {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName?: string;
  vendorBankAccountId: string;
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
  paymentTermType: string;
  versionNumber: number;
  status: string;
  subtotalAmount: number;
  taxAmount: number;
  grandTotalAmount: number;
  termsAndConditions?: string;
  createdBy?: string;
  requesterName?: string;
  requesterEmail?: string;
  approvedBy?: string;
  approvedAt?: string;
  issuedAt?: string;
  createdAt: string;
  updatedAt: string;
  items?: PoItemDetail[];
  amendments?: PoAmendmentDetail[];
}

export const poApi = {
  list: (params?: { status?: string }) =>
    apiClient.get('/purchase-orders', { params }).then((res) => res.data),

  getById: (id: string) =>
    apiClient.get(`/purchase-orders/${id}`).then((res) => res.data),

  create: (data: CreatePoPayload) =>
    apiClient.post('/purchase-orders', data).then((res) => res.data),

  update: (id: string, data: UpdatePoPayload) =>
    apiClient.put(`/purchase-orders/${id}`, data).then((res) => res.data),

  approve: (id: string) =>
    apiClient.post(`/purchase-orders/${id}/approve`).then((res) => res.data),

  issue: (id: string) =>
    apiClient.post(`/purchase-orders/${id}/issue`).then((res) => res.data),

  amend: (id: string, data: AmendPoPayload) =>
    apiClient.post(`/purchase-orders/${id}/amend`, data).then((res) => res.data),

  downloadPdf: (id: string) =>
    apiClient.get(`/purchase-orders/${id}/pdf`, { responseType: 'blob' }).then((res) => res.data),
};
