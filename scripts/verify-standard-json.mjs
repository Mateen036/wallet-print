// Compile a Solidity standard-json input locally with the same solc build that

// Foundry used, then compare the resulting runtime bytecode with what is on chain.

// This is the check to run *before* uploading the JSON to an explorer, because it

// answers "will the explorer be able to reproduce this address?" in one step.

//

//   node scripts/verify-standard-json.mjs [input.json] [rpc-url] [address] [solc]

//

// Env SOLC_0_8_25 overrides the solc path; otherwise the svm copy Foundry
// downloads is used. Set CONTRACT=path/File.sol:Name to compare a different
// contract out of the same payload.

import { spawnSync } from "node:child_process"

import { existsSync, readFileSync } from "node:fs"

import { homedir } from "node:os"

import { join, resolve } from "node:path"

const DEFAULT_INPUT = "contracts/WalletPrint-standard-json-input.json"

const DEFAULT_RPC = "https://rpc.mainnet.chain.robinhood.com"

const DEFAULT_ADDRESS = "0xF391057A5C8C5045b84147560dDE7Ef609625f8E"

const [inputArg, rpc = DEFAULT_RPC, address = DEFAULT_ADDRESS, solcArg] =
  process.argv.slice(2)

const input = resolve(inputArg ?? DEFAULT_INPUT)

if (!existsSync(input)) {
  console.error(`input not found: ${input}`)

  console.error("run: node scripts/prepare-verification-json.mjs")

  process.exit(2)
}

// solc lives wherever svm put it: %APPDATA%\svm on Windows, ~/.svm elsewhere.
const solcCandidates = [
  solcArg,
  process.env.SOLC_0_8_25,
  process.env.APPDATA &&
    join(process.env.APPDATA, "svm", "0.8.25", "solc-0.8.25"),
  join(homedir(), ".svm", "0.8.25", "solc-0.8.25"),
].filter(Boolean)

const solc = solcCandidates.find((candidate) => existsSync(candidate))

if (!solc) {
  console.error(
    `solc 0.8.25 not found. Tried:\n  ${solcCandidates.join("\n  ")}`,
  )

  process.exit(2)
}

const raw = readFileSync(input, "utf8").replace(/^\uFEFF/, "")

const standardInput = JSON.parse(raw)

const target = standardInput.settings.compilationTarget

console.log("input         ", input)

console.log("sources       ", Object.keys(standardInput.sources).length)

console.log("viaIR         ", standardInput.settings.viaIR)

console.log("optimizer     ", JSON.stringify(standardInput.settings.optimizer))

console.log(
  "evmVersion    ",
  standardInput.settings.evmVersion ?? "(solc default)",
)

console.log("metadata      ", JSON.stringify(standardInput.settings.metadata))

console.log(
  "target        ",
  JSON.stringify(target ?? "(none - src/WalletPrint.sol:WalletPrint)"),
)

// `compilationTarget` is an explorer extension, not a solc standard-json key:

// solc aborts with `Unknown key "compilationTarget"`. Drop it for the local

// compile and remember it for contract selection instead.

const solcInput = { ...standardInput, settings: { ...standardInput.settings } }

delete solcInput.settings.compilationTarget

const compiled = spawnSync(solc, ["--standard-json"], {
  input: JSON.stringify(solcInput),

  encoding: "utf8",

  maxBuffer: 1 << 28,
})

if (compiled.status !== 0) {
  console.error("solc exited with", compiled.status)

  console.error(compiled.stderr)

  process.exit(1)
}

const output = JSON.parse(compiled.stdout)

const errors = (output.errors ?? []).filter((e) => e.severity === "error")

for (const e of (output.errors ?? []).slice(0, 10))
  console.log(`[solc ${e.severity}] ${e.message}`)

if (errors.length)
  throw new Error(`${errors.length} compile error(s) - fix before verifying`)

// solc's standard-json output nests bytecode under `evm`, and the version string

// is only in the CLI banner, not in the JSON output - read it from `--version`.

const versionOutput =
  spawnSync(solc, ["--version"], { encoding: "utf8" }).stdout ?? ""

const version =
  (versionOutput.match(/Version:\s*(\S+)/) ?? [])[1] ??
  versionOutput.split("\n")[0]?.trim()

console.log("solc          ", version || "(unknown)")

// Pick the contract to compare: an explicit `CONTRACT=path/File.sol:Name`

// override, else `compilationTarget`, else the WalletPrint contract itself.

const wanted = process.env.CONTRACT ?? "src/WalletPrint.sol:WalletPrint"

const flat = Object.entries(output.contracts ?? {}).flatMap(([file, c]) =>
  Object.entries(c).map(([name, v]) => [`${file}:${name}`, v]),
)

let entryKey

if (process.env.CONTRACT) entryKey = wanted
else if (target) {
  // solc/explorer shape is `{ "path/File.sol": "Name" }`; tolerate `{file, contractName}` too.

  const [file, name] = target.file
    ? [target.file, target.contractName ?? target.contract]
    : (Object.entries(target)[0] ?? [])

  entryKey = file && name ? `${file}:${name}` : undefined
}

entryKey ??= wanted

const match = flat.find(([key]) => key === entryKey)

if (!match) {
  throw new Error(
    `${entryKey} missing from solc output (available: ${flat.map(([k]) => k).join(", ")})`,
  )
}

const entry = match[1]

console.log("contract      ", entryKey)

// `evm.deployedBytecode.object` was requested in outputSelection, so the runtime

// code lives under `entry.evm.deployedBytecode`; fall back to the flat shape.

const runtime =
  entry.evm?.deployedBytecode?.object ?? entry.deployedBytecode?.object

if (!runtime)
  throw new Error("no runtime bytecode in solc output - check outputSelection")

const res = await fetch(rpc, {
  method: "POST",

  headers: { "content-type": "application/json" },

  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getCode",
    params: [address, "latest"],
  }),
})

if (!res.ok) throw new Error(`RPC ${res.status}: ${await res.text()}`)

const onchain = (await res.json()).result

if (!onchain || onchain === "0x")
  throw new Error(`No code at ${address} on ${rpc}`)

const created = `0x${runtime.replace(/^0x/, "")}`

console.log("\nrpc           ", rpc)

console.log("address       ", address)

console.log("onchain bytes ", (onchain.length - 2) / 2)

console.log("solc  bytes   ", (created.length - 2) / 2)

const identical = onchain.toLowerCase() === created.toLowerCase()

console.log("MATCH         ", identical)

if (!identical) {
  const max = Math.max(onchain.length, created.length)

  for (let i = 2; i < max; i += 2) {
    if (onchain.slice(i, i + 2) !== created.slice(i, i + 2)) {
      console.log("first diff at byte", (i - 2) / 2)

      console.log("onchain", onchain.slice(Math.max(2, i - 40), i + 80))

      console.log("solc   ", created.slice(Math.max(2, i - 40), i + 80))

      break
    }
  }

  process.exitCode = 1
} else {
  console.log(
    "\nThis standard-json input reproduces the deployed bytecode exactly.",
  )
}
