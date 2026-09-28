// Compare a deployed contract's runtime bytecode with the local Foundry build

// output, and report exactly where they diverge.

//

//   node scripts/compare-bytecode.mjs <rpc-url> <address> [artifact-path]

//

// Defaults to Robinhood Chain mainnet and contracts/out/WalletPrint.sol/WalletPrint.json

import { readFileSync } from "node:fs"

import { resolve } from "node:path"

const [
  rpc = "https://rpc.mainnet.chain.robinhood.com",
  address = "0xF391057A5C8C5045b84147560dDE7Ef609625f8E",
  artifact,
] = process.argv.slice(2)

const artifactPath = resolve(
  artifact ?? "contracts/out/WalletPrint.sol/WalletPrint.json",
)

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

const build = JSON.parse(readFileSync(artifactPath, "utf8"))

const raw = build.deployedBytecode.object.replace(/^0x/, "")

const local = `0x${raw}`

console.log("rpc           ", rpc)

console.log("address       ", address)

console.log("onchain bytes ", (onchain.length - 2) / 2)

console.log("local  bytes  ", (local.length - 2) / 2)

console.log("identical     ", onchain.toLowerCase() === local.toLowerCase())

const max = Math.max(onchain.length, local.length)

let firstDiff = -1

for (let i = 2; i < max; i += 2) {
  if (onchain.slice(i, i + 2) !== local.slice(i, i + 2)) {
    firstDiff = (i - 2) / 2

    break
  }
}

if (firstDiff < 0) {
  console.log("\nBytecodes match byte for byte.")
} else {
  console.log("\nfirst differing byte offset:", firstDiff)

  const from = Math.max(2, firstDiff * 2 - 32)

  console.log("onchain", onchain.slice(from, firstDiff * 2 + 64))

  console.log("local  ", local.slice(from, firstDiff * 2 + 64))
}

const tail = (s) => s.slice(-160)

console.log("\nonchain tail", tail(onchain))

console.log("local  tail", tail(local))
