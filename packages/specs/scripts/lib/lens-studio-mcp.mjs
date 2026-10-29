// Lens Studio MCP client for specs:setup (setup-lens-project.mjs).
//
// Lens Studio runs a per-window HTTP MCP server (AI Assistant > AI Model
// Context Protocol > Configure Server). This client reads its URL and bearer
// header from the environment or from an MCP client config file, and never
// prints the header.
//
// It uses node:http rather than fetch: package installs and recompiles can
// take longer than undici's fixed 300 s headers timeout while Lens Studio
// imports shaders, and fetch then throws even though the editor finishes the
// work.
import http from "node:http";
import https from "node:https";
import { existsSync, readFileSync } from "node:fs";

// Any MCP client config with a "lens-studio" entry under mcpServers, either at
// the top level or per project.
function fromConfigFile() {
  const file = process.env.LENS_STUDIO_MCP_CONFIG;
  if (!file || !existsSync(file)) return null;
  const config = JSON.parse(readFileSync(file, "utf8"));
  const server =
    config.mcpServers?.["lens-studio"] ??
    Object.values(config.projects ?? {})
      .map((project) => project.mcpServers?.["lens-studio"])
      .find(Boolean);
  return server ? { url: server.url, headers: server.headers ?? {} } : null;
}

function fromEnvironment() {
  const url = process.env.LENS_STUDIO_MCP_URL;
  if (!url) return null;
  const token = process.env.LENS_STUDIO_MCP_TOKEN;
  return { url, headers: token ? { Authorization: `Bearer ${token}` } : {} };
}

export function resolveServer() {
  const server = fromEnvironment() ?? fromConfigFile();
  if (!server) {
    throw new Error(
      "Lens Studio MCP server not found. Set LENS_STUDIO_MCP_URL (and LENS_STUDIO_MCP_TOKEN), " +
        "or point LENS_STUDIO_MCP_CONFIG at an MCP config file with a 'lens-studio' server."
    );
  }
  return server;
}

function post(server, body, sessionId, timeoutMs) {
  const url = new URL(server.url);
  const transport = url.protocol === "https:" ? https : http;
  const payload = JSON.stringify(body);
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "content-length": Buffer.byteLength(payload),
    ...server.headers,
    ...(sessionId ? { "mcp-session-id": sessionId } : {}),
  };
  return new Promise((resolve, reject) => {
    const request = transport.request(url, { method: "POST", headers }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const json = text.match(/\{[\s\S]*\}/);
        resolve({
          sessionId: response.headers["mcp-session-id"] ?? sessionId,
          status: response.statusCode,
          body: json ? JSON.parse(json[0]) : text,
        });
      });
    });
    request.setTimeout(timeoutMs, () =>
      request.destroy(new Error(`Lens Studio MCP request timed out after ${timeoutMs} ms`))
    );
    request.on("error", reject);
    request.end(payload);
  });
}

export class LensStudioMcp {
  constructor({ timeoutMs = 30 * 60 * 1000 } = {}) {
    this.server = resolveServer();
    this.timeoutMs = timeoutMs;
    this.sessionId = null;
    this.nextId = 1;
  }

  async connect() {
    const init = await post(
      this.server,
      {
        jsonrpc: "2.0",
        id: this.nextId++,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "viro-specs-setup", version: "1" },
        },
      },
      null,
      this.timeoutMs
    );
    if (init.status === 401 || init.status === 403) {
      throw new Error("Lens Studio MCP rejected the bearer key. Copy a fresh key from Configure Server.");
    }
    this.sessionId = init.sessionId;
    await post(this.server, { jsonrpc: "2.0", method: "notifications/initialized" }, this.sessionId, this.timeoutMs);
    return this;
  }

  async listTools() {
    const { body } = await post(
      this.server,
      { jsonrpc: "2.0", id: this.nextId++, method: "tools/list" },
      this.sessionId,
      this.timeoutMs
    );
    return body.result?.tools ?? [];
  }

  /** Calls a tool and returns the concatenated text content, parsed as JSON when possible. */
  async call(name, args = {}) {
    const { body } = await post(
      this.server,
      { jsonrpc: "2.0", id: this.nextId++, method: "tools/call", params: { name, arguments: args } },
      this.sessionId,
      this.timeoutMs
    );
    if (body.error) throw new Error(`${name}: ${body.error.message ?? JSON.stringify(body.error)}`);
    const parts = body.result?.content ?? [];
    const text = parts.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    const images = parts.filter((part) => part.type === "image");
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {
      // Some tools return plain text.
    }
    return { isError: Boolean(body.result?.isError), data, text, images };
  }

  /** Runs Editor API TypeScript (an async function body) through ExecuteEditorCode. */
  async editor(code, args = {}, timeoutMs = 120000) {
    const result = await this.call("ExecuteEditorCode", { code, args, timeoutMs });
    const data = result.data;
    if (typeof data !== "object" || data?.status !== "Execution Succeeded") {
      const detail = typeof data === "object" ? JSON.stringify(data.errors ?? data.error ?? data) : String(data);
      throw new Error(`ExecuteEditorCode failed: ${detail}`);
    }
    return data.returnValue;
  }
}
