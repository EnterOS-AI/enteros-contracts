#!/usr/bin/env node
// gen-go.mjs — generate Go bindings from the MCP plugin-delivery contract IDL.
//
// IMPORTANT (the whole point of this generator):
//   Every emitted VALUE is DERIVED from the contract JSON instance at
//   `mcp/mcp-plugin-delivery.contract.json`. NOTHING is hardcoded here — there is
//   deliberately no string literal "provision_workspace" (or any other contract
//   value) anywhere in this file. Rename the verb in the contract and re-run, and
//   the generated binding changes with it. That is what makes the schema `const`
//   pin + the validate CI + the drift gate load-bearing end to end.
//
//   The Go FIELD NAMES / json tags below are STRUCTURAL (schema shape), not
//   contract values — analogous to the field-name map in the original scalar
//   pass. Values are never written here.
//
//   Output is emitted gofmt-clean directly (column alignment computed by the
//   `aligned()` helper), so the codegen-drift gate stays NODE-ONLY — no Go
//   toolchain needed in CI — while the file is still canonical Go.
//
// What it emits (package molcontracts, importable as
// go.moleculesai.app/molecule-contracts/gen/go):
//   - scalar string consts (RequiredTool, MCPServerName, …) — ergonomic access.
//   - the full typed contract: types MCPPluginDeliveryContract / Port / Runtime,
//     and `var Contract` populated from the JSON instance — so a consumer (e.g.
//     molecule-core) imports the WHOLE contract instead of vendoring + re-parsing
//     a JSON mirror. This is the RFC molecule-core#3285 §10 "consume, never two
//     copies" end-state.
//
// Usage:
//   node tools/gen-go.mjs            # write gen/go/contract_gen.go
//   node tools/gen-go.mjs --check    # print to stdout, do not write (debug)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCommsModelIR, pascal } from "./lib/comms-schema.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

const CONTRACT_PATH = resolve(repoRoot, "mcp/mcp-plugin-delivery.contract.json");
const OUT_PATH = resolve(repoRoot, "gen/go/contract_gen.go");
const COMMS_OUT_PATH = resolve(repoRoot, "gen/go/workspace_comms_gen.go");

// --- read the canonical IDL instance ----------------------------------------
const raw = readFileSync(CONTRACT_PATH, "utf8");
let contract;
try {
  contract = JSON.parse(raw);
} catch (err) {
  console.error(`gen-go: ${CONTRACT_PATH} is not valid JSON: ${err.message}`);
  process.exit(1);
}

// --- helpers ----------------------------------------------------------------
const lit = (s) => JSON.stringify(s); // Go & JSON share double-quoted escape semantics here.

function reqStr(field) {
  const v = contract[field];
  if (typeof v !== "string") {
    console.error(`gen-go: contract field '${field}' missing or not a string (got ${JSON.stringify(v)}).`);
    process.exit(1);
  }
  return v;
}

// aligned() reproduces gofmt's column alignment for a run of single-line rows:
// each row is [left, right]; `left` is padded to the widest `left` + one space.
function aligned(rows) {
  const w = Math.max(...rows.map(([l]) => l.length));
  return rows.map(([l, r]) => `${l.padEnd(w)} ${r}`);
}

// alignCols reproduces gofmt alignment for N columns: every column except the
// last is padded to the widest cell in that column, joined by a single space.
function alignCols(rows) {
  const n = rows[0].length;
  const w = [];
  for (let c = 0; c < n - 1; c++) w[c] = Math.max(...rows.map((r) => r[c].length));
  return rows.map((r) => r.map((cell, c) => (c < n - 1 ? cell.padEnd(w[c]) : cell)).join(" "));
}

