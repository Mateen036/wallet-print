import { useEffect, useState } from "react"
import { decodeEventLog, type Hex } from "viem"
import {
  useBlock,
  useBlockNumber,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi"
import {
  COMMIT_EXPIRY_FALLBACK,
  MAX_SUPPLY,
  REVEAL_DELAY_FALLBACK,
  SNAPSHOT_WINDOW_FALLBACK,
} from "../../lib/constants"
import { commitmentFor } from "../../lib/commitment"
import {
  CONTRACT_READY,
  WALLET_PRINT_ABI,
  WALLET_PRINT_ADDRESS,
} from "../../lib/contract"
import { ArtworkCanvas } from "../ArtworkCanvas"
import { MintSequence } from "../MintSequence"
import { randomHexSeed } from "../../generator/index"

interface MintSectionProps {
  mintedCount?: number
  walletConnected?: boolean
  walletAddress?: string | null
  supplyReady?: boolean
  onConnectWallet?: () => void
}

type MintedEventArgs = {
  tokenId?: bigint
  tokenSeed?: `0x${string}`
  seed?: `0x${string}`
}

const ZERO_BYTES32 = `0x${"0".repeat(64)}` as Hex

/** `m:ss` countdown for the remaining reveal window. */
function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(clamped / 60)
  const remainder = clamped % 60

  return `${minutes}:${String(remainder).padStart(2, "0")}`
}

function friendlyMintError(error: Error): string {
  const message = error.message.toLowerCase()

  if (message.includes("user rejected") || message.includes("user denied")) {
    return "Mint cancelled in wallet."
  }

  if (message.includes("insufficient funds")) {
    return "Mint failed: insufficient ETH for gas."
  }

  if (message.includes("already minted")) {
    return "This wallet has already minted a print."
  }

  if (message.includes("sold out")) {
    return "Mint failed: the collection is sold out."
  }

  if (message.includes("commit expired")) {
    return "Your commit expired before it was revealed. Commit again to restart the mint."
  }

  if (message.includes("commitment still active")) {
    return "A commit is already pending. Reveal it, or wait for it to expire, before committing again."
  }

  if (message.includes("snapshot window closed")) {
    return "The randomness snapshot window closed before it was stored. Wait for this commit to expire, then commit again."
  }

  if (message.includes("commit block hash unavailable")) {
    return "The commit block hash could not be captured. Commit again to restart the mint."
  }

  if (message.includes("wait one block")) {
    return "Commit recorded. Wait for one block before revealing."
  }

  if (message.includes("no commitment")) {
    return "No pending commit for this wallet. Commit your mint first."
  }

  if (message.includes("empty commitment")) {
    return "Mint failed: the commitment was empty. Please try again."
  }

  return "Mint failed. Please check your wallet and try again."
}

