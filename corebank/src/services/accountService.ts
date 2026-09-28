import { randomUUID } from "node:crypto";
import { store } from "../store.js";
import type { Account, AccountType } from "../models/Account.js";

const MINIMUM_BALANCE_BY_TYPE: Record<AccountType, number> = {
  standard: 0,
  premium: -5000,
  savings: 0,
};

export function createAccount(ownerId: string, type: AccountType): Account {
  const account: Account = {
    id: randomUUID(),
    ownerId,
    type,
    balance: 0,
    minimumBalance: MINIMUM_BALANCE_BY_TYPE[type],
    frozen: false,
    createdAt: new Date().toISOString(),
  };
  store.saveAccount(account);
  return account;
}

export function getAccount(id: string): Account | undefined {
  return store.getAccount(id);
}

export function setFrozen(id: string, frozen: boolean): Account | undefined {
  const account = store.getAccount(id);
  if (!account) return undefined;
  account.frozen = frozen;
  store.saveAccount(account);
  return account;
}
