#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { parse, stringify } from "smol-toml";

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginId = "ls-clad@ls-extensions";
const serverName = "lens-studio";
const defaultMcpUrl = "http://localhost:50040/mcp";

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    timeout: 120_000,
    ...options,
  });
}

function requireSuccess(result, label) {
  if (!result.error && result.status === 0) return;
  // CLI diagnostics may echo config headers or tokens. Never relay raw output.
  throw new Error(`${label} failed${result.status === null ? " to start or timed out" : ` (exit ${result.status})`}.`);
}

function readJsonResult(result, label) {
  requireSuccess(result, label);
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

async function readConfig(configPath) {
  try {
    return await readFile(configPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw new Error(`Cannot read Codex config: ${configPath}`);
  }
}

// Remove only blocks owned by the old runner, which could duplicate Lens's MCP
// table. The Lens-generated table and its Authorization header remain intact.
export function removeLegacyBlock(source) {
  return source.replace(
    /^# BEGIN VIRO SPECS AUTO CONFIG\r?\n[\s\S]*?^# END VIRO SPECS AUTO CONFIG\s*$/gm,
    ""
  );
}

function parseConfig(source, label) {
  try {
    return parse(removeLegacyBlock(source));
  } catch {
    throw new Error(`${label} is not valid TOML. Fix the configuration before running specs:go.`);
  }
}

function tableAt(data, keys) {
  return keys.reduce((value, key) => value?.[key], data);
}

function setAt(data, keys, value) {
  let table = data;
  for (const key of keys.slice(0, -1)) table = table[key] ??= {};
  table[keys.at(-1)] = value;
}

// Preserve comments, ordering and untouched headers for ordinary table-based
// Lens/Codex config. Unusual inline/dotted layouts fall back to TOML serialization
// only after comparing the parsed result with the desired configuration.
function updateTableScalar(source, keys, key, value) {
  const lines = source.split("\n");
  let start = -1;
  let end = lines.length;
  for (let index = 0; index < lines.length; index++) {
    if (!/^\s*\[/.test(lines[index])) continue;
    if (start >= 0) { end = index; break; }
    try {
      const candidate = parse(`${lines[index]}\n__viro_marker__ = true\n`);
      if (tableAt(candidate, keys)?.__viro_marker__) start = index;
    } catch { /* Not a simple table header. */ }
  }
  const assignment = stringify({ [key]: value }).trim();
  if (start < 0) {
    const header = keys.map((part) => JSON.stringify(part)).join(".");
    return `${source.trimEnd()}\n\n[${header}]\n${assignment}\n`.trimStart();
  }
  const keyPattern = new RegExp(`^\\s*(?:${key}|"${key}"|'${key}')\\s*=`);
  const existing = lines.findIndex((line, index) => index > start && index < end && keyPattern.test(line));
  if (existing >= 0) {
    // These managed values are scalar URLs/booleans. Retain a trailing comment.
    const comment = lines[existing].match(/(?:"(?:\\.|[^"\\])*"|'[^']*'|[^#])*?(\s+#.*)$/)?.[1] ?? "";
    lines[existing] = assignment + comment;
  } else {
    lines.splice(start + 1, 0, assignment);
  }
  return lines.join("\n");
}

export function mergeProjectConfig(source, url) {
  const cleaned = removeLegacyBlock(source);
  const data = parseConfig(cleaned, "Project Codex config");
  const expected = parse(stringify(data));
  setAt(expected, ["mcp_servers", serverName, "url"], url);
  setAt(expected, ["plugins", pluginId, "enabled"], true);
  let next = updateTableScalar(cleaned, ["mcp_servers", serverName], "url", url);
  next = updateTableScalar(next, ["plugins", pluginId], "enabled", true);
  try {
    if (isDeepStrictEqual(parse(next), parse(stringify(expected)))) return next;
  } catch { /* Inline tables cannot be reopened; use a semantic merge. */ }
  return stringify(expected);
}

export function resolveMcp(globalSource, projectSource, overrideUrl, env = process.env) {
  const globalConfig = parseConfig(globalSource, "User Codex config");
  const projectConfig = parseConfig(projectSource, "Project Codex config");
  const globalServer = globalConfig.mcp_servers?.[serverName] ?? {};
  const projectServer = projectConfig.mcp_servers?.[serverName] ?? {};
  const server = {
    ...globalServer,
    ...projectServer,
    http_headers: { ...globalServer.http_headers, ...projectServer.http_headers },
    env_http_headers: { ...globalServer.env_http_headers, ...projectServer.env_http_headers },
  };
  if (server.command) throw new Error("lens-studio uses a stdio transport; configure the Lens Studio HTTP MCP endpoint before running specs:go.");
  if (server.enabled === false) throw new Error("lens-studio is disabled in Codex config; enable that server before running specs:go.");
  const url = overrideUrl ?? server.url ?? defaultMcpUrl;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
  } catch {
    throw new Error("Lens Studio MCP URL must be an HTTP(S) URL without embedded credentials.");
  }
  let headers;
  try { headers = new Headers(server.http_headers); } catch {
    throw new Error("Lens Studio MCP contains an invalid HTTP header.");
  }
  for (const [header, variable] of Object.entries(server.env_http_headers)) {
    if (!env[variable]) throw new Error("An environment variable required by Lens Studio MCP headers is unset.");
    try { headers.set(header, env[variable]); } catch {
      throw new Error("Lens Studio MCP contains an invalid environment HTTP header.");
    }
  }
  if (server.bearer_token_env_var) {
    const token = env[server.bearer_token_env_var];
    if (!token) throw new Error("The environment variable required by Lens Studio MCP bearer authentication is unset.");
    try { headers.set("Authorization", `Bearer ${token}`); } catch {
      throw new Error("Lens Studio MCP bearer authentication contains an invalid value.");
    }
  }
  return { url, headers };
}

async function readInitializeResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Lens Studio MCP returned an empty initialize response.");
  const decoder = new TextDecoder();
  const isSse = (response.headers.get("content-type") ?? "").includes("text/event-stream");
  let buffer = "";
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      bytes += value?.byteLength ?? 0;
      if (bytes > 1024 * 1024) throw new Error("Lens Studio MCP initialize response exceeded 1 MiB.");
      if (isSse) {
        buffer = buffer.replaceAll("\r\n", "\n");
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = event.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
          if (!data) continue;
          const message = JSON.parse(data);
          if (message.id === 1) return message;
        }
      } else if (done) {
        return JSON.parse(buffer);
      }
      if (done) throw new Error("Lens Studio MCP did not return an initialize result.");
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function probeMcp(url, configuredHeaders, fetchImpl = fetch) {
  const headers = new Headers(configuredHeaders);
  headers.set("Accept", "application/json, text/event-stream");
  headers.set("Content-Type", "application/json");
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      headers,
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "viro-specs-setup", version: "0.1.0" } },
      }),
    });
  } catch {
    throw new Error("Lens Studio MCP initialize could not connect. Keep Lens Studio and its MCP server running; check the configured endpoint.");
  }
  if (response.status === 401 || response.status === 403) {
    await response.body?.cancel();
    throw new Error(`Lens Studio MCP authentication failed (HTTP ${response.status}). Refresh the Authorization header from Lens Studio's MCP server configuration.`);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Lens Studio MCP initialize failed (HTTP ${response.status}).`);
  }
  try {
    let message;
    try { message = await readInitializeResponse(response); } catch {
      throw new Error("Lens Studio MCP returned an invalid or incomplete initialize response.");
    }
    if (message.jsonrpc !== "2.0" || message.id !== 1 || message.error ||
        typeof message.result?.protocolVersion !== "string" ||
        !message.result?.capabilities || typeof message.result.capabilities !== "object" ||
        typeof message.result?.serverInfo?.name !== "string") {
      throw new Error("Lens Studio MCP rejected initialize or returned an invalid result.");
    }
    return { protocolVersion: message.result.protocolVersion };
  } finally {
    // Dispose only this probe's session, if the server created one.
    const sessionId = response.headers.get("mcp-session-id");
    if (sessionId) {
      const cleanupHeaders = new Headers(headers);
      cleanupHeaders.set("Mcp-Session-Id", sessionId);
      await fetchImpl(url, { method: "DELETE", redirect: "error", headers: cleanupHeaders, signal: AbortSignal.timeout(2000) }).then((result) => result.body?.cancel()).catch(() => {});
    }
  }
}

function hasFlag(help, flag) {
  return new RegExp(`(?:^|\\s)${flag}(?:[\\s,=]|$)`).test(help);
}

export function execArguments(help, autoReview, isGitRepository) {
  const args = ["exec"];
  if (hasFlag(help, "--skip-git-repo-check")) args.push("--skip-git-repo-check");
  else if (!isGitRepository) throw new Error("This Codex CLI cannot run outside Git. Update Codex to a version supporting --skip-git-repo-check.");
  if (autoReview) {
    if (hasFlag(help, "--approve-for-me")) args.push("--approve-for-me");
    else if (hasFlag(help, "--full-auto")) args.push("--full-auto");
    else throw new Error("This Codex CLI has no supported automatic approval option. Update Codex, or use --no-auto-review to retain its configured policy.");
  }
  return args;
}

function parseArgs(argv) {
  const options = { execute: false, autoReview: true };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--exec") options.execute = true;
    else if (["--no-auto-review", "--no-full-auto"].includes(arg)) options.autoReview = false;
    else if (["--project", "--mcp-url"].includes(arg)) {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
      options[arg === "--project" ? "project" : "mcpUrl"] = value;
    } else throw new Error("Unknown specs:go option. Use --project PATH [--mcp-url URL] [--exec] [--no-auto-review].");
  }
  if (!options.project) throw new Error("Usage: specs:go --project /absolute/path/to/LensStudioProject [--mcp-url URL] [--exec] [--no-auto-review]");
  return options;
}

async function ensurePlugin(project) {
  const listHelp = run("codex", ["plugin", "list", "--help"], { cwd: project });
  requireSuccess(listHelp, "Codex plugin list capability check");
  if (!hasFlag(listHelp.stdout, "--json")) throw new Error("Update Codex: plugin list --json is required for reliable CLAD installation checks.");
  const plugins = readJsonResult(run("codex", ["plugin", "list", "--json"], { cwd: project }), "Codex plugin list");
  const installed = plugins.installed ?? [];
  if (installed.some((plugin) => plugin.pluginId === pluginId && plugin.installed !== false)) return;
  const addHelp = run("codex", ["plugin", "add", "--help"], { cwd: project });
  if (addHelp.status !== 0) throw new Error("This Codex CLI cannot install plugins from the command line. Install ls-clad from ls-extensions in /plugins, then rerun specs:go.");
  const marketplaceHelp = run("codex", ["plugin", "marketplace", "list", "--help"], { cwd: project });
  requireSuccess(marketplaceHelp, "Codex marketplace capability check");
  if (!hasFlag(marketplaceHelp.stdout, "--json")) throw new Error("Update Codex: plugin marketplace list --json is required.");
  const marketplaces = readJsonResult(run("codex", ["plugin", "marketplace", "list", "--json"], { cwd: project }), "Codex marketplace list");
  if (!(marketplaces.marketplaces ?? []).some((item) => item.name === "ls-extensions")) {
    requireSuccess(run("codex", ["plugin", "marketplace", "add", "lens-studio-devs/ls-extensions"], { cwd: project }), "Add ls-extensions marketplace");
  }
  requireSuccess(run("codex", ["plugin", "add", pluginId], { cwd: project }), "Install CLAD plugin");
  const verified = readJsonResult(run("codex", ["plugin", "list", "--json"], { cwd: project }), "Verify CLAD installation");
  if (!(verified.installed ?? []).some((plugin) => plugin.pluginId === pluginId && plugin.installed !== false)) throw new Error("CLAD was not listed as installed after plugin add.");
}


function verifyEffectiveMcp(project, expected) {
  const result = run("codex", ["mcp", "get", serverName, "--json"], { cwd: project });
  if (result.error || result.status !== 0) {
    throw new Error("Codex did not load lens-studio for this project. Open Codex in the Lens folder and trust the project so .codex/config.toml can load, then rerun specs:go.");
  }
  const effective = readJsonResult(result, "Read effective Codex MCP config");
  if (!effective.enabled || effective.transport?.type !== "streamable_http") {
    throw new Error("Codex has no enabled HTTP lens-studio connection for this project.");
  }
  const connection = resolveMcp("", stringify({ mcp_servers: { [serverName]: effective.transport } }));
  const headers = (value) => [...value.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (connection.url !== expected.url || !isDeepStrictEqual(headers(connection.headers), headers(expected.headers))) {
    throw new Error("Codex loaded different Lens Studio MCP settings. Open Codex in the Lens folder and trust its project configuration, then rerun specs:go.");
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const project = path.resolve(options.project);
  const configPath = path.join(project, ".codex", "config.toml");
  const userConfigPath = path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "config.toml");
  requireSuccess(run(process.execPath, [path.join(here, "doctor-lens-project.mjs"), "--project", project, "--with-validation", "--before-sync"], { stdio: "inherit" }), "Specs project doctor");
  const version = run("codex", ["--version"], { cwd: project });
  if (version.error || version.status !== 0) throw new Error("Codex CLI is unavailable. Install Codex using the official OpenAI setup, then rerun specs:go.");
  let execArgs;
  if (options.execute) {
    const help = run("codex", ["exec", "--help"], { cwd: project });
    requireSuccess(help, "Codex exec capability check");
    const inGit = run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: project }).status === 0;
    execArgs = execArguments(help.stdout, options.autoReview, inGit);
  }
  const [userSource, projectSource] = await Promise.all([readConfig(userConfigPath), readConfig(configPath)]);
  const connection = resolveMcp(userSource, projectSource, options.mcpUrl ?? process.env.VIRO_SPECS_MCP_URL);
  await probeMcp(connection.url, connection.headers);
  console.log("Lens Studio MCP initialize succeeded with the configured authentication.");
  const next = mergeProjectConfig(projectSource, connection.url);
  const configDir = path.dirname(configPath);
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  const temporary = path.join(configDir, `config.toml.${process.pid}.tmp`);
  await writeFile(temporary, next, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, configPath);
  await ensurePlugin(project);
  verifyEffectiveMcp(project, connection);
  requireSuccess(run(process.execPath, [path.join(here, "bootstrap-platform-lab.mjs"), "--project", project], { stdio: "inherit" }), "Specs bootstrap");
  console.log("CLAD installed and enabled; runtime synced with existing asset metadata preserved.");
  console.log("Project Codex config:", configPath);
  const promptPath = path.join(project, "VIRO_SPECS_CLAD_FINISH.md");
  if (!options.execute) {
    console.log("Preparation complete. Start Codex in the Lens project folder and use:");
    console.log(promptPath);
    console.log("Or rerun specs:go with --exec to run the finish prompt.");
    return;
  }
  const prompt = await readFile(promptPath, "utf8");
  console.log("Launching Codex in the Lens project folder. This can take 30+ minutes.");
  // Pass the prompt through stdin, without shell interpolation or command-line size limits.
  const execution = run("codex", [...execArgs, "-"], {
    cwd: project, stdio: ["pipe", "inherit", "inherit"], input: prompt, timeout: undefined,
  });
  requireSuccess(execution, "Codex CLAD execution");
  console.log("Codex exited successfully. Review its validation report for the actual test results.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
