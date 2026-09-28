export type TransactionType = "transfer_in" | "transfer_out" | "interest";

export interface Transaction {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  createdAt: string;
}
