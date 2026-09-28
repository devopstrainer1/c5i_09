import { store } from "../store.js";
import { calculateMonthlyInterest } from "../utils/interest.js";

export interface Statement {
  accountId: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  interestPosted: number;
  spendingByCategory: Record<string, number>;
}

export function generateStatement(
  accountId: string,
  periodStart: Date,
  periodEnd: Date,
): Statement | undefined {
  const account = store.getAccount(accountId);
  if (!account) return undefined;

  const txns = store.transactionsFor(accountId);
  const spendingByCategory: Record<string, number> = {};
  for (const txn of txns) {
    if (txn.amount < 0) {
      spendingByCategory[txn.category] = (spendingByCategory[txn.category] ?? 0) + Math.abs(txn.amount);
    }
  }

  let interestPosted = 0;
  if (account.type === "savings") {
    interestPosted = calculateMonthlyInterest(account.balance, periodStart, periodEnd);
  }

  return {
    accountId,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    openingBalance: account.balance - interestPosted,
    closingBalance: account.balance + interestPosted,
    interestPosted,
    spendingByCategory,
  };
}
