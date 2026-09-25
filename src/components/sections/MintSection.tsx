import { useEffect, useState } from 'react';
import { decodeEventLog, encodePacked, keccak256, type Hex } from 'viem';
import { useBlockNumber, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { MAX_SUPPLY } from '../../lib/constants';
import { CONTRACT_READY, WALLET_PRINT_ABI, WALLET_PRINT_ADDRESS } from '../../lib/contract';
import { ArtworkCanvas } from '../ArtworkCanvas';
import { MintSequence } from '../MintSequence';
import { randomHexSeed } from '../../generator/index';

interface MintSectionProps {
  mintedCount?: number;
  walletConnected?: boolean;
  walletAddress?: string | null;
  supplyReady?: boolean;
  onConnectWallet?: () => void;
}

type MintedEventArgs = {
  tokenId?: bigint;
  tokenSeed?: `0x${string}`;
  seed?: `0x${string}`;
};

const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as Hex;

function commitmentFor(secret: Hex, address: `0x${string}`): Hex {
  return keccak256(encodePacked(['bytes32', 'address'], [secret, address]));
}

function friendlyMintError(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('user rejected') || message.includes('user denied')) {
    return 'Mint cancelled in wallet.';
  }

  if (message.includes('insufficient funds')) {
    return 'Mint failed: insufficient ETH for gas.';
  }

  if (message.includes('already minted')) {
    return 'This wallet has already minted a print.';
  }

  if (message.includes('sold out')) {
    return 'Mint failed: the collection is sold out.';
  }

  return 'Mint failed. Please check your wallet and try again.';
}

