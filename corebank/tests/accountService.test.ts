import { describe, it, expect } from "vitest";
import { createAccount, setFrozen } from "../src/services/accountService.js";

describe("accountService", () => {
  it("creates a standard account with zero minimum balance", () => {
    const account = createAccount("owner-1", "standard");
    expect(account.minimumBalance).toBe(0);
    expect(account.frozen).toBe(false);
  });

  it("creates a premium account with a negative minimum balance (overdraft)", () => {
    const account = createAccount("owner-1", "premium");
    expect(account.minimumBalance).toBe(-5000);
  });

  it("can freeze an account", () => {
    const account = createAccount("owner-1", "standard");
    const frozen = setFrozen(account.id, true);
    expect(frozen?.frozen).toBe(true);
  });
});
