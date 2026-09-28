import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/server.js"],
    env: {
      ...process.env,
      COREBANK_URL: "http://localhost:3001",
      COREBANK_ADMIN_TOKEN: "test-admin-secret",
    },
  });

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);

  console.log("=== Connected. Listing tools exposed by the server: ===");
  const { tools } = await client.listTools();
  for (const t of tools) {
    console.log(`- ${t.name}: ${t.description}`);
  }

  const accountId = process.argv[2];
  const otherAccountId = process.argv[3];

  console.log("\n=== Calling get_account via the real MCP protocol: ===");
  const getResult = await client.callTool({
    name: "get_account",
    arguments: { accountId },
  });
  console.log((getResult.content as any)[0].text);

  console.log("\n=== Calling transfer_funds via the real MCP protocol (should hit the daily-limit defect): ===");
  const transferResult = await client.callTool({
    name: "transfer_funds",
    arguments: {
      fromAccountId: accountId,
      toAccountId: otherAccountId,
      amount: 4600,
      description: "MCP test transfer",
    },
  });
  console.log((transferResult.content as any)[0].text, "| isError:", transferResult.isError ?? false);

  console.log("\n=== Calling freeze_account WITHOUT the admin token (should be denied): ===");
  const deniedFreeze = await client.callTool({
    name: "freeze_account",
    arguments: { accountId, adminToken: "wrong-token" },
  });
  console.log((deniedFreeze.content as any)[0].text, "| isError:", deniedFreeze.isError ?? false);

  console.log("\n=== Calling freeze_account WITH the correct admin token (should succeed): ===");
  const okFreeze = await client.callTool({
    name: "freeze_account",
    arguments: { accountId: otherAccountId, adminToken: "test-admin-secret" },
  });
  console.log((okFreeze.content as any)[0].text, "| isError:", okFreeze.isError ?? false);

  console.log("\n=== Calling get_daily_transfer_status (read-only): ===");
  const statusResult = await client.callTool({
    name: "get_daily_transfer_status",
    arguments: { accountId },
  });
  console.log((statusResult.content as any)[0].text);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
