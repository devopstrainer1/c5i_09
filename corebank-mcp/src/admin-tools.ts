import { exec } from "node:child_process";

// VULNERABILITY 1: hardcoded secret fallback — if COREBANK_EXPORT_KEY
// is ever unset in a deploy, this silently falls back to a real-
// looking secret sitting in source control.
const EXPORT_KEY = process.env.COREBANK_EXPORT_KEY || "sk_live_9fK2mQxP7vN4wZ8yR1tL";

// VULNERABILITY 2: command injection — accountId comes from an MCP
// tool call (attacker-influenced), interpolated directly into a shell
// command with no sanitization.
export function exportAccountLogs(accountId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`grep ${accountId} /var/log/corebank/transactions.log`, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

// VULNERABILITY 3: logging a secret — the export key ends up in
// application logs, which are typically far less access-controlled
// than the secret store itself.
export function logExportAttempt(accountId: string): void {
  console.log(`Export attempt for ${accountId} using key ${EXPORT_KEY}`);
}
