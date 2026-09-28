import { apiClient } from '../client';

export interface CreatePrPayload {
  costCenter: string;
  divisionId: string;
  branchId: string;
  requiredDate?: string;
  paymentTermType: 'ADVANCE_OR_COD' | 'PAY_AFTER_RECEIPT';
  businessJustification: string;
  isEmergency?: boolean;
  emergencyJustification?: string;
  items: Array<{
    lineNumber?: number;
    itemName: string;
    specification?: string;
    quantityRequested: number;
    uom: string;
    estimatedUnitPrice: number;
  }>;
}

export interface DecidePrPayload {
  decision: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  approverMaxLimit?: number;
  approverDivisionId?: string;
}

export interface PrItemDetail {
  id: string;
  prId: string;
  lineNumber: number;
  itemName: string;
  specification?: string | null;
  quantityRequested: number;
  quantityOrdered: number;
  uom: string;
  estimatedUnitPrice: number;
  subtotal: number;
}

export interface PrApprovalInstance {
  id: string;
  prId: string;
  stepOrder: number;
  assignedRole: string;
  assignedUserId?: string | null;
  requiredMinAmount: number;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED';
  decisionBy?: string | null;
  decisionAt?: string | null;
  rejectionReason?: string | null;
  delegatedFromUserId?: string | null;
}

export interface PrDetailData {
  id: string;
  prNumber: string;
  requesterId: string;
  requesterName?: string | null;
  requesterEmail?: string | null;
  costCenter: string;
  divisionId: string;
  divisionName?: string | null;
  branchId: string;
  branchName?: string | null;
  requiredDate: string;
  paymentTermType: 'ADVANCE_OR_COD' | 'PAY_AFTER_RECEIPT';
  isEmergency: boolean;
  emergencyJustification?: string | null;
  businessJustification: string;
  status: string;
  totalEstimatedAmount: number;
  remainingQuantity?: number;
  poCount?: number;
  relatedPos?: Array<{
    id: string;
    poNumber: string;
    status: string;
    vendorName?: string | null;
    grandTotalAmount?: number;
    createdAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  items: PrItemDetail[];
  approvalInstances: PrApprovalInstance[];
}

export const prApi = {
  list: (params?: { requesterId?: string; status?: string; hasRemainingPo?: boolean; limit?: number; offset?: number }) =>
    apiClient.get('/purchase-requests', { params }).then((res) => res.data),

  getById: (id: string): Promise<{ success: boolean; data: PrDetailData }> =>
    apiClient.get(`/purchase-requests/${id}`).then((res) => res.data),

  create: (data: CreatePrPayload) =>
    apiClient.post('/purchase-requests', data).then((res) => res.data),

  submit: (id: string) =>
    apiClient.post(`/purchase-requests/${id}/submit`).then((res) => res.data),

  decide: (id: string, data: DecidePrPayload) =>
    apiClient.post(`/purchase-requests/${id}/decide`, data).then((res) => res.data),

  closePartial: (id: string, reason: string) =>
    apiClient.post(`/purchase-requests/${id}/close-partial`, { reason }).then((res) => res.data),

  listUnfulfilledItems: () =>
    apiClient.get('/purchase-requests/unfulfilled-items').then((res) => res.data),

  getUoms: (params?: { search?: string; isActive?: boolean }) =>
    apiClient.get<{ success: boolean; data: Array<{ id: string; code: string; name: string; isActive: boolean }> }>('/uoms', { params }).then((res) => res.data),
};
