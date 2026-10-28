import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm, chmod, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "smol-toml";
import { mergeProjectConfig, resolveMcp, probeMcp, execArguments } from "./go-clad.mjs";

const runner = fileURLToPath(new URL("./go-clad.mjs", import.meta.url));
const token = "fixture-secret-never-log";

function initialized(id = 1) {
  return { jsonrpc: "2.0", id, result: { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "fixture-lens", version: "1" } } };
}

async function serve(t, handler) {
  const requests = [];
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const part of req) raw += part;
    const request = { method: req.method, headers: req.headers, body: raw ? JSON.parse(raw) : undefined };
    requests.push(request);
    handler(request, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return { url: `http://127.0.0.1:${server.address().port}/mcp`, requests };
}

function responseHandler(request, response) {
  if (request.headers.authorization !== `Bearer ${token}`) {
    response.writeHead(401).end("Unauthorized");
  } else if (request.method === "DELETE") {
    response.writeHead(204).end();
  } else {
    response.writeHead(200, { "content-type": "application/json", "mcp-session-id": "probe-session" }).end(JSON.stringify(initialized()));
  }
}

test("repeated config merge preserves Authorization, unrelated settings and comments", () => {
  const source = `# Lens Studio generated\nmodel = "custom"\n[mcp_servers.lens-studio]\nurl = "http://localhost:1/mcp" # endpoint\nstartup_timeout_sec = 90\nhttp_headers = { Authorization = "Bearer ${token}", "X-Mode" = "lab" }\n\n[plugins."ls-clad@ls-extensions"]\nenabled = false\n\n[mcp_servers.other]\ncommand = "other-tool"\n`;
  const next = mergeProjectConfig(source, "http://localhost:2/mcp");
  assert.equal(mergeProjectConfig(next, "http://localhost:2/mcp"), next);
  const parsed = parse(next);
  assert.equal(parsed.mcp_servers["lens-studio"].http_headers.Authorization, `Bearer ${token}`);
  assert.equal(parsed.mcp_servers["lens-studio"].startup_timeout_sec, 90);
  assert.equal(parsed.mcp_servers.other.command, "other-tool");
  assert.equal(parsed.plugins["ls-clad@ls-extensions"].enabled, true);
  assert.equal(parsed.model, "custom");
  assert.match(next, /# Lens Studio generated/);
  assert.match(next, /# endpoint/);
  assert.equal((next.match(/\[mcp_servers.lens-studio\]/g) ?? []).length, 1);
});

test("repairs the old duplicate managed block while preserving the Lens auth table", () => {
  const source = `[mcp_servers.lens-studio]\nurl = "http://localhost:1/mcp"\n[mcp_servers.lens-studio.http_headers]\nAuthorization = "Bearer ${token}"\n\n# BEGIN VIRO SPECS AUTO CONFIG\n[plugins."ls-clad@ls-extensions"]\nenabled = true\n[mcp_servers.lens-studio]\nurl = "http://localhost:50040/mcp"\n# END VIRO SPECS AUTO CONFIG\n`;
  const next = mergeProjectConfig(source, "http://localhost:2/mcp");
  assert.equal(parse(next).mcp_servers["lens-studio"].http_headers.Authorization, `Bearer ${token}`);
  assert.doesNotMatch(next, /BEGIN VIRO/);
  assert.equal(mergeProjectConfig(next, "http://localhost:2/mcp"), next);
});

test("supports inline tables, quoted names, and invalid TOML without leaking content", () => {
  const inline = `mcp_servers = { "lens-studio" = { url = 'http://localhost:1/mcp', http_headers = { Authorization = 'Bearer ${token}' } } }\n`;
  assert.equal(parse(mergeProjectConfig(inline, "http://localhost:2/mcp")).mcp_servers["lens-studio"].http_headers.Authorization, `Bearer ${token}`);
  assert.throws(() => mergeProjectConfig(`broken = "${token}`, "http://localhost:1/mcp"), (error) => !error.message.includes(token) && error.message.includes("not valid TOML"));
});

test("connection settings merge user/project auth and resolve environment headers", () => {
  const user = `[mcp_servers.lens-studio]\nurl = "http://localhost:7/mcp"\nbearer_token_env_var = "LENS_TOKEN"\nhttp_headers = { "X-User" = "one" }\n`;
  const project = `[mcp_servers.lens-studio]\nhttp_headers = { "X-Project" = "two" }\nenv_http_headers = { "X-Custom" = "LENS_CUSTOM" }\n`;
  const connection = resolveMcp(user, project, undefined, { LENS_TOKEN: token, LENS_CUSTOM: "three" });
  assert.equal(connection.url, "http://localhost:7/mcp");
  assert.equal(connection.headers.get("authorization"), `Bearer ${token}`);
  assert.equal(connection.headers.get("x-user"), "one");
  assert.equal(connection.headers.get("x-project"), "two");
  assert.equal(connection.headers.get("x-custom"), "three");
  assert.throws(() => resolveMcp(user, project, undefined, {}), /environment variable/);
  assert.throws(() => resolveMcp("", '[mcp_servers.lens-studio]\nenabled = false', undefined), /disabled/);
  assert.throws(() => resolveMcp("", '[mcp_servers.lens-studio]\ncommand = "bridge"', undefined), /stdio/);
});

test("authenticated initialize is validated and its session is cleaned up", async (t) => {
  const server = await serve(t, responseHandler);
  const result = await probeMcp(server.url, new Headers({ Authorization: `Bearer ${token}` }));
  assert.equal(result.protocolVersion, "2025-03-26");
  assert.equal(server.requests[0].method, "POST");
  assert.equal(server.requests[0].body.method, "initialize");
  assert.equal(server.requests[1].method, "DELETE");
  assert.equal(server.requests[1].headers["mcp-session-id"], "probe-session");
});

test("SSE initialize can finish without waiting for the stream to close", async (t) => {
  const server = await serve(t, (_request, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(': heartbeat\n\ndata: {"jsonrpc":"2.0","method":"notifications/message"}\n\n');
    res.write(`event: message\ndata: ${JSON.stringify(initialized())}\n\n`);
  });
  assert.equal((await probeMcp(server.url, new Headers())).protocolVersion, "2025-03-26");
});

test("HTTP401/403/500, JSON-RPC errors and invalid replies cannot report readiness", async () => {
  for (const status of [401, 403, 500]) {
    await assert.rejects(probeMcp("http://localhost/mcp", new Headers(), async () => new Response(token, { status })), (error) => error.message.includes(String(status)) && !error.message.includes(token));
  }
  for (const reply of [{ jsonrpc: "2.0", id: 1, error: { code: -32000, message: token } }, initialized(99), { hello: token }]) {
    await assert.rejects(probeMcp("http://localhost/mcp", new Headers(), async () => new Response(JSON.stringify(reply), { headers: { "content-type": "application/json" } })), (error) => !error.message.includes(token));
  }
  await assert.rejects(probeMcp("http://localhost/mcp", new Headers(), async () => { throw new Error(token); }), (error) => !error.message.includes(token));
});

test("exec flags are selected from CLI capabilities; unsupported flags fail explicitly", () => {
  assert.deepEqual(execArguments(" --approve-for-me\n --skip-git-repo-check\n", true, false), ["exec", "--skip-git-repo-check", "--approve-for-me"]);
  assert.deepEqual(execArguments(" --full-auto\n --skip-git-repo-check\n", true, false), ["exec", "--skip-git-repo-check", "--full-auto"]);
  assert.deepEqual(execArguments(" --skip-git-repo-check\n", false, false), ["exec", "--skip-git-repo-check"]);
  assert.throws(() => execArguments(" --approve-for-me\n", true, false), /outside Git/);
  assert.throws(() => execArguments(" --skip-git-repo-check\n", true, false), /automatic approval/);
});

async function fixture(t, url, extraEnv = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "viro-clad-runner-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = path.join(root, "Lens project with spaces");
  const bin = path.join(root, "bin");
  const codexHome = path.join(root, "codex-home");
  await Promise.all([mkdir(path.join(project, "Assets", "ViroSpecs", "lens"), { recursive: true }), mkdir(path.join(project, ".codex"), { recursive: true }), mkdir(bin), mkdir(codexHome)]);
  await writeFile(path.join(project, "Lab.esproj"), "studioVersion:\n  major: 5\n  minor: 24\n  patch: 0\ntargetPlatform: Spectacles\n");
  // A project with the packages specs:doctor requires (2.x Interaction Kit line).
  await mkdir(path.join(project, "Packages"));
  for (const name of ["SpectaclesInteractionKit.lspkg", "SpectaclesUIKit.lspkg", "SurfacePlacement.lspkg", "VolumetricLine.lspkg", "SpecsNavigationKit.lspkg"]) {
    await writeFile(path.join(project, "Packages", name), "");
  }
  await writeFile(path.join(project, "Assets", "ViroSpecs", "lens", "ViroSpecsRuntimeHost.ts.meta"), "uuid: preserve-me\n");
  const config = `[mcp_servers.lens-studio]\nurl = ${JSON.stringify(url)}\nhttp_headers = { Authorization = "Bearer ${token}" }\n`;
  await writeFile(path.join(project, ".codex", "config.toml"), config);
  await writeFile(path.join(codexHome, "config.toml"), '# keep user policy\napproval_policy = "never"\n');
  const mock = path.join(bin, "codex");
  await writeFile(mock, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const log = process.env.MOCK_LOG;
fs.appendFileSync(log, JSON.stringify({args, cwd:process.cwd()})+'\\n');
const is = (...expected) => JSON.stringify(args)===JSON.stringify(expected);
if(is('--version')) console.log('codex-cli 0.154.0 fixture');
else if(is('exec','--help')) console.log(process.env.MOCK_EXEC_HELP ?? ' --approve-for-me\\n --skip-git-repo-check\\n');
else if(is('mcp','get','lens-studio','--json')) {
  if(process.env.MOCK_MCP_UNAVAILABLE) process.exit(1);
  console.log(JSON.stringify({enabled:true,transport:{type:'streamable_http',url:process.env.MOCK_MCP_URL,http_headers:{Authorization:'Bearer fixture-secret-never-log'}}}));
}
else if(is('plugin','list','--help') || is('plugin','marketplace','list','--help')) console.log(' --json\\n');
else if(is('plugin','add','--help')) console.log('Usage: codex plugin add <PLUGIN[@MARKETPLACE]>');
else if(is('plugin','list','--json')) {
  if(process.env.MOCK_PLUGIN_ERROR) {console.error(process.env.MOCK_PLUGIN_ERROR); process.exit(7);}
  const installed=!process.env.MOCK_PLUGIN_MISSING || fs.existsSync(log+'.installed');
  console.log(JSON.stringify({installed:installed?[{pluginId:'ls-clad@ls-extensions', installed:true}]:[]}));
}
else if(is('plugin','marketplace','list','--json')) console.log(JSON.stringify({marketplaces:process.env.MOCK_MARKETPLACE_MISSING?[]:[{name:'ls-extensions'}]}));
else if(is('plugin','marketplace','add','lens-studio-devs/ls-extensions')) {}
else if(is('plugin','add','ls-clad@ls-extensions')) fs.writeFileSync(log+'.installed','yes');
else if(args[0]==='exec') { fs.writeFileSync(log+'.prompt',fs.readFileSync(0,'utf8')); if(process.env.MOCK_EXEC_FAIL) process.exit(9); }
else {console.error('UNEXPECTED MOCK COMMAND');process.exit(11);}
`);
  await chmod(mock, 0o755);
  const log = path.join(root, "commands.jsonl");
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, CODEX_HOME: codexHome, MOCK_LOG: log, MOCK_MCP_URL: url, ...extraEnv };
  delete env.VIRO_SPECS_MCP_URL;
  const execute = (args = []) => new Promise((resolve) => {
    const child = spawn(process.execPath, [runner, "--project", project, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (data) => output += data);
    child.stderr.on("data", (data) => output += data);
    child.on("close", (code) => resolve({ code, output }));
  });
  return { project, codexHome, log, config, execute };
}

test("prepare/exec twice uses mock CLI, preserves metadata/auth/global policy and passes the real prompt", async (t) => {
  const server = await serve(t, responseHandler);
  const f = await fixture(t, server.url);
  for (const args of [[], ["--exec"]]) {
    const result = await f.execute(args);
    assert.equal(result.code, 0, result.output);
    assert.doesNotMatch(result.output, new RegExp(token));
  }
  const config = parse(await readFile(path.join(f.project, ".codex", "config.toml"), "utf8"));
  assert.equal(config.mcp_servers["lens-studio"].http_headers.Authorization, `Bearer ${token}`);
  assert.equal(await readFile(path.join(f.project, "Assets", "ViroSpecs", "lens", "ViroSpecsRuntimeHost.ts.meta"), "utf8"), "uuid: preserve-me\n");
  assert.match(await readFile(path.join(f.project, "Assets", "ViroSpecs", "lens", "ViroSpecsRuntimeHost.ts"), "utf8"), /compileLensRenderPlan\(scene\)/);
  assert.equal(await readFile(path.join(f.codexHome, "config.toml"), "utf8"), '# keep user policy\napproval_policy = "never"\n');
  const commands = (await readFile(f.log, "utf8")).trim().split("\n").map(JSON.parse);
  const awaitProject = await realpath(f.project);
  assert.ok(commands.every(({ cwd }) => cwd === awaitProject));
  const exec = commands.find(({ args }) => args[0] === "exec" && args.at(-1) === "-");
  assert.deepEqual(exec.args, ["exec", "--skip-git-repo-check", "--approve-for-me", "-"]);
  assert.ok(!commands.some(({ args }) => args[0] === "config" || (args[0] === "mcp" && args[1] !== "get") || args.includes("upgrade") || args.includes("--full-auto")));
  assert.match(await readFile(f.log + ".prompt", "utf8"), /Viro Specs — CLAD Finish Prompt/);
});

test("missing plugin uses documented add and verifies installation", async (t) => {
  const server = await serve(t, responseHandler);
  const f = await fixture(t, server.url, { MOCK_PLUGIN_MISSING: "1", MOCK_MARKETPLACE_MISSING: "1" });
  const result = await f.execute();
  assert.equal(result.code, 0, result.output);
  const commands = (await readFile(f.log, "utf8")).trim().split("\n").map(JSON.parse);
  assert.ok(commands.some(({ args }) => args.join(" ") === "plugin marketplace add lens-studio-devs/ls-extensions"));
  assert.ok(commands.some(({ args }) => args.join(" ") === "plugin add ls-clad@ls-extensions"));
});

test("auth failure stops before config writes, sync or plugin operations", async (t) => {
  const server = await serve(t, (_request, res) => res.writeHead(401).end(token));
  const f = await fixture(t, server.url);
  const result = await f.execute();
  assert.equal(result.code, 1);
  assert.match(result.output, /authentication failed/);
  assert.doesNotMatch(result.output, new RegExp(token));
  assert.equal(await readFile(path.join(f.project, ".codex", "config.toml"), "utf8"), f.config);
  const commands = await readFile(f.log, "utf8");
  assert.doesNotMatch(commands, /plugin/);
});

test("CLI/plugin/exec failures surface without leaking command output", async (t) => {
  const server = await serve(t, responseHandler);
  const unsupported = await fixture(t, server.url, { MOCK_EXEC_HELP: " --skip-git-repo-check\n" });
  const incompatible = await unsupported.execute(["--exec"]);
  assert.equal(incompatible.code, 1);
  assert.match(incompatible.output, /no supported automatic approval/);
  const pluginFailure = await fixture(t, server.url, { MOCK_PLUGIN_ERROR: token });
  const failedPlugin = await pluginFailure.execute();
  assert.equal(failedPlugin.code, 1);
  assert.match(failedPlugin.output, /Codex plugin list failed/);
  assert.doesNotMatch(failedPlugin.output, new RegExp(token));
  const execFailure = await fixture(t, server.url, { MOCK_EXEC_FAIL: "1" });
  const failedExec = await execFailure.execute(["--exec"]);
  assert.equal(failedExec.code, 1);
  assert.match(failedExec.output, /Codex CLAD execution failed/);
});


test("an ignored/untrusted project config prevents a misleading ready message or exec", async (t) => {
  const server = await serve(t, responseHandler);
  const f = await fixture(t, server.url, { MOCK_MCP_UNAVAILABLE: "1" });
  const result = await f.execute(["--exec"]);
  assert.equal(result.code, 1);
  assert.match(result.output, /trust the project/);
  assert.doesNotMatch(result.output, /Preparation complete|Launching Codex/);
  const commands = (await readFile(f.log, "utf8")).trim().split("\n").map(JSON.parse);
  assert.ok(!commands.some(({ args }) => args[0] === "exec" && args.at(-1) === "-"));
});
