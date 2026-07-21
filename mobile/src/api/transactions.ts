import { api } from "./client";
import { Account, Category, TodayResponse, Transaction, TransactionType } from "../types";

export interface CreateTransactionInput {
  amount: number;
  type: TransactionType;
  category_id: string;
  account_id?: string;
  note?: string;
  is_credit?: boolean;
}

export const transactionsApi = {
  today: () => api.get<TodayResponse>("/transactions/today"),
  create: (input: CreateTransactionInput) => api.post<Transaction>("/transactions", input),
};

export const accountsApi = {
  list: () => api.get<Account[]>("/accounts"),
};

export const categoriesApi = {
  list: () => api.get<Category[]>("/categories"),
};
