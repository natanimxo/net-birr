import { api } from "./client";
import { Debt, DebtHistoryEntry, DebtStatus } from "../types";

export interface UpdateDebtInput {
  amount?: number;
  status?: DebtStatus;
}

export const debtsApi = {
  list: (status?: DebtStatus) => api.get<Debt[]>(status ? `/debts?status=${status}` : "/debts"),
  update: (id: string, input: UpdateDebtInput) => api.patch<Debt>(`/debts/${id}`, input),
  history: (id: string) => api.get<DebtHistoryEntry[]>(`/debts/${id}/history`),
};
