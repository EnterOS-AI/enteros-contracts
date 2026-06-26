# Contracts index

Canonical contracts hosted in this repo. SSOT for the Molecule tool/capability contracts,
per RFC [molecule-core#3285](https://git.moleculesai.app/molecule-ai/molecule-core/issues/3285)
("Tool-Contract SSOT & Codegen Architecture"). See the top-level [`README.md`](./README.md)
for the why and the tier model.

## Contracts

| Contract | Surface dir | Schema | Instance | Governs |
| --- | --- | --- | --- | --- |
| `mcp-plugin-delivery` | `mcp/` | [`mcp/mcp-plugin-delivery.schema.json`](./mcp/mcp-plugin-delivery.schema.json) | [`mcp/mcp-plugin-delivery.contract.json`](./mcp/mcp-plugin-delivery.contract.json) | Concierge management-MCP descriptor delivery + the singular `required_tool` (`provision_workspace`) the degrade gate enforces. See [`mcp/README.md`](./mcp/README.md). |

## IDL convention

- **IDL: JSON-Schema, draft 2020-12** (RFC §15 decision).
- **One `*.schema.json` + one `*.contract.json` instance per contract**, both under the
  contract's surface directory (`mcp/`, later `templates/`, etc.).
- The `*.schema.json` describes the shape; the `*.contract.json` is the canonical data the
  schema validates. The instance MUST validate against its schema.
- **No rename of existing verbs.** Tool verbs (e.g. `provision_workspace`) are
  canonicalized and migrated 1:1 — renaming is the regression class RFC §15 flagged (the
  `#3082` phantom-verb incident). `required_tool` is pinned in-schema via `const`.

## Validate / codegen direction

```
*.contract.json  ──validate──►  *.schema.json
       │  (the canonical IDL instance / data)
       ▼  codegen (tools/gen-*.mjs)
gen/  (Go / TS / Python typed bindings)
  └─ generated output; NEVER hand-edited
```

- Generated bindings land in **`gen/`** and are **never hand-edited**.
- Codegen + validation scripts live in **`tools/`** — see [`tools/README.md`](./tools/README.md).

### CI gates (`.gitea/workflows/`)

Two fail-closed gates, one per invariant (RFC §7), back this direction. They are active once
Gitea Actions is enabled on the repo (Settings → Actions).

| Workflow | Invariant | What it enforces |
| --- | --- | --- |
| [`validate-contracts.yml`](./.gitea/workflows/validate-contracts.yml) | RFC §7 — schema conformance | Every `mcp/*.contract.json` validates against its sibling `mcp/*.schema.json` (`check-jsonschema`). Fail-closed on any invalid instance or any missing schema. This makes the `required_tool` `const` pin load-bearing in CI — renaming the verb fails here. |
| [`codegen-drift.yml`](./.gitea/workflows/codegen-drift.yml) | RFC §14 — no silent regression | Re-runs the generator and `git diff --exit-code -- gen/`. Fail-closed if the committed generated output differs from a fresh regeneration (i.e. `gen/` was hand-edited or left stale). |

- The `molecule-core` copy of `mcp-plugin-delivery.contract.json` remains a
  deliberately-identical temporary mirror; the intended direction is for core to consume /
  regenerate from `gen/` here in a later, separately-coordinated core PR (out of scope here).
  Do not diverge the two copies.
