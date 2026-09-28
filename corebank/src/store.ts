import type { Account } from "./models/Account.js";
import type { Transaction } from "./models/Transaction.js";

class Store {
  accounts = new Map<string, Account>();
  transactions: Transaction[] = [];
  // Tracks total transferred out per account per calendar day, used by
  // the daily transfer limit check. Keyed as `${accountId}:${YYYY-MM-DD}`.
  dailyTransferTotals = new Map<string, number>();

  getAccount(id: string): Account | undefined {
    return this.accounts.get(id);
  }

  saveAccount(account: Account): void {
    this.accounts.set(account.id, account);
  }

  addTransaction(txn: Transaction): void {
    this.transactions.push(txn);
  }

  transactionsFor(accountId: string): Transaction[] {
    return this.transactions.filter((t) => t.accountId === accountId);
  }
}

export const store = new Store();
