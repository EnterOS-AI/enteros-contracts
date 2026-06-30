# Contracts index

Canonical contracts hosted in this repo. SSOT for the Molecule tool/capability contracts,
per RFC [molecule-core#3285](https://git.moleculesai.app/molecule-ai/molecule-core/issues/3285)
("Tool-Contract SSOT & Codegen Architecture"). See the top-level [`README.md`](./README.md)
for the why and the tier model.

## Contracts

| Contract | Surface dir | Schema | Instance | Governs |
| --- | --- | --- | --- | --- |
| `mcp-plugin-delivery` | `mcp/` | [`mcp/mcp-plugin-delivery.schema.json`](./mcp/mcp-plugin-delivery.schema.json) | [`mcp/mcp-plugin-delivery.contract.json`](./mcp/mcp-plugin-delivery.contract.json) | Concierge management-MCP descriptor delivery + the singular `required_tool` (`provision_workspace`) the degrade gate enforces. See [`mcp/README.md`](./mcp/README.md). |
| `plugin-manifest` | `plugin-manifest/` | [`plugin-manifest/plugin-manifest.schema.json`](./plugin-manifest/plugin-manifest.schema.json) | [`plugin-manifest/plugin-manifest.contract.json`](./plugin-manifest/plugin-manifest.contract.json) | Marketplace plugin manifest (`plugin.yaml`) — VS-Code-shaped: `engines` (min host), `contributes` (OPEN, forward-compatible contribution surface), `privileged`, and the **canonical `runtimes` enum** (the SSOT reconciliation of the cross-artifact runtime drift). See [`plugin-manifest/README.md`](./plugin-manifest/README.md). |
| `workspace-template` | `workspace-template/` | [`workspace-template/workspace-template.schema.json`](./workspace-template/workspace-template.schema.json) | [`workspace-template/workspace-template.contract.json`](./workspace-template/workspace-template.contract.json) | Marketplace workspace-template (`config.yaml`) — runtime/tier/model/providers/runtime_config/plugins/schedules/env. Tolerant of the real shape-inconsistency about where the model lives. |
| `org-template` | `org-template/` | [`org-template/org-template.schema.json`](./org-template/org-template.schema.json) | [`org-template/org-template.contract.json`](./org-template/org-template.contract.json) | Marketplace org-template (`org.yaml` + per-agent `workspace.yaml`) — recursive workspace node tree; tolerates both composition styles (inline list / name→node map / folder-tree `!include`/`!external`). |
| `catalog-entry` | `catalog/` | [`catalog/catalog-entry.schema.json`](./catalog/catalog-entry.schema.json) | [`catalog/catalog-entry.contract.json`](./catalog/catalog-entry.contract.json) | Unified marketplace catalog envelope across all three kinds (`plugin`/`workspace-template`/`org-template`), with a per-kind `spec` via `oneOf` keyed on `kind`. Price/entitlement are NOT here (catalog-layer, Phase 2). |
| `provision-request` | `provision-request/` | [`provision-request/provision-request.schema.json`](./provision-request/provision-request.schema.json) | [`provision-request/provision-request.contract.json`](./provision-request/provision-request.contract.json) | The **core → control-plane** `POST /cp/workspaces/provision` wire request. Per-field `type` + `cp_consumes` (a `cp_consumes:false` field is a declared-dead channel and MUST carry a `note`). De-dups the two byte-identical copies in `molecule-core` + `molecule-controlplane`; each consumer keeps its struct-pin test + adds a `contract-ssot-sync` gate against this SSOT (same pattern as `mcp-plugin-delivery`). See [`provision-request/README.md`](./provision-request/README.md). |
| `promote-request` | `promote-request/` | [`promote-request/promote-request.schema.json`](./promote-request/promote-request.schema.json) | [`promote-request/promote-request.contract.json`](./promote-request/promote-request.contract.json) | The control-plane `POST /cp/admin/promote` wire request (CP `PromoteRequest` is the producing SSOT; admin-CLI + mcp-admin wrappers mirror it). Six fields: `env`/`components`/`target_tag`/`dry_run`/`confirm`/`rollback_to`. See [`promote-request/README.md`](./promote-request/README.md). |

The four `plugin-manifest`/`workspace-template`/`org-template`/`catalog-entry` contracts are the **marketplace catalog contract (Phase 1)**: the three artifact manifests + the unified catalog envelope, derived from the real artifacts (`molecule-ai-plugin-*`, `molecule-ai-workspace-template-*`, `molecule-ai-org-template-*`) and their `.molecule-ci/scripts/validate-*.py` validators. Schema only — no CP/DB/money.

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

## workspace-comms (descriptive — enforcement deferred)

- [`workspace-comms/registry-contract.md`](workspace-comms/registry-contract.md) — the `/registry` + `/workspaces` lifecycle protocol, **typed from the three live implementations** (core producer, runtime + external-workspace-sdk consumers). Reference of record; not machine-enforced yet (codegen + conformance gate deferred until drift warrants — see the doc's *Enforcement* section).
