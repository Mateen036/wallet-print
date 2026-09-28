// Submit the standard-json payload to a contract explorer and poll until the

// verification resolves. Run scripts/prepare-verification-json.mjs and

// scripts/verify-standard-json.mjs first - this script just delivers the file.

//

//   ETHERSCAN_API_KEY=... node scripts/submit-verification.mjs

//   node scripts/submit-verification.mjs --blockscout

//

// Etherscan targets the V2 unified API with the explorer-supplied chain id

// (Robinhood Chain mainnet is 4663). Blockscout uses the v2 standard-json

// endpoint, which wants `compilationTarget` added to the payload.

import { readFileSync } from "node:fs"

import { resolve } from "node:path"

const CHAINS = {
  mainnet: {
    chainId: 4663,
    address: "0xF391057A5C8C5045b84147560dDE7Ef609625f8E",
  },

  testnet: {
    chainId: 46630,

    address: "0xf0f055501841E1cB95Afbec8bF28A2b85B4953a3",
  },
}

const CONTRACT = "src/WalletPrint.sol:WalletPrint"

const COMPILER_VERSION = "v0.8.25+commit.b61c2a91"

const EVM_VERSION = "cancun"

const OPTIMIZATION_RUNS = 200

const BLOCKSCOUT_URLS = {
  mainnet: "https://robinhoodchain.blockscout.com/api",

  testnet: "https://explorer.testnet.chain.robinhood.com/api",
}

const PAYLOAD_IN = resolve("contracts/WalletPrint-standard-json-input.json")

const args = process.argv.slice(2)

const useBlockscout = args.includes("--blockscout")

const chain = args.includes("--testnet") ? "testnet" : "mainnet"

const { chainId, address } = CHAINS[chain]

const input = args.find((a) => !a.startsWith("--")) ?? PAYLOAD_IN

const payload = JSON.parse(readFileSync(input, "utf8").replace(/^\uFEFF/, ""))

console.log(
  "explorer      ",
  useBlockscout ? `blockscout (${chain})` : `etherscan v2 (chain ${chainId})`,
)

console.log("address       ", address)

console.log("contract      ", CONTRACT)

console.log("compiler      ", COMPILER_VERSION)

console.log("input         ", input)

// ---- Etherscan ------------------------------------------------------------

async function submitEtherscan() {
  const apiKey = process.env.ETHERSCAN_API_KEY

  if (!apiKey) {
    console.error("\nETHERSCAN_API_KEY is required for Etherscan submission.")

    console.error(
      "Get one at https://etherscan.io/myapikey and re-run, or use --blockscout.",
    )

    process.exit(2)
  }

  const endpoint = "https://api.etherscan.io/v2/api"

  const url = `${endpoint}?chainid=${chainId}`

  const body = new URLSearchParams({
    module: "contract",

    action: "verifystandardjsoninput",

    codeformat: "solidity-standard-json-input",

    sourceCode: JSON.stringify(payload),

    compilerversion: COMPILER_VERSION,

    constructorArguements: "",

    contractaddress: address,
  })

  const submit = await post(url, body, { apikey: apiKey })

  console.log("\nsubmission     ", JSON.stringify(submit))

  if (submit.status !== "1" || !submit.result) {
    console.error("\nSubmission rejected:", submit.result ?? submit.message)

    process.exit(1)
  }

  const guid = submit.result

  for (let attempt = 1; attempt <= 30; attempt++) {
    await sleep(5000)

    const status = await post(
      url,

      new URLSearchParams({
        module: "contract",

        action: "checkverifystatus",

        guid,

        apikey: apiKey,
      }),
    )

    const message = String(status.result ?? "")

    console.log(
      `poll ${String(attempt).padStart(2)}        ${message.slice(0, 160)}`,
    )

    if (status.status === "1" && !/pending|in queue/i.test(message)) {
      if (/fail|error/i.test(message)) {
        console.error("\nVerification failed:", message)

        process.exit(1)
      }

      console.log("\nVerified.")

      return
    }
  }

  console.log(`\nStill pending (guid ${guid}). Check back with that guid.`)
}

// ---- Blockscout -----------------------------------------------------------

// These Robinhood Chain Blockscout instances do not expose the v2
// `/verification/via/solidity-standard-json` route (it 404s), but they do serve
// the Etherscan-compatible v1 API, which is what `forge verify-contract
// --verifier blockscout` uses. Verified against the testnet explorer, which
// answers "Smart-contract already verified." for the testnet deployment.
async function submitBlockscout() {
  const res = await post(
    `${BLOCKSCOUT_URLS[chain]}/api`,
    new URLSearchParams({
      module: "contract",

      action: "verifysourcecode",

      codeformat: "solidity-standard-json-input",

      sourceCode: JSON.stringify(payload),

      compilerversion: COMPILER_VERSION,

      constructorArguements: "",

      contractaddress: address,

      optimizationUsed: "1",

      runs: String(OPTIMIZATION_RUNS),

      evmVersion: EVM_VERSION,
    }),
  )

  console.log("\nsubmission     ", JSON.stringify(res).slice(0, 300))
  const text = `${res.result ?? ""}${res.message ?? ""}`
  // A Cloudflare challenge comes back as an HTML "Just a moment..." page rather
  // than JSON, so the post() fallback puts it in `result` with status "0".
  if (/just a moment|cloudflare|cf_chl/i.test(text)) {
    console.error(
      "\nThe mainnet explorer is behind a Cloudflare interstitial, so non-browser\nclients get an HTML challenge page instead of JSON. Verify from the browser UI\n(Verify Contract -> Standard JSON input) or use the testnet explorer, which is\nnot behind the challenge.",
    )

    process.exit(1)
  }

  if (/already verified/i.test(text)) {
    console.log("\nAlready verified on the explorer - nothing to do.")

    return
  }

  if (res.status !== "1") {
    console.error("\nSubmission rejected:", text || "no response")

    process.exit(1)
  }

  const guid = res.result
  for (let attempt = 1; attempt <= 30; attempt++) {
    await sleep(5000)

    const status = await post(
      `${BLOCKSCOUT_URLS[chain]}/api`,
      new URLSearchParams({
        module: "contract",
        action: "checkverifystatus",
        guid,
      }),
    )

    const message = String(status.result ?? "")
    console.log(
      `poll ${String(attempt).padStart(2)}        ${message.slice(0, 160)}`,
    )
    if (status.status === "1" && !/pending|in queue/i.test(message)) {
      if (/fail|error/i.test(message)) {
        console.error("\nVerification failed:", message)

        process.exit(1)
      }
      console.log("\nVerified.")

      return
    }
  }

  console.log(`\nStill pending (guid ${guid}). Check back with that guid.`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function post(url, body, query = {}) {
  const full = new URL(url)

  for (const [k, v] of Object.entries(query)) full.searchParams.set(k, v)

  const isForm = body instanceof URLSearchParams

  const res = await fetch(full, {
    method: "POST",

    headers: {
      "content-type": isForm
        ? "application/x-www-form-urlencoded"
        : "application/json",

      accept: "application/json",
    },

    body: isForm ? body.toString() : JSON.stringify(body),
  })

  const text = await res.text()

  try {
    return JSON.parse(text)
  } catch {
    return { status: "0", result: text.slice(0, 300) }
  }
}

if (useBlockscout) await submitBlockscout()
else await submitEtherscan()
