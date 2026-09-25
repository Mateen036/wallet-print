import type { Abi } from 'viem';
import { parseAbi } from 'viem';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export const WALLET_PRINT_ADDRESS =
  (import.meta.env.VITE_WALLET_PRINT_ADDRESS as `0x${string}` | undefined) ?? ZERO_ADDRESS;

export const WALLET_PRINT_ABI = parseAbi([
  'function mint() external',
  'function totalSupply() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function hasMinted(address) view returns (bool)',
  'function tokenSeed(uint256) view returns (bytes32)',
  'event Minted(address indexed to, uint256 indexed tokenId, bytes32 tokenSeed)',
]) as Abi;

export const CONTRACT_READY = WALLET_PRINT_ADDRESS !== ZERO_ADDRESS;
