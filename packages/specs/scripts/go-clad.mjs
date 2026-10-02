#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? "pipe",
    env: process.env,
  });
}

function requireSuccess(result, label) {
  if (result.status === 0) return;
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  throw new Error(
    label +
      " failed." +
      (stderr ? "\n" + stderr : "") +
      (!stderr && stdout ? "\n" + stdout : "")
  );
}

async function probeMcp(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json, text/event-stream" },
      signal: AbortSignal.timeout(2000),
    });
    return { reachable: true, status: response.status };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function ensureProjectCodexConfig(project, mcpUrl) {
  const configDir = path.join(project, ".codex");
  const configPath = path.join(configDir, "config.toml");
  await mkdir(configDir, { recursive: true });

  const start = "# BEGIN VIRO SPECS AUTO CONFIG";
  const end = "# END VIRO SPECS AUTO CONFIG";
  const safeUrl = mcpUrl.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

  const block = [
    start,
    '[plugins."ls-clad@ls-extensions"]',
    "enabled = true",
    "",
    "[mcp_servers.lens-studio]",
    'url = "' + safeUrl + '"',
    end,
  ].join("\n");

  const previous = existsSync(configPath)
    ? await readFile(configPath, "utf8")
    : "";

  let cleaned = previous;
  const startIndex = cleaned.indexOf(start);
  const endIndex = cleaned.indexOf(end);
  if (startIndex >= 0 && endIndex >= startIndex) {
    cleaned =
      cleaned.slice(0, startIndex) +
      cleaned.slice(endIndex + end.length);
  }

  cleaned = cleaned.trimEnd();
  const next = (cleaned ? cleaned + "\n\n" : "") + block + "\n";
  await writeFile(configPath, next, "utf8");
  return configPath;
}

const projectArg = readArg("--project");
const mcpUrl =
  readArg("--mcp-url") ??
  process.env.VIRO_SPECS_MCP_URL ??
  "http://localhost:50040/mcp";
const execute = process.argv.includes("--exec");
const fullAuto = !process.argv.includes("--no-full-auto");

if (!projectArg) {
  throw new Error(
    [
      "Usage:",
      "  pnpm specs:go -- --project /absolute/path/to/LensStudioProject",
      "  pnpm specs:go -- --project /absolute/path/to/LensStudioProject --exec",
      "",
      "Options:",
      "  --mcp-url URL     Override Lens Studio MCP URL.",
      "  --exec            Run the CLAD finish prompt non-interactively.",
      "  --no-full-auto    With --exec, do not pass Codex --full-auto.",
    ].join("\n")
  );
}

const project = path.resolve(projectArg);
const bootstrap = path.join(here, "bootstrap-platform-lab.mjs");
const promptPath = path.join(project, "VIRO_SPECS_CLAD_FINISH.md");

console.log("Viro Specs one-command CLAD runner");
console.log("----------------------------------");
console.log("Project:", project);
console.log("Lens Studio MCP:", mcpUrl);

const bootstrapResult = run(
  process.execPath,
  [bootstrap, "--project", project],
  { stdio: "inherit" }
);
requireSuccess(bootstrapResult, "Specs bootstrap");

const codexVersion = run("codex", ["--version"]);
if (codexVersion.error || codexVersion.status !== 0) {
  throw new Error(
    [
      "Codex CLI is not available.",
      "Install it using the official setup:",
      "  curl -fsSL https://chatgpt.com/codex/install.sh | bash",
      "Then rerun specs:go.",
    ].join("\n")
  );
}
console.log("Codex:", codexVersion.stdout.trim());

const mcpProbe = await probeMcp(mcpUrl);
if (!mcpProbe.reachable) {
  throw new Error(
    [
      "Lens Studio MCP is not reachable at " + mcpUrl,
      "Keep Lens Studio open and confirm the MCP Server window says Server running.",
      "If Lens Studio chose another port, rerun with --mcp-url http://localhost:PORT/mcp.",
      "Probe error: " + mcpProbe.error,
    ].join("\n")
  );
}
console.log(
  "Lens Studio MCP reachable (HTTP " + mcpProbe.status + ")."
);

const marketplaceList = run("codex", ["plugin", "marketplace", "list"]);
requireSuccess(marketplaceList, "Codex marketplace list");

if (!marketplaceList.stdout.includes("ls-extensions")) {
  console.log("Adding Lens Studio extension marketplace...");
  const addMarketplace = run("codex", [
    "plugin",
    "marketplace",
    "add",
    "lens-studio-devs/ls-extensions",
  ]);
  requireSuccess(addMarketplace, "Add ls-extensions marketplace");
} else {
  console.log("Lens Studio extension marketplace already configured.");
}

const upgradeMarketplace = run("codex", [
  "plugin",
  "marketplace",
  "upgrade",
  "ls-extensions",
]);
if (upgradeMarketplace.status !== 0) {
  console.warn(
    "Marketplace refresh did not complete; Codex can retry it at startup."
  );
}

const configPath = await ensureProjectCodexConfig(project, mcpUrl);
console.log("Project Codex config:", configPath);
console.log("Configured plugin: ls-clad@ls-extensions");
console.log("Configured MCP: lens-studio");

const approvalPolicy = run("codex", [
  "config",
  "set",
  "approval_policy",
  "on-request",
]);
if (approvalPolicy.status !== 0) {
  console.warn(
    'Could not set approval_policy automatically; Snap recommends "on-request".'
  );
}

const approvalReviewer = run("codex", [
  "config",
  "set",
  "approvals_reviewer",
  "auto_review",
]);
if (approvalReviewer.status !== 0) {
  console.warn(
    'Could not set approvals_reviewer automatically; Snap recommends "auto_review".'
  );
}

const mcpList = run("codex", ["mcp", "list"]);
if (mcpList.status === 0 && mcpList.stdout.includes("lens-studio")) {
  console.log("Codex sees lens-studio MCP.");
} else {
  console.log("Registering explicit lens-studio MCP fallback...");
  const addMcp = run("codex", [
    "mcp",
    "add",
    "lens-studio",
    "--url",
    mcpUrl,
  ]);
  if (addMcp.status !== 0) {
    console.warn(
      "Could not register the global MCP fallback. The project .codex/config.toml still contains the Lens Studio MCP URL."
    );
  }
}

console.log("");
console.log("Local setup is ready.");

if (!execute) {
  console.log("");
  console.log("Start Codex from the Lens project folder:");
  console.log("  cd " + JSON.stringify(project));
  console.log("  codex");
  console.log("");
  console.log("If ls-clad is not already installed, open /plugins once and install");
  console.log("ls-clad from ls-extensions. Then paste:");
  console.log("  " + promptPath);
  console.log("");
  console.log("Or rerun this command with --exec for a non-interactive Codex run.");
  process.exit(0);
}

const prompt = await readFile(promptPath, "utf8");
const execArgs = ["exec"];
if (fullAuto) execArgs.push("--full-auto");
execArgs.push(prompt);

console.log("");
console.log("Launching Codex against the open Lens Studio project...");
console.log("This can run for 30+ minutes.");

const codexExec = spawnSync("codex", execArgs, {
  cwd: project,
  stdio: "inherit",
  env: process.env,
});

if (codexExec.status !== 0) {
  throw new Error(
    [
      "Codex CLAD execution exited before completion.",
      "If Codex reports that ls-clad is not installed, run codex in the project,",
      "open /plugins, install ls-clad from ls-extensions, then rerun specs:go with --exec.",
    ].join("\n")
  );
}

console.log("Codex CLAD run completed.");
