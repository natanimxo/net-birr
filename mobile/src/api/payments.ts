import { api, uploadFile } from "./client";
import { PaymentMethod, PaymentPlanKind, PaymentSubmission, PlansResponse } from "../types";

export interface CreateSubmissionInput {
  plan: PaymentPlanKind;
  method: PaymentMethod;
  sender_name: string;
  transaction_id: string;
  screenshot_url?: string;
}

export const paymentsApi = {
  getPlans: () => api.get<PlansResponse>("/payments/plans"),
  mySubmissions: () => api.get<PaymentSubmission[]>("/payments/submissions/me"),
  createSubmission: (input: CreateSubmissionInput) => api.post<PaymentSubmission>("/payments/submissions", input),
  uploadScreenshot: (fileUri: string, mimeType: string) =>
    uploadFile<{ url: string }>("/payments/upload-screenshot", fileUri, mimeType),
};

export const adminApi = {
  listPendingSubmissions: () => api.get<PaymentSubmission[]>("/admin/payments/submissions?status=pending"),
  approve: (id: string) => api.post<PaymentSubmission>(`/admin/payments/submissions/${id}/approve`),
  reject: (id: string, reason?: string) =>
    api.post<PaymentSubmission>(`/admin/payments/submissions/${id}/reject`, { reason }),
};