export function MintSection({
  mintedCount = 0,
  walletConnected = false,
  walletAddress = null,
  supplyReady = false,
  onConnectWallet,
}: MintSectionProps) {
  const [previewSeed, setPreviewSeed] = useState(() => randomHexSeed())
  const [mintResult, setMintResult] = useState<{
    seed: string
    tokenId: number
  } | null>(null)
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>()
  const [mintError, setMintError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] =
    useState<"commit" | "snapshot" | "reveal" | null>(null)
  const [secret, setSecret] = useState<Hex | null>(null)

  const {
    writeContract,
    isPending: isWritePending,
    error: writeError,
    data: writeHash,
  } = useWriteContract()
  const {
    data: txReceipt,
    isLoading: isReceiptPending,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  })
  const walletAddressHex = walletAddress as `0x${string}` | null
  // The block counter the commit/reveal math runs on, read from the contract.
  // On Robinhood Chain that is the L2 counter: `block.number` there is an
  // Ethereum estimate, so trusting the RPC block number would put the two sides
  // in different ranges.
  const { data: onChainBlock } = useReadContract({
    address: CONTRACT_READY ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: "currentBlock",
    query: { enabled: CONTRACT_READY, refetchInterval: 2000 },
  })
  const { data: rpcBlockNumber } = useBlockNumber({ watch: true })
  // Chain time, used for the commit expiry countdown.
  const { data: latestBlock } = useBlock({
    query: { refetchInterval: 2000 },
  })
  const { data: onChainCommitment, refetch: refetchCommitment } =
    useReadContract({
      address:
        CONTRACT_READY && walletAddressHex ? WALLET_PRINT_ADDRESS : undefined,
      abi: WALLET_PRINT_ABI,
      functionName: "mintCommitment",
      args: walletAddressHex ? [walletAddressHex] : undefined,
      query: {
        enabled: CONTRACT_READY && !!walletAddressHex,
        refetchInterval: 2000,
      },
    })
  const { data: onChainCommitmentBlock } = useReadContract({
    address:
      CONTRACT_READY && walletAddressHex ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: "commitmentBlock",
    args: walletAddressHex ? [walletAddressHex] : undefined,
    query: {
      enabled: CONTRACT_READY && !!walletAddressHex,
      refetchInterval: 2000,
    },
  })
  const { data: onChainCommitmentTime } = useReadContract({
    address:
      CONTRACT_READY && walletAddressHex ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: "commitmentTime",
    args: walletAddressHex ? [walletAddressHex] : undefined,
    query: {
      enabled: CONTRACT_READY && !!walletAddressHex,
      refetchInterval: 2000,
    },
  })
  const { data: onChainCommitBlockHash } = useReadContract({
    address:
      CONTRACT_READY && walletAddressHex ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: "commitBlockHash",
    args: walletAddressHex ? [walletAddressHex] : undefined,
    query: {
      enabled: CONTRACT_READY && !!walletAddressHex,
      refetchInterval: 2000,
    },
  })

  const { data: onChainHasMinted } = useReadContract({
    address:
      CONTRACT_READY && walletAddressHex ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: "hasMinted",
    args: walletAddressHex ? [walletAddressHex] : undefined,
    query: {
      enabled: CONTRACT_READY && !!walletAddressHex,
      refetchInterval: 4000,
    },
  })

  // Contract constants — read once, they cannot change.
  const { data: onChainCommitExpiry } = useReadContract({
    address: CONTRACT_READY ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: "COMMIT_EXPIRY",
    query: { enabled: CONTRACT_READY, staleTime: Infinity },
  })

  const { data: onChainRevealDelay } = useReadContract({
    address: CONTRACT_READY ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: "REVEAL_DELAY",
    query: { enabled: CONTRACT_READY, staleTime: Infinity },
  })

  const { data: onChainSnapshotWindow } = useReadContract({
    address: CONTRACT_READY ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: "SNAPSHOT_WINDOW",
    query: { enabled: CONTRACT_READY, staleTime: Infinity },
  })

  const isSoldOut = mintedCount >= MAX_SUPPLY
  const isMintPending = isWritePending || isReceiptPending
  const contractMissing =
    !CONTRACT_READY ||
    WALLET_PRINT_ADDRESS === "0x0000000000000000000000000000000000000000"
  const mintUnavailable = contractMissing || !supplyReady
  const alreadyMinted = onChainHasMinted === true
  const commitExpiry =
    typeof onChainCommitExpiry === "bigint"
      ? Number(onChainCommitExpiry)
      : COMMIT_EXPIRY_FALLBACK
  const revealDelay =
    typeof onChainRevealDelay === "bigint"
      ? Number(onChainRevealDelay)
      : REVEAL_DELAY_FALLBACK
  const snapshotWindow =
    typeof onChainSnapshotWindow === "bigint"
      ? Number(onChainSnapshotWindow)
      : SNAPSHOT_WINDOW_FALLBACK
  const currentBlock = onChainBlock ?? rpcBlockNumber
  const chainNow =
    typeof latestBlock?.timestamp === "bigint"
      ? Number(latestBlock.timestamp)
      : Math.floor(Date.now() / 1000)
  const hasCommitment =
    typeof onChainCommitment === "string" && onChainCommitment !== ZERO_BYTES32
  const commitmentElapsed =
    typeof onChainCommitmentBlock === "bigint" &&
    typeof currentBlock === "bigint"
      ? Number(currentBlock - onChainCommitmentBlock)
      : null
  const commitmentExpiresAt =
    typeof onChainCommitmentTime === "bigint"
      ? Number(onChainCommitmentTime) + commitExpiry
      : null
  const secondsToExpiry =
    commitmentExpiresAt === null ? null : commitmentExpiresAt - chainNow
  // COMMIT_EXPIRY is time-denominated, so an old commitment is simply too late to
  // reveal. Treat it as absent so the next click commits a fresh secret instead
  // of dead-ending.
  const commitmentExpired =
    hasCommitment && secondsToExpiry !== null && secondsToExpiry <= 0
  // The seed is built from the commit block hash, which the contract can only
  // read from the ArbSys precompile while the commit is recent. The snapshot tx
  // preserves it for the whole reveal window; without it the commitment can only
  // be revealed inside SNAPSHOT_WINDOW chain blocks.
  const snapshotStored =
    typeof onChainCommitBlockHash === "string" &&
    onChainCommitBlockHash !== ZERO_BYTES32
  const snapshotWindowOpen =
    commitmentElapsed !== null && commitmentElapsed <= snapshotWindow
  const hasPendingCommitment = hasCommitment && !commitmentExpired
  const needsSnapshot =
    hasPendingCommitment && !snapshotStored && snapshotWindowOpen
  const snapshotLost =
    hasPendingCommitment && !snapshotStored && !snapshotWindowOpen
  const revealable = snapshotStored || snapshotWindowOpen
  const canReveal =
    hasPendingCommitment &&
    revealable &&
    commitmentElapsed !== null &&
    commitmentElapsed >= revealDelay
  const mintDisabled =
    isMintPending ||
    (walletConnected && (isSoldOut || mintUnavailable || alreadyMinted))
  const progress = (mintedCount / MAX_SUPPLY) * 100

  useEffect(() => {
    const interval = setInterval(() => setPreviewSeed(randomHexSeed()), 7000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!walletAddressHex) {
      setSecret(null)
      return
    }

    const storedSecret = window.localStorage.getItem(
      `wallet-print:secret:${walletAddressHex.toLowerCase()}`,
    )
    setSecret(storedSecret ? storedSecret as Hex : null)
  }, [walletAddressHex])

  useEffect(() => {
    if (!mintTxHash || !txReceipt) return

    if (txReceipt.status === "success") {
      if (pendingAction === "commit") {
        setMintTxHash(undefined)
        refetchCommitment()

        // The commit block hash is only readable from the precompile for a short
        // window, so storing it immediately is what keeps the reveal possible for
        // the whole 30-minute COMMIT_EXPIRY.
        if (walletAddressHex) {
          setPendingAction("snapshot")
          setMintError("Commit recorded. Storing the randomness snapshot…")
          writeContract({
            address: WALLET_PRINT_ADDRESS,
            abi: WALLET_PRINT_ABI,
            functionName: "snapshotCommitment",
            args: [walletAddressHex],
          })
          return
        }

        setPendingAction(null)
        return
      }

      if (pendingAction === "snapshot") {
        setPendingAction(null)
        setMintTxHash(undefined)
        refetchCommitment()
        setMintError(
          "Randomness snapshot stored. Reveal your print whenever you are ready.",
        )
        return
      }

      const contractLogs = txReceipt.logs.filter(
        (log) =>
          log.address.toLowerCase() === WALLET_PRINT_ADDRESS.toLowerCase(),
      )

      if (contractLogs.length === 0) {
        setMintError(
          "Transaction succeeded, but the mint event could not be decoded.",
        )
        return
      }

      let mintedArgs: MintedEventArgs | null = null

      for (const eventLog of contractLogs) {
        try {
          const decoded = decodeEventLog({
            abi: WALLET_PRINT_ABI,
            data: eventLog.data,
            topics: eventLog.topics,
          })

          if (decoded.eventName === "Minted") {
            mintedArgs = (decoded.args as unknown as MintedEventArgs)
            break
          }
        } catch {
          // Other contract logs, such as ERC721 Transfer, are expected here.
        }
      }

      if (!mintedArgs) {
        setMintError(
          "Mint succeeded but the event payload could not be parsed.",
        )
        return
      }

      const nextTokenId = Number(mintedArgs.tokenId ?? BigInt(mintedCount + 1))
      const nextSeed =
        mintedArgs.tokenSeed ?? mintedArgs.seed ?? `0x${"0".repeat(64)}`

      // The secret has served its purpose: the token exists and the seed is on-chain.
      // Do not leave private material behind in localStorage.
      if (walletAddressHex) {
        window.localStorage.removeItem(
          `wallet-print:secret:${walletAddressHex.toLowerCase()}`,
        )
        setSecret(null)
      }

      setMintResult({ seed: nextSeed, tokenId: nextTokenId })
      setPendingAction(null)
      setMintError(null)
    }

    if (txReceipt.status === "reverted") {
      setMintError("Mint transaction reverted.")
    }
  }, [
    mintTxHash,
    mintedCount,
    pendingAction,
    refetchCommitment,
    txReceipt,
    walletAddressHex,
  ])

  useEffect(() => {
    if (writeError) {
      setMintError(friendlyMintError(writeError))
      setMintTxHash(undefined)
      setPendingAction(null)
    }
  }, [writeError])

  useEffect(() => {
    if (receiptError) {
      setMintError(friendlyMintError(receiptError))
      setPendingAction(null)
    }
  }, [receiptError])

  const handleMint = () => {
    if (!walletConnected) {
      onConnectWallet?.()
      return
    }

    if (contractMissing) {
      setMintError(
        "Contract is not configured. Add VITE_WALLET_PRINT_ADDRESS to your .env.",
      )
      return
    }

    if (!supplyReady) {
      setMintError(
        "Collection supply is unavailable. Check the network connection and try again.",
      )
      return
    }

    if (isSoldOut) {
      return
    }

    if (alreadyMinted) {
      setMintError(
        "This wallet has already minted a print. Scroll to YOUR PRINT to view it.",
      )
      return
    }

    if (hasPendingCommitment && !secret) {
      setMintError(
        "This browser does not have the commit secret. Wait for this commit to expire, then commit again. Do not switch browsers between commit and reveal.",
      )
      return
    }

    if (snapshotLost) {
      setMintError(
        "No randomness snapshot was stored for this commit, so it can no longer be revealed. Wait for it to expire, then commit again.",
      )
      return
    }

    setMintError(null)
    setMintTxHash(undefined)

    if (!hasPendingCommitment) {
      const nextSecret = randomHexSeed() as Hex
      const commitment = commitmentFor(nextSecret, walletAddressHex!)
      window.localStorage.setItem(
        `wallet-print:secret:${walletAddressHex!.toLowerCase()}`,
        nextSecret,
      )
      setSecret(nextSecret)
      setPendingAction("commit")
      writeContract({
        address: WALLET_PRINT_ADDRESS,
        abi: WALLET_PRINT_ABI,
        functionName: "commitMint",
        args: [commitment],
      })
      return
    }

    if (needsSnapshot) {
      setPendingAction("snapshot")
      writeContract({
        address: WALLET_PRINT_ADDRESS,
        abi: WALLET_PRINT_ABI,
        functionName: "snapshotCommitment",
        args: [walletAddressHex!],
      })
      return
    }

    if (!canReveal) {
      setMintError("Commit recorded. Wait for one block before revealing.")
      return
    }

    setPendingAction("reveal")
    writeContract({
      address: WALLET_PRINT_ADDRESS,
      abi: WALLET_PRINT_ABI,
      functionName: "revealMint",
      args: [secret],
    })
  }

  useEffect(() => {
    if (isWritePending) {
      setMintError(null)
    }
  }, [isWritePending])

  useEffect(() => {
    if (writeHash) {
      setMintTxHash(writeHash as `0x${string}`)
    }
  }, [writeHash])

  if (mintResult) {
    return (
      <MintSequence
        seed={mintResult.seed}
        tokenId={mintResult.tokenId}
        onClose={() => setMintResult(null)}
      />
    )
  }

  return (
    <section
      id="mint"
      className="relative min-h-screen scroll-mt-24 flex flex-col items-center justify-center px-6 py-32 gap-14"
    >
      <div className="w-full max-w-5xl min-w-0 flex items-end justify-between gap-6">
        <div>
          <p className="section-kicker mb-3">/ 01 — claim your artifact</p>
          <h2 className="font-display text-5xl md:text-7xl font-black leading-none tracking-[-0.04em] text-[#f4f0e8] uppercase break-words">
            MINT <span className="text-[#24b5d8]">THE UNKNOWN</span>
          </h2>
        </div>
        <span className="hidden md:block font-mono text-[10px] tracking-[0.2em] text-[#f4f0e8]/35">
          ON-CHAIN / ERC-721
        </span>
      </div>

      <div className="relative w-full max-w-5xl min-w-0 grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
        <div className="relative min-w-0 max-w-full justify-self-center border border-[#f4f0e8]/15 bg-[#f4f0e8]/[0.03] p-5 md:p-8 paper-shadow">
          <ArtworkCanvas
            seed={previewSeed}
            size={440}
            animate
            className="mint-artwork opacity-90"
          />
          <div className="absolute -bottom-6 left-0 right-0 flex justify-center">
            <span className="font-mono text-[9px] tracking-[0.3em] text-white/20 uppercase">
              NEXT PRINT — PREVIEW
            </span>
          </div>
        </div>

        <div className="min-w-0 flex flex-col gap-8 w-full max-w-[calc(100vw-3rem)] lg:max-w-sm lg:justify-self-end">
          <div className="w-full space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="font-mono text-[10px] tracking-[0.2em] text-[#f4f0e8]/45 uppercase">
                SUPPLY
              </span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-[#c5ff4e]">
                {mintedCount.toLocaleString()} / {MAX_SUPPLY.toLocaleString()}
              </span>
            </div>
            <div className="h-1 w-full bg-[#f4f0e8]/10 relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#c5ff4e] transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <button
            onClick={handleMint}
            disabled={mintDisabled}
            className="w-full font-mono text-[11px] tracking-[0.25em] uppercase bg-[#c5ff4e] py-5 text-[#101311] hover:bg-[#f4f0e8] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed relative overflow-hidden"
          >
            {isWritePending ? (
              <span className="inline-flex items-center gap-3">
                <span className="w-1 h-1 bg-white/60 rounded-full animate-pulse" />
                BROADCASTING
                <span className="w-1 h-1 bg-white/60 rounded-full animate-pulse" />
              </span>
            ) : isReceiptPending ? (
              <span className="inline-flex items-center gap-3">
                <span className="w-1 h-1 bg-white/60 rounded-full animate-pulse" />
                CONFIRMING
                <span className="w-1 h-1 bg-white/60 rounded-full animate-pulse" />
              </span>
            ) : !walletConnected ? (
              "CONNECT WALLET"
            ) : contractMissing ? (
              "CONTRACT UNSET"
            ) : !supplyReady ? (
              "LOADING SUPPLY"
            ) : alreadyMinted ? (
              "PRINT ALREADY MINTED"
            ) : isSoldOut ? (
              "SOLD OUT"
            ) : hasPendingCommitment && !secret ? (
              "SECRET LOST — WAIT TO EXPIRE"
            ) : snapshotLost ? (
              "SNAPSHOT LOST — RECOMMIT WHEN EXPIRED"
            ) : needsSnapshot ? (
              "STORE RANDOMNESS SNAPSHOT"
            ) : hasPendingCommitment && !canReveal ? (
              "WAITING FOR BLOCK"
            ) : hasPendingCommitment ? (
              secondsToExpiry !== null
                ? `REVEAL YOUR PRINT · ${formatCountdown(secondsToExpiry)}`
                : "REVEAL YOUR PRINT"
            ) : commitmentExpired ? (
              "COMMIT AGAIN (EXPIRED)"
            ) : (
              "COMMIT YOUR MINT"
            )}
          </button>

          {walletConnected && walletAddress && (
            <p className="font-mono text-[9px] tracking-[0.15em] text-[#f4f0e8]/40 uppercase">
              {walletAddress.slice(0, 10)}…{walletAddress.slice(-6)}
            </p>
          )}

          {mintError && (
            <p className="font-mono text-[9px] tracking-[0.12em] text-red-300/80 text-center leading-relaxed max-w-xs">
              {mintError}
            </p>
          )}

          {alreadyMinted && (
            <p className="font-mono text-[9px] tracking-[0.12em] text-[#c5ff4e]/70 text-center leading-relaxed max-w-xs">
              This wallet already holds a print.{" "}
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("yourprint")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="underline hover:text-[#c5ff4e] transition-colors"
              >
                View it below
              </button>
              .
            </p>
          )}

          {commitmentExpired && !alreadyMinted && (
            <p className="font-mono text-[9px] tracking-[0.12em] text-[#f4f0e8]/45 text-center leading-relaxed max-w-xs">
              A previous commit expired before it was revealed. Commit again to
              start a fresh print.
            </p>
          )}

          {needsSnapshot && (
            <p className="font-mono text-[9px] tracking-[0.12em] text-[#c5ff4e]/70 text-center leading-relaxed max-w-xs">
              Storing the commit block hash keeps your reveal open for 30
              minutes. That window is short — send it now.
            </p>
          )}

          {snapshotLost && secondsToExpiry !== null && (
            <p className="font-mono text-[9px] tracking-[0.12em] text-[#f4f0e8]/45 text-center leading-relaxed max-w-xs">
              This commit has no randomness snapshot, so it can no longer be
              revealed. It expires in {formatCountdown(secondsToExpiry)} —
              commit again after that.
            </p>
          )}

          <p className="font-mono text-[9px] tracking-[0.1em] text-[#f4f0e8]/35 leading-relaxed max-w-xs">
            Three steps create your print: commit a private secret, store the
            commit block hash that seeds the artwork, then reveal the secret.
            The reveal stays available for 30 minutes after the snapshot.
          </p>
        </div>
      </div>
    </section>
  )
}