// --- scalar consts (ergonomic; values derived) ------------------------------
const SCALAR_CONSTS = [
  ["RequiredTool", "required_tool", "the singular tool verb the concierge management MCP must expose; the degrade gate fails closed if it is absent on the live surface (the #3082 phantom-verb invariant)."],
  ["MCPServerName", "mcp_server_name", "logical name of the management-mode MCP server descriptor."],
  ["SettingsKey", "key", "top-level key inside the settings file under which MCP servers are declared."],
  ["DefaultSettingsPath", "settings_path", "default (claude_code) settings file path the rendered MCP descriptor is written to."],
  ["LoadedMCPToolsField", "loaded_mcp_tools_field", "name of the field reporting the set of tools actually loaded from the MCP server."],
  ["RuntimePresentField", "runtime_present_field", "name of the runtime-reported boolean field indicating the MCP server is present."],
  ["LegacyBinaryPath", "legacy_binary_path", "filesystem path of the legacy MCP server binary older presence probes checked."],
];

// --- structural field specs for the full contract value ---------------------
// Each: [GoField, jsonKey]. Names/types are schema; values come from JSON.
const PORT_FIELDS = [
  ["Hook", "hook"], ["Impl", "impl"], ["PresentProbe", "present_probe"],
  ["Dispatch", "dispatch"], ["ResolverDefault", "resolver_default"],
];
const RUNTIME_FIELDS = [
  ["SettingsPath", "settings_path"], ["Format", "format"], ["Key", "key"],
  ["Table", "table"], ["Renderer", "renderer"], ["Status", "status"],
];

function emitPort(p) {
  const rows = aligned(PORT_FIELDS.map(([g, k]) => [`${g}:`, `${lit(p?.[k] ?? "")},`]));
  return "Port{\n" + rows.map((r) => `\t\t${r}`).join("\n") + "\n\t}";
}
function emitRuntime(r, indent) {
  const rows = aligned(RUNTIME_FIELDS.map(([g, k]) => [`${g}:`, `${lit(r?.[k] ?? "")},`]));
  return "{\n" + rows.map((x) => `${indent}\t${x}`).join("\n") + `\n${indent}}`;
}
function emitRuntimes(rs) {
  const keys = Object.keys(rs || {}).sort(); // deterministic order regardless of JSON key order
  // multiline values → gofmt does not align the map keys; single space after the colon.
  const entries = keys.map((k) => `\t\t${lit(k)}: ${emitRuntime(rs[k], "\t\t")},`).join("\n");
  return `map[string]Runtime{\n${entries}\n\t}`;
}
function emitConsumers() {
  const cs = Array.isArray(contract.consumers) ? contract.consumers : [];
  return `[]string{${cs.map(lit).join(", ")}}`;
}

