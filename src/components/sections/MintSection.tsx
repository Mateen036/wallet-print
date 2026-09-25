import { useEffect, useState } from 'react';
import { decodeEventLog } from 'viem';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { MAX_SUPPLY } from '../../lib/constants';
import { CONTRACT_READY, WALLET_PRINT_ABI, WALLET_PRINT_ADDRESS } from '../../lib/contract';
import { ArtworkCanvas } from '../ArtworkCanvas';
import { MintSequence } from '../MintSequence';
import { seedFromTokenId } from '../../generator/index';

interface MintSectionProps {
  mintedCount?: number;
  walletConnected?: boolean;
  walletAddress?: string | null;
  onConnectWallet?: () => void;
}

export function MintSection({
  mintedCount = 0,
  walletConnected = false,
  walletAddress = null,
  onConnectWallet,
}: MintSectionProps) {
  const [mintResult, setMintResult] = useState<{ seed: string; tokenId: number } | null>(null);
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>();
  const [mintError, setMintError] = useState<string | null>(null);

  const { writeContract, isPending: isWritePending, error: writeError, data: writeHash } = useWriteContract();
  const { data: txReceipt } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  const isSoldOut = mintedCount >= MAX_SUPPLY;
  const contractMissing = !CONTRACT_READY || WALLET_PRINT_ADDRESS === '0x0000000000000000000000000000000000000000';
  const progress = (mintedCount / MAX_SUPPLY) * 100;

  useEffect(() => {
    if (!mintTxHash || !txReceipt) return;

    if (txReceipt.status === 'success') {
      const eventLog = txReceipt.logs.find(log =>
        log.address.toLowerCase() === WALLET_PRINT_ADDRESS.toLowerCase(),
      );

      if (!eventLog) {
        setMintError('Transaction succeeded, but the mint event could not be decoded.');
        return;
      }

      try {
        const decoded = decodeEventLog({
          abi: WALLET_PRINT_ABI,
          data: eventLog.data,
          topics: eventLog.topics,
        });

        if (decoded.eventName === 'Minted') {
          const args = decoded.args as { tokenId?: bigint; seed?: `0x${string}` };
          const nextTokenId = Number(args.tokenId ?? BigInt(mintedCount + 1));
          const nextSeed = args.seed ?? `0x${'0'.repeat(64)}`;

          setMintResult({ seed: nextSeed, tokenId: nextTokenId });
          setMintError(null);
        }
      } catch {
        setMintError('Mint succeeded but the event payload could not be parsed.');
      }
    }

    if (txReceipt.status === 'reverted') {
      setMintError('Mint transaction reverted.');
    }
  }, [mintTxHash, mintedCount, txReceipt]);

  useEffect(() => {
    if (writeError) {
      setMintError(writeError.message ?? 'Mint failed.');
    }
  }, [writeError]);

  const handleMint = () => {
    if (!walletConnected) {
      onConnectWallet?.();
      return;
    }

    if (contractMissing) {
      setMintError('Contract is not configured. Add VITE_WALLET_PRINT_ADDRESS to your .env.');
      return;
    }

    if (isSoldOut) {
      return;
    }

    setMintError(null);
    setMintTxHash(undefined);

    writeContract({
      address: WALLET_PRINT_ADDRESS,
      abi: WALLET_PRINT_ABI,
      functionName: 'mint',
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
    <section id="mint" className="relative min-h-screen flex flex-col items-center justify-center px-6 py-32 gap-20">
      <div className="relative">
        <ArtworkCanvas
          seed={seedFromTokenId(mintedCount + 1)}
          size={400}
          animate
          className="opacity-90"
        />
        <div className="absolute -bottom-6 left-0 right-0 flex justify-center">
          <span className="font-mono text-[9px] tracking-[0.3em] text-white/20 uppercase">
            NEXT PRINT — PREVIEW
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-8 w-full max-w-sm">
        <div className="w-full space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase">
              SUPPLY
            </span>
            <span className="font-mono text-[10px] tracking-[0.1em] text-white/50">
              {mintedCount.toLocaleString()} / {MAX_SUPPLY.toLocaleString()}
            </span>
          </div>
          <div className="h-px w-full bg-white/10 relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-white/40 transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button
          onClick={handleMint}
          disabled={isSoldOut || isWritePending || contractMissing}
          className="w-full font-mono text-[11px] tracking-[0.25em] uppercase border border-white/25 py-5 text-white/60 hover:border-white/70 hover:text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed relative overflow-hidden"
        >
          {isWritePending ? (
            <span className="inline-flex items-center gap-3">
              <span className="w-1 h-1 bg-white/60 rounded-full animate-pulse" />
              BROADCASTING
              <span className="w-1 h-1 bg-white/60 rounded-full animate-pulse" />
            </span>
          ) : contractMissing ? (
            'CONTRACT UNSET'
          ) : isSoldOut ? (
            'SOLD OUT'
          ) : walletConnected ? (
            'MINT YOUR PRINT'
          ) : (
            'CONNECT WALLET'
          )}
        </button>

        {walletConnected && walletAddress && (
          <p className="font-mono text-[9px] tracking-[0.15em] text-white/20 uppercase">
            {walletAddress.slice(0, 10)}…{walletAddress.slice(-6)}
          </p>
        )}

        {mintError && (
          <p className="font-mono text-[9px] tracking-[0.12em] text-red-300/80 text-center leading-relaxed max-w-xs">
            {mintError}
          </p>
        )}

        <p className="font-mono text-[9px] tracking-[0.1em] text-white/15 text-center leading-relaxed max-w-xs">
          One print per wallet.
          Your blockchain participation determines your artwork.
        </p>
      </div>
    </section>
  );
}
