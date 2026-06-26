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
*.schema.json  ──►  codegen  ──►  gen/  (Go / TS / Python typed bindings)
                                   └─ generated output; NEVER hand-edited
```

- Generated bindings land in **`gen/`** and are **never hand-edited**.
- A **regenerate-and-diff CI gate** will enforce **no drift** between the schemas/instances
  and the generated `gen/` output (regenerate in CI, fail if the working tree differs).
  *(To be built next — P2.)*
- Until that gate lands, the `molecule-core` copy of `mcp-plugin-delivery.contract.json`
  remains a deliberately-identical temporary mirror; the intended direction is for core to
  consume / regenerate from here. Do not diverge the two copies.