// --- emit -------------------------------------------------------------------
const L = [];
L.push("// Code generated by tools/gen-go.mjs — DO NOT EDIT.");
L.push("//");
L.push("// Source of truth: mcp/mcp-plugin-delivery.contract.json (validated against");
L.push("// mcp/mcp-plugin-delivery.schema.json). Every value below is DERIVED from that");
L.push("// contract instance, never hand-written. Regenerate with:");
L.push("//");
L.push("//     node tools/gen-go.mjs");
L.push("//");
L.push("// A CI drift gate (.gitea/workflows/codegen-drift.yml) re-runs the generator and");
L.push("// fails if this file differs from a fresh regeneration, per RFC molecule-core#3285 §14.");
L.push("");
L.push("package molcontracts");
L.push("");
L.push("// Derived scalar string constants from the MCP plugin-delivery contract.");
L.push("const (");
SCALAR_CONSTS.forEach(([goName, field, doc], i) => {
  L.push(`\t// ${goName} is derived from contract field "${field}": ${doc}`);
  L.push(`\t${goName} = ${lit(reqStr(field))}`);
  if (i !== SCALAR_CONSTS.length - 1) L.push("");
});
L.push(")");
L.push("");
// --- types ---
L.push("// Port names the MCP-wiring PORT symbols on the runtime side (core#3159).");
L.push("type Port struct {");
aligned(PORT_FIELDS.map(([g, k]) => [g, `string \`json:${lit(k)}\``])).forEach((r) => L.push(`\t${r}`));
L.push("}");
L.push("");
L.push("// Runtime is a single runtime's native MCP-config delivery surface.");
L.push("type Runtime struct {");
aligned(RUNTIME_FIELDS.map(([g, k]) => {
  const tag = (k === "key" || k === "table") ? `${k},omitempty` : k;
  return [g, `string \`json:${lit(tag)}\``];
})).forEach((r) => L.push(`\t${r}`));
L.push("}");
L.push("");
L.push("// MCPPluginDeliveryContract is the full pinned MCP-plugin delivery surface.");
L.push("type MCPPluginDeliveryContract struct {");
alignCols([
  ["SettingsPath", "string", `\`json:"settings_path"\``],
  ["Key", "string", `\`json:"key"\``],
  ["EntryShape", "string", `\`json:"entry_shape"\``],
  ["MCPServerName", "string", `\`json:"mcp_server_name"\``],
  ["RequiredTool", "string", `\`json:"required_tool"\``],
  ["LoadedMCPToolsField", "string", `\`json:"loaded_mcp_tools_field"\``],
  ["LegacyBinaryPath", "string", `\`json:"legacy_binary_path"\``],
  ["RuntimePresentField", "string", `\`json:"runtime_present_field"\``],
  ["Producer", "string", `\`json:"producer"\``],
  ["Consumer", "string", `\`json:"consumer"\``],
  ["Consumers", "[]string", `\`json:"consumers"\``],
  ["Descriptor", "string", `\`json:"descriptor"\``],
  ["Port", "Port", `\`json:"port"\``],
  ["Runtimes", "map[string]Runtime", `\`json:"runtimes"\``],
]).forEach((r) => L.push(`\t${r}`));
L.push("}");
L.push("");
// --- value ---
L.push("// Contract is the full contract value, DERIVED from the JSON instance. Import");
L.push("// this instead of vendoring + re-parsing a JSON mirror (RFC core#3285 §10).");
L.push("var Contract = MCPPluginDeliveryContract{");
// single-line scalar fields form one gofmt alignment run:
aligned([
  ["SettingsPath:", `${lit(reqStr("settings_path"))},`],
  ["Key:", `${lit(reqStr("key"))},`],
  ["EntryShape:", `${lit(reqStr("entry_shape"))},`],
  ["MCPServerName:", `${lit(reqStr("mcp_server_name"))},`],
  ["RequiredTool:", `${lit(reqStr("required_tool"))},`],
  ["LoadedMCPToolsField:", `${lit(reqStr("loaded_mcp_tools_field"))},`],
  ["LegacyBinaryPath:", `${lit(reqStr("legacy_binary_path"))},`],
  ["RuntimePresentField:", `${lit(reqStr("runtime_present_field"))},`],
  ["Producer:", `${lit(reqStr("producer"))},`],
  ["Consumer:", `${lit(reqStr("consumer"))},`],
  ["Consumers:", `${emitConsumers()},`],
  ["Descriptor:", `${lit(reqStr("descriptor"))},`],
]).forEach((r) => L.push(`\t${r}`));
// multiline-value fields break the alignment run → single space after the colon:
L.push(`\tPort: ${emitPort(contract.port)},`);
L.push(`\tRuntimes: ${emitRuntimes(contract.runtimes)},`);
L.push("}");
L.push("");

const out = L.join("\n");

if (process.argv.includes("--check")) {
  process.stdout.write(out);
  process.exit(0);
}
mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, out, "utf8");
console.error(`gen-go: wrote ${OUT_PATH} (scalars + full Contract value derived from ${CONTRACT_PATH})`);

