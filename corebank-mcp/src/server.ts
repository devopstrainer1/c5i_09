import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// This server is a thin adapter: it exposes CoreBank's existing HTTP
// API as MCP tools, rather than reimplementing any banking logic here.
// This is the most common real-world MCP pattern — wrap what already
// exists, don't duplicate it.
const COREBANK_URL = process.env.COREBANK_URL ?? "http://localhost:3001";

const server = new McpServer({
  name: "corebank",
  version: "1.0.0",
});

// --- Tool 1: get_account — read-only, safe to call freely -----------
server.registerTool(
  "get_account",
  {
    title: "Get account details",
    description:
      "Look up a CoreBank account by its ID. Returns balance, type, and frozen status.",
    inputSchema: {
      accountId: z.string().describe("The account's UUID"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ accountId }) => {
    const res = await fetch(`${COREBANK_URL}/accounts/${accountId}`);
    const body = await res.json();
    if (!res.ok) {
      return {
        content: [{ type: "text", text: `Error: ${body.error}` }],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
  },
);

// --- Tool 2: transfer_funds — mutating, scoped and audit-logged ------
server.registerTool(
  "transfer_funds",
  {
    title: "Transfer funds between two accounts",
    description:
      "Move money from one CoreBank account to another. Subject to CoreBank's own daily limit and overdraft rules — this tool does not bypass them.",
    inputSchema: {
      fromAccountId: z.string().describe("Source account UUID"),
      toAccountId: z.string().describe("Destination account UUID"),
      amount: z.number().positive().describe("Amount in dollars, must be positive"),
      description: z.string().max(140).describe("A short note for the transaction record"),
    },
    // idempotentHint: false is the honest, important one here — calling
    // this twice with identical arguments moves money twice. Flagged
    // explicitly rather than defaulted, per mcp-builder's own guidance
    // that annotations are hints, not guarantees, but still worth
    // stating precisely rather than leaving to the (also-false) default.
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async ({ fromAccountId, toAccountId, amount, description }) => {
    // Invocation audit log — every attempt, success or failure, is
    // recorded with who/what/when before the call is made. In a real
    // deployment this would write to a durable, append-only log, not
    // stdout — stdout is used here only so the pattern is visible in
    // the demo.
    console.error(
      JSON.stringify({
        audit: "transfer_funds_attempt",
        fromAccountId,
        toAccountId,
        amount,
        at: new Date().toISOString(),
      }),
    );

    const res = await fetch(`${COREBANK_URL}/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromAccountId, toAccountId, amount, description }),
    });
    const body = await res.json();

    console.error(
      JSON.stringify({
        audit: "transfer_funds_result",
        ok: res.ok,
        error: body.error ?? null,
        at: new Date().toISOString(),
      }),
    );

    if (!res.ok) {
      return {
        content: [{ type: "text", text: `Transfer failed: ${body.error}` }],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: "Transfer completed successfully." }] };
  },
);

// --- Tool 3: get_statement — read-only ------------------------------
server.registerTool(
  "get_statement",
  {
    title: "Get monthly statement",
    description: "Get the current month's statement for a CoreBank account.",
    inputSchema: {
      accountId: z.string().describe("The account's UUID"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ accountId }) => {
    const res = await fetch(`${COREBANK_URL}/accounts/${accountId}/statement`);
    const body = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Error: ${body.error}` }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
  },
);

// --- Tool 4: freeze_account — mutating AND sensitive, scoped access --
// Freezing an account is a much higher-consequence action than reading
// a balance, so it requires an admin token to even attempt — separate
// from whatever access controls exist on the underlying CoreBank API
// itself. This is what "scoped access" means concretely: not every
// tool on a server should be reachable by every caller of that server.
const ADMIN_TOKEN = process.env.COREBANK_ADMIN_TOKEN;

server.registerTool(
  "freeze_account",
  {
    title: "Freeze an account",
    description:
      "Freeze a CoreBank account, blocking all further transfers. Requires admin scope — will fail without it.",
    inputSchema: {
      accountId: z.string().describe("The account's UUID"),
      adminToken: z.string().describe("Admin authorization token"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true, // freezing an already-frozen account is a no-op
      openWorldHint: true,
    },
  },
  async ({ accountId, adminToken }) => {
    console.error(
      JSON.stringify({
        audit: "freeze_account_attempt",
        accountId,
        authorized: adminToken === ADMIN_TOKEN,
        at: new Date().toISOString(),
      }),
    );

    if (!ADMIN_TOKEN || adminToken !== ADMIN_TOKEN) {
      return {
        content: [{ type: "text", text: "Permission denied: freeze_account requires a valid admin token." }],
        isError: true,
      };
    }

    const res = await fetch(`${COREBANK_URL}/accounts/${accountId}/freeze`, { method: "POST" });
    const body = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Error: ${body.error}` }], isError: true };
    }
    return { content: [{ type: "text", text: `Account ${accountId} frozen.` }] };
  },
);

// --- Tool 5: get_daily_transfer_status — read-only, well-scoped ------
// Reports how close an account is to CoreBank's daily transfer limit,
// without exposing the limit's implementation (the $4,500 defect from
// Day 4) as a raw internal detail. A well-designed tool describes
// outcomes, not internals.
server.registerTool(
  "get_daily_transfer_status",
  {
    title: "Get today's transfer limit status",
    description:
      "Check how much of an account's daily outbound transfer allowance has been used today.",
    inputSchema: {
      accountId: z.string().describe("The account's UUID"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ accountId }) => {
    // CoreBank's API doesn't expose this directly yet, so this tool
    // reports what it can honestly determine: today's statement's
    // spending total is the closest available proxy. A real
    // implementation would add a dedicated CoreBank endpoint instead
    // of inferring — flagged here deliberately as a known limitation.
    const res = await fetch(`${COREBANK_URL}/accounts/${accountId}/statement`);
    const body = await res.json();
    if (!res.ok) {
      return { content: [{ type: "text", text: `Error: ${body.error}` }], isError: true };
    }
    const spent = Object.values(body.spendingByCategory as Record<string, number>).reduce(
      (a, b) => a + b,
      0,
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ accountId, approxSpentThisPeriod: spent, note: "proxy metric, not the authoritative daily counter" }),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CoreBank MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
