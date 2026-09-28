// Regenerate the explorer standard-json payload from the sources in contracts/,

// using the exact compiler input Foundry used for `forge build`.

//

//   node scripts/prepare-verification-json.mjs [--compilation-target]

//

// Why not paste `forge inspect ... standardJson` straight into the explorer:

// Foundry's output carries `settings.experimental`, which is not part of solc's

// standard-json schema. Explorers hand the payload to solc as-is, and solc

// rejects the whole request with `Unknown key "experimental"` before it ever

// compares bytecode - which surfaces on Etherscan as

// "Unable to find matching Contract Bytecode and ABI".

//

// The two explorer dialects differ, so the flag matters:

//   * Etherscan standard-json upload  -> solc input, no `compilationTarget`.

//     solc itself rejects that key, so including it breaks the compile.

//   * Blockscout `via/solidity-standard-input` -> wants `compilationTarget`.

// Pass `--compilation-target` for Blockscout.

//

// Writes contracts/WalletPrint-standard-json-input.json (UTF-8, no BOM).

import { execFileSync } from "node:child_process"

import { writeFileSync } from "node:fs"

import { resolve } from "node:path"

const CONTRACT_FILE = "src/WalletPrint.sol"

const CONTRACT_NAME = "WalletPrint"

const OUT = resolve("contracts/WalletPrint-standard-json-input.json")

const withCompilationTarget = process.argv
  .slice(2)
  .includes("--compilation-target")

const forge =
  process.env.FORGE ??
  `${process.env.USERPROFILE ?? process.env.HOME}\\.foundry\\bin\\forge.exe`

const raw = execFileSync(
  forge,

  ["inspect", `${CONTRACT_FILE}:${CONTRACT_NAME}`, "standardJson", "--json"],

  { cwd: "contracts", maxBuffer: 1 << 28, encoding: "utf8" },
)

const input = JSON.parse(raw)

// Keys solc's standard-json `settings` object does not accept. Foundry emits

// `experimental`; solc treats any unknown settings key as a hard error.

const ALLOWED = new Set([
  "evmVersion",

  "libraries",

  "metadata",

  "optimizer",

  "outputSelection",

  "remappings",

  "viaIR",

  "viaSSACFG",

  "stopAfter",

  "debug",

  "modelCheckerSettings",

  "compilationTarget", // explorer extension, opt-in
])

const dropped = Object.keys(input.settings).filter((k) => !ALLOWED.has(k))

const settings = Object.fromEntries(
  Object.entries(input.settings).filter(([k]) => ALLOWED.has(k)),
)

if (withCompilationTarget)
  settings.compilationTarget = { [CONTRACT_FILE]: CONTRACT_NAME }

// Deterministic key order keeps the generated file stable between runs.

const orderedSettings = Object.fromEntries(
  [
    "compilationTarget",

    "optimizer",

    "viaIR",

    "evmVersion",

    "metadata",

    "libraries",

    "remappings",

    "outputSelection",

    "stopAfter",

    "debug",
  ]

    .filter((k) => k in settings)

    .map((k) => [k, settings[k]]),
)

const payload = {
  language: input.language,
  sources: input.sources,
  settings: orderedSettings,
}

writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8")

console.log("wrote          ", OUT)

console.log(
  "dialect        ",
  withCompilationTarget
    ? "Blockscout (with compilationTarget)"
    : "Etherscan / solc (no compilationTarget)",
)

console.log("sources        ", Object.keys(payload.sources).length)

console.log("dropped keys   ", dropped.length ? dropped.join(", ") : "(none)")

console.log("viaIR          ", payload.settings.viaIR)

console.log("optimizer      ", JSON.stringify(payload.settings.optimizer))

console.log("evmVersion     ", payload.settings.evmVersion)

console.log("metadata       ", JSON.stringify(payload.settings.metadata))

console.log(
  "\nNext: node scripts/verify-standard-json.mjs contracts/WalletPrint-standard-json-input.json <rpc> <address>",
)