export function MintSection({
  mintedCount = 0,
  walletConnected = false,
  walletAddress = null,
  supplyReady = false,
  onConnectWallet,
}: MintSectionProps) {
  const [previewSeed, setPreviewSeed] = useState(() => randomHexSeed());
  const [mintResult, setMintResult] = useState<{ seed: string; tokenId: number } | null>(null);
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>();
  const [mintError, setMintError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'commit' | 'reveal' | null>(null);
  const [secret, setSecret] = useState<Hex | null>(null);

  const { writeContract, isPending: isWritePending, error: writeError, data: writeHash } = useWriteContract();
  const { data: txReceipt, isLoading: isReceiptPending, error: receiptError } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });
  const walletAddressHex = walletAddress as `0x${string}` | null;
  const { data: currentBlock } = useBlockNumber({ watch: true });
  const { data: onChainCommitment, refetch: refetchCommitment } = useReadContract({
    address: CONTRACT_READY && walletAddressHex ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: 'mintCommitment',
    args: walletAddressHex ? [walletAddressHex] : undefined,
    query: { enabled: CONTRACT_READY && !!walletAddressHex, refetchInterval: 2000 },
  });
  const { data: onChainCommitmentBlock } = useReadContract({
    address: CONTRACT_READY && walletAddressHex ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: 'commitmentBlock',
    args: walletAddressHex ? [walletAddressHex] : undefined,
    query: { enabled: CONTRACT_READY && !!walletAddressHex, refetchInterval: 2000 },
  });

  const isSoldOut = mintedCount >= MAX_SUPPLY;
  const isMintPending = isWritePending || isReceiptPending;
  const contractMissing = !CONTRACT_READY || WALLET_PRINT_ADDRESS === '0x0000000000000000000000000000000000000000';
  const mintUnavailable = contractMissing || !supplyReady;
  const hasCommitment = typeof onChainCommitment === 'string' && onChainCommitment !== ZERO_BYTES32;
  const canReveal = hasCommitment && typeof onChainCommitmentBlock === 'bigint' && typeof currentBlock === 'bigint'
    && currentBlock > onChainCommitmentBlock;
  const progress = (mintedCount / MAX_SUPPLY) * 100;

  useEffect(() => {
    const interval = setInterval(() => setPreviewSeed(randomHexSeed()), 7000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!walletAddressHex) {
      setSecret(null);
      return;
    }

    const storedSecret = window.localStorage.getItem(`wallet-print:secret:${walletAddressHex.toLowerCase()}`);
    setSecret(storedSecret ? (storedSecret as Hex) : null);
  }, [walletAddressHex]);

  useEffect(() => {
    if (!mintTxHash || !txReceipt) return;

    if (txReceipt.status === 'success') {
      if (pendingAction === 'commit') {
        setPendingAction(null);
        setMintTxHash(undefined);
        refetchCommitment();
        setMintError('Commit recorded. Wait one block, then reveal your print.');
        return;
      }

      const contractLogs = txReceipt.logs.filter(log =>
        log.address.toLowerCase() === WALLET_PRINT_ADDRESS.toLowerCase(),
      );

      if (contractLogs.length === 0) {
        setMintError('Transaction succeeded, but the mint event could not be decoded.');
        return;
      }

      let mintedArgs: MintedEventArgs | null = null;

      for (const eventLog of contractLogs) {
        try {
          const decoded = decodeEventLog({
            abi: WALLET_PRINT_ABI,
            data: eventLog.data,
            topics: eventLog.topics,
          });

          if (decoded.eventName === 'Minted') {
            mintedArgs = decoded.args as unknown as MintedEventArgs;
            break;
          }
        } catch {
          // Other contract logs, such as ERC721 Transfer, are expected here.
        }
      }

      if (!mintedArgs) {
        setMintError('Mint succeeded but the event payload could not be parsed.');
        return;
      }

      const nextTokenId = Number(mintedArgs.tokenId ?? BigInt(mintedCount + 1));
      const nextSeed = mintedArgs.tokenSeed ?? mintedArgs.seed ?? `0x${'0'.repeat(64)}`;

      setMintResult({ seed: nextSeed, tokenId: nextTokenId });
      setPendingAction(null);
      setMintError(null);
    }

    if (txReceipt.status === 'reverted') {
      setMintError('Mint transaction reverted.');
    }
  }, [mintTxHash, mintedCount, pendingAction, refetchCommitment, txReceipt]);

  useEffect(() => {
    if (writeError) {
      setMintError(friendlyMintError(writeError));
      setMintTxHash(undefined);
      setPendingAction(null);
    }
  }, [writeError]);

  useEffect(() => {
    if (receiptError) {
      setMintError(friendlyMintError(receiptError));
      setPendingAction(null);
    }
  }, [receiptError]);

  const handleMint = () => {
    if (!walletConnected) {
      onConnectWallet?.();
      return;
    }

    if (contractMissing) {
      setMintError('Contract is not configured. Add VITE_WALLET_PRINT_ADDRESS to your .env.');
      return;
    }

    if (!supplyReady) {
      setMintError('Collection supply is unavailable. Check the network connection and try again.');
      return;
    }

    if (isSoldOut) {
      return;
    }

    setMintError(null);
    setMintTxHash(undefined);

    if (!hasCommitment) {
      const nextSecret = randomHexSeed() as Hex;
      const commitment = commitmentFor(nextSecret, walletAddressHex!);
      window.localStorage.setItem(`wallet-print:secret:${walletAddressHex!.toLowerCase()}`, nextSecret);
      setSecret(nextSecret);
      setPendingAction('commit');
      writeContract({
        address: WALLET_PRINT_ADDRESS,
        abi: WALLET_PRINT_ABI,
        functionName: 'commitMint',
        args: [commitment],
      });
      return;
    }

    if (!secret) {
      setMintError('This wallet has a pending commit, but its local secret is missing.');
      return;
    }

    if (!canReveal) {
      setMintError('Commit recorded. Wait for one block before revealing.');
      return;
    }

    setPendingAction('reveal');
    writeContract({
      address: WALLET_PRINT_ADDRESS,
      abi: WALLET_PRINT_ABI,
      functionName: 'revealMint',
      args: [secret],
    });
  };

  useEffect(() => {
    if (isWritePending) {
      setMintError(null);
    }
  }, [isWritePending]);

  useEffect(() => {
    if (writeHash) {
      setMintTxHash(writeHash as `0x${string}`);
    }
  }, [writeHash]);

  if (mintResult) {
    return (
      <MintSequence
        seed={mintResult.seed}
        tokenId={mintResult.tokenId}
        onClose={() => setMintResult(null)}
      />
    );
  }

  return (
    <section id="mint" className="relative min-h-screen scroll-mt-24 flex flex-col items-center justify-center px-6 py-32 gap-14">
      <div className="w-full max-w-5xl min-w-0 flex items-end justify-between gap-6">
        <div>
          <p className="section-kicker mb-3">/ 01 — claim your artifact</p>
          <h2 className="font-display text-5xl md:text-7xl font-black leading-none tracking-[-0.04em] text-[#f4f0e8] uppercase break-words">
            MINT <span className="text-[#24b5d8]">THE UNKNOWN</span>
          </h2>
        </div>
        <span className="hidden md:block font-mono text-[10px] tracking-[0.2em] text-[#f4f0e8]/35">ON-CHAIN / ERC-721</span>
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
          disabled={isSoldOut || isMintPending || mintUnavailable}
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
          ) : contractMissing ? (
            'CONTRACT UNSET'
          ) : !supplyReady ? (
            'LOADING SUPPLY'
          ) : isSoldOut ? (
            'SOLD OUT'
          ) : hasCommitment && !canReveal ? (
            'WAITING FOR BLOCK'
          ) : hasCommitment ? (
            'REVEAL YOUR PRINT'
          ) : walletConnected ? (
            'COMMIT YOUR MINT'
          ) : (
            'CONNECT WALLET'
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

        <p className="font-mono text-[9px] tracking-[0.1em] text-[#f4f0e8]/35 leading-relaxed max-w-xs">
          Two transactions create your print: commit a private secret, wait one block,
          then reveal it to generate your artwork.
        </p>
      </div>
      </div>
    </section>
  );
}
