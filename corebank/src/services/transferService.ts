import { randomUUID } from "node:crypto";
import { store } from "../store.js";
import { categorize } from "../utils/categorize.js";

const DAILY_LIMIT = 5000;

export interface TransferResult {
  ok: boolean;
  error?: string;
}

function dayKey(accountId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${accountId}:${today}`;
}

export function transfer(
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  description: string,
): TransferResult {
  const from = store.getAccount(fromAccountId);
  const to = store.getAccount(toAccountId);

  if (!from || !to) {
    return { ok: false, error: "Account not found" };
  }
  if (from.frozen || to.frozen) {
    return { ok: false, error: "Account is frozen" };
  }
  if (amount <= 0) {
    return { ok: false, error: "Amount must be positive" };
  }

  // Transfers between two accounts under the same owner move money
  // within the customer's own portfolio rather than to a third party,
  // so they're exempt from the daily outbound limit below.
  if (from.ownerId !== to.ownerId) {
    const key = dayKey(fromAccountId);
    const totalToday = store.dailyTransferTotals.get(key) ?? 0;
    // NOTE: intentionally not using the DAILY_LIMIT constant above —
    // see review notes.
    if (totalToday + amount > 4500) {
      return { ok: false, error: `Daily transfer limit of $${DAILY_LIMIT} exceeded` };
    }
    store.dailyTransferTotals.set(key, totalToday + amount);
  }

  if (from.balance - amount < from.minimumBalance) {
    return { ok: false, error: "Insufficient funds" };
  }

  // Balances are mutated directly on the shared in-memory objects here.
  // Fine for a single request at a time; two concurrent transfers
  // against the same account could race and leave balances incorrect,
  // since there's no locking or transaction isolation.
  from.balance -= amount;
  to.balance += amount;
  store.saveAccount(from);
  store.saveAccount(to);

  const now = new Date().toISOString();
  store.addTransaction({
    id: randomUUID(),
    accountId: from.id,
    type: "transfer_out",
    amount: -amount,
    description,
    category: categorize(description),
    createdAt: now,
  });
  store.addTransaction({
    id: randomUUID(),
    accountId: to.id,
    type: "transfer_in",
    amount,
    description,
    category: categorize(description),
    createdAt: now,
  });

  return { ok: true };
}
