#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MCP_SERVER_INFO, registerAllTools } from "./register";

async function main() {
  const server = new McpServer(MCP_SERVER_INFO);
  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[dagbog-mcp] fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
