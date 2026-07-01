> # ⚰️ ARCHIVED — this repo has been folded into `molecule-ai/molecule-ai-sdk`
>
> **Do not open new PRs here.** `molecule-contracts` is now a read-only tombstone.
> Its contracts + codegen live in the single consolidated home:
>
> - **Contracts (SSOT):** `molecule-ai/molecule-ai-sdk` → `contracts/<domain>/*.contract.json` + `*.schema.json`
> - **Generated bindings:** `gen/go/molcontracts`, `gen/ts` (`@molecule-ai/contracts`), `gen/python` (`molecule_ai_contracts`)
> - **New Go import:** `go.moleculesai.app/sdk/molcontracts` (was `go.moleculesai.app/molecule-contracts/gen/go`)
> - **TS / Python dist names are unchanged** — `@molecule-ai/contracts` and `molecule_ai_contracts` are now published from `molecule-ai-sdk`, so those consumers need no source change.
>
> **Legacy compatibility:** the frozen commit `ffd2cf33343abfc6d0adea04263d98ee0554ef5e` remains go-gettable
> at `go.moleculesai.app/molecule-contracts/gen/go@ffd2cf33343a` from this archived repo, so pinned
> consumers keep building until they repoint. This vanity path will be dropped once the last consumer
> (molecule-core, PR #3374) is repointed and merged.
>
> Migration + fold: see `molecule-ai/molecule-ai-sdk` PR **#41** (fold) and PR **#40** (cloudproviders SSOT).

---

# molecule-contracts

**Single source of truth for the Molecule tool/capability and template contracts.**
Implements RFC [molecule-core#3285](https://git.moleculesai.app/molecule-ai/molecule-core/issues/3285)
("Tool-Contract SSOT & Codegen Architecture").

This repo is the **Public tier**: third-party-facing shared schemas + the plugin SDK.
Control-plane config/topology contracts stay **Internal** (they live with the CP).

---

## Why this exists

The `#3082` phantom-verb class of incident: a contract was authored against a tool
verb (`create_workspace`) that the management-mode MCP never actually exposed
(`provision_workspace`). The fix landed (core#3280/#3281, mcp-server#66), but the
*durable* answer is structural — make the **producer the SSOT**, generate the
contract/manifest from it, and enforce conformance **at the boundary**:

```
producer (mcp-server, runtime, CP)
      │  emits
      ▼
generated manifest / IDL  ──►  codegen  ──►  typed bindings (Go / TS / Python)
      │                                            │ compile-time within a side
      ▼                                            ▼
   conformance gate at the boundary  ◄──────────  consumers
   (advisory → soak → required; fail-closed)
```

- **Data shapes** are checked at **compile time** within each side (generated bindings).
- **Capabilities** (does the verb actually exist on the live surface?) are checked by the
  **conformance gate** at the boundary — because compile-time can't see across a process.

## Layout (target)

| Path | Contents | Tier |
| --- | --- | --- |
| `mcp/` | MCP tool/capability contracts (IDL: JSON-Schema) — incl. the migrated `mcp-plugin-delivery` contract | Public |
| `templates/` | Template / config asset contracts | Public |
| `sdk/` | The plugin SDK (typed bindings consumers import) | Public |
| `gen/` | Generated bindings (Go / TS / Python) — codegen output, never hand-edited | Public |
| `tools/` | Codegen + validation scripts | — |

## IDL

**JSON-Schema** (RFC §15 decision). One schema per contract; bindings are generated, not
hand-written. Naming is **canonicalized with no rename** of existing verbs (avoids the
regression class the RFC §15 flagged).

## Status

**WIP — P2.** P0/P1 shipped on the producer + CI side:

- **P1 producer manifest** — mcp-server emits `dist/manifest.json` from the real server
  (mcp-server PR #71).
- **P1 reusable conformance gate** — `molecule-ci` composite action (PR #40), fail-closed.
- **Advisory grep-lint** banning raw `mcp__…` literals (core#3299) — `forbidigo` can't ban
  string literals, so this is a grep CI job.

P2 (this repo): migrate the contract to JSON-Schema IDL here, stand up multi-language
codegen, publish the surface family. P3 (owner-gated): marketplace attestation/signing.

See the canonical RFC issue for the full rollout and Definition-of-Ready.
