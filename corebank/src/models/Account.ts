export type AccountType = "standard" | "premium" | "savings";

export interface Account {
  id: string;
  ownerId: string;
  type: AccountType;
  balance: number;
  minimumBalance: number;
  frozen: boolean;
  createdAt: string;
}
