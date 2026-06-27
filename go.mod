// molecule-contracts is the cross-repo contract SSOT (RFC molecule-core#3285).
// Making it a Go module lets consumers (e.g. molecule-core) IMPORT the generated
// bindings under gen/go instead of vendoring + re-parsing a JSON mirror —
// the §10 "consume, never two copies" end-state.
//
// Importable as: go.moleculesai.app/molecule-contracts/gen/go  (package molcontracts)
// The go.moleculesai.app vanity responder maps this path to
// git.moleculesai.app/molecule-ai/molecule-contracts.
//
// The gen/go binding is dependency-free (only the standard library is implied;
// it declares constants/types/a value), so this module has no requires.
module go.moleculesai.app/molecule-contracts

go 1.25.0