// ===========================================================================
// workspace-comms models (Wave 2). Derived from workspace-comms/*.schema.json
// via the shared IR (tools/lib/comms-schema.mjs). The mcp output above is left
// BYTE-IDENTICAL — this is a strictly-additional second file in the same
// `package molcontracts`. Type/field names are STRUCTURAL (schema shape); the
// only string VALUES written are the `const`-pinned literals, derived from the
// schema, never hand-authored.
// ===========================================================================

const GO_SCALAR = { string: "string", int: "int", float: "float64", bool: "bool", any: "any" };

function goType(ref) {
  switch (ref.k) {
    case "scalar": return GO_SCALAR[ref.t];
    case "named": return ref.name;
    case "array": return "[]" + goType(ref.items);
    case "map": return "map[string]" + goType(ref.value);
    default: throw new Error(`gen-go: unknown TypeRef kind ${ref.k}`);
  }
}

// optional scalars (except `any`) and optional nested structs become pointers so
// absent is distinguishable from the zero value (the tri-state semantics the
// schemas lean on, e.g. *bool mcp_server_present). slices/maps are already
// nil-able, so they stay as-is with ,omitempty.
function goField(field) {
  const base = goType(field.type);
  let typeStr = base;
  let tag = `\`json:"${field.key}"\``;
  if (!field.required) {
    const ptr = field.type.k === "named" || (field.type.k === "scalar" && field.type.t !== "any");
    typeStr = ptr ? "*" + base : base;
    tag = `\`json:"${field.key},omitempty"\``;
  }
  return [pascal(field.key), typeStr, tag];
}

const ir = buildCommsModelIR(repoRoot);

const G = [];
G.push("// Code generated by tools/gen-go.mjs — DO NOT EDIT.");
G.push("//");
G.push("// Source of truth: workspace-comms/*.schema.json (each validated against its");
G.push("// sibling *.contract.json instance by .gitea/workflows/validate-contracts.yml).");
G.push("// Every type, field and constant below is DERIVED from those schemas, never");
G.push("// hand-written. Regenerate with:");
G.push("//");
G.push("//     node tools/gen-go.mjs");
G.push("//");
G.push("// A CI drift gate (.gitea/workflows/codegen-drift.yml) re-runs the generator and");
G.push("// fails if this file differs from a fresh regeneration, per RFC molecule-core#3285 §14.");
G.push("");
G.push("package molcontracts");
G.push("");

if (ir.consts.length) {
  G.push("// Load-bearing string literals pinned by `const` in the workspace-comms schemas");
  G.push("// (e.g. the register/heartbeat/a2a response status and the JSON-RPC version).");
  G.push("// Consumers assert against these instead of re-typing the literal.");
  G.push("const (");
  ir.consts.forEach((c, i) => {
    G.push(`\t// ${c.name} is pinned by ${c.source}: ${c.doc}`);
    G.push(`\t${c.name} = ${lit(c.value)}`);
    if (i !== ir.consts.length - 1) G.push("");
  });
  G.push(")");
  G.push("");
}

for (const def of ir.types) {
  if (def.doc) G.push(`// ${def.name}: ${def.doc}`);
  else G.push(`// ${def.name} is derived from ${def.source}.`);
  if (def.fields.length === 0) {
    G.push(`type ${def.name} struct{}`);
    G.push("");
    continue;
  }
  G.push(`type ${def.name} struct {`);
  for (const field of def.fields) {
    if (field.doc) G.push(`\t// ${pascal(field.key)}: ${field.doc}`);
    const [name, typeStr, tag] = goField(field);
    G.push(`\t${name} ${typeStr} ${tag}`);
  }
  G.push("}");
  G.push("");
}

const commsOut = G.join("\n");

if (!process.argv.includes("--check")) {
  mkdirSync(dirname(COMMS_OUT_PATH), { recursive: true });
  writeFileSync(COMMS_OUT_PATH, commsOut, "utf8");
  console.error(`gen-go: wrote ${COMMS_OUT_PATH} (${ir.types.length} models + ${ir.consts.length} consts derived from workspace-comms/*.schema.json)`);
}
