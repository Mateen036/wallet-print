// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {WalletPrintSVG} from "./WalletPrintSVG.sol";

/// @dev L2 block counter and recent L2 block hashes on Arbitrum-style chains.
///      Robinhood Chain reports the Ethereum (L1) block number through
///      `block.number` and always returns zero from `blockhash()`, so both the
///      mint timing and the seed entropy are read from this precompile instead.
interface IArbSys {
    function arbBlockNumber() external view returns (uint256);
    function arbBlockHash(uint256 arbBlockNum) external view returns (bytes32);
}

contract WalletPrint is ERC721, Ownable, Pausable {
    uint256 public constant MAX_SUPPLY = 6767;

    /// @dev A reveal must land at least one chain block after the commit.
    uint256 public constant REVEAL_DELAY = 1;

    /// @dev How long a commitment stays revealable, in seconds. Denominated in
    ///      time on purpose: Robinhood Chain produces a block roughly every
    ///      0.1s, so a block-denominated window would be seconds long there
    ///      while the same number means ~50 minutes on Ethereum.
    uint256 public constant COMMIT_EXPIRY = 30 minutes;

    /// @dev `ArbSys.arbBlockHash` only resolves the most recent 256 L2 blocks,
    ///      so the commit block hash has to be captured within this many chain
    ///      blocks of the commit. `snapshotCommitment` is permissionless and the
    ///      frontend calls it right after the commit confirms; a reveal inside
    ///      the window also snapshots lazily, inline.
    uint256 public constant SNAPSHOT_WINDOW = 250;

    /// @dev ArbSys precompile — same address on every Arbitrum L2.
    address private constant ARB_SYS = address(0x64);

    /// @dev Probed once at deploy. Chains without ArbSys (local Anvil, Ethereum)
    ///      keep plain `block.number` / `blockhash` semantics.
    bool private _arbSysAvailable;

    uint256 private _tokenIdCounter;
    mapping(address => bool) public hasMinted;
    mapping(address => uint256) public mintedTokenId;
    mapping(address => bytes32) public mintCommitment;
    mapping(address => uint256) public commitmentBlock;
    mapping(address => uint256) public commitmentTime;
    mapping(address => bytes32) public commitBlockHash;
    mapping(uint256 => bytes32) public tokenSeed;
    string private _walletPrintBaseURI;

    event MintCommitted(address indexed to, bytes32 commitment, uint256 commitmentBlock);
    event CommitmentSnapshotted(address indexed to, uint256 commitmentBlock, bytes32 blockHash);
    event Minted(address indexed to, uint256 indexed tokenId, bytes32 seed);

    constructor() ERC721("Wallet Print", "WPRINT") Ownable(msg.sender) {
        _arbSysAvailable = _probeArbSys();
    }

    function _probeArbSys() private view returns (bool) {
        (bool ok, bytes memory data) = ARB_SYS.staticcall(
            abi.encodeWithSelector(IArbSys.arbBlockNumber.selector)
        );
        return ok && data.length == 32;
    }

    /// @dev The block counter every timing check and every UI countdown uses.
    ///      Equal to `eth_blockNumber` on Robinhood Chain.
    function currentBlock() public view returns (uint256) {
        if (_arbSysAvailable) {
            return IArbSys(ARB_SYS).arbBlockNumber();
        }
        return block.number;
    }

    function commitMint(bytes32 commitment) external whenNotPaused {
        require(!hasMinted[msg.sender], "already minted");
        require(_tokenIdCounter < MAX_SUPPLY, "sold out");
        require(commitment != bytes32(0), "empty commitment");
        // A live (non-expired) commitment cannot be replaced. Without this, a
        // wallet could inspect the seed its commit block would produce and
        // re-commit until it lands on a favorable print, for free. Forcing each
        // attempt to be revealed or to wait out the full COMMIT_EXPIRY window
        // makes grinding for rarity expensive in time.
        require(
            mintCommitment[msg.sender] == bytes32(0)
                || block.timestamp > commitmentTime[msg.sender] + COMMIT_EXPIRY,
            "commitment still active"
        );

        mintCommitment[msg.sender] = commitment;
        commitmentBlock[msg.sender] = currentBlock();
        commitmentTime[msg.sender] = block.timestamp;
        delete commitBlockHash[msg.sender];

        emit MintCommitted(msg.sender, commitment, commitmentBlock[msg.sender]);
    }

    /// @notice Captures the commit block hash for `minter` before the precompile
    ///         window closes. Permissionless by design: the frontend sends it
    ///         immediately after the commit confirms, which is what keeps
    ///         `revealMint` usable for the whole COMMIT_EXPIRY window.
    function snapshotCommitment(address minter) external {
        _snapshotCommitBlock(minter);
    }

    /// @dev Stores the hash of the block that included the commitment.
    ///
    ///      That block does not exist yet while the commit transaction is being
    ///      signed, so the resulting artwork is unknowable at commit time — the
    ///      property the commit-reveal flow depends on. Robinhood Chain returns
    ///      zero from `blockhash()`, so the value comes from the ArbSys
    ///      precompile there; elsewhere `blockhash()` already works.
    function _snapshotCommitBlock(address minter) private returns (bytes32) {
        require(mintCommitment[minter] != bytes32(0), "no commitment");

        bytes32 stored = commitBlockHash[minter];
        if (stored != bytes32(0)) return stored;

        uint256 committedAt = commitmentBlock[minter];
        uint256 elapsed = currentBlock() - committedAt;
        require(elapsed > 0 && elapsed <= SNAPSHOT_WINDOW, "snapshot window closed");

        bytes32 captured = _commitBlockHash(committedAt);
        require(captured != bytes32(0), "commit block hash unavailable");

        commitBlockHash[minter] = captured;
        emit CommitmentSnapshotted(minter, committedAt, captured);
        return captured;
    }

    function _commitBlockHash(uint256 committedAt) private view returns (bytes32) {
        if (!_arbSysAvailable) return blockhash(committedAt);
        try IArbSys(ARB_SYS).arbBlockHash(committedAt) returns (bytes32 commitHash) {
            return commitHash;
        } catch {
            revert("commit block hash unavailable");
        }
    }

    function revealMint(bytes32 secret) external whenNotPaused {
        require(!hasMinted[msg.sender], "already minted");
        require(_tokenIdCounter < MAX_SUPPLY, "sold out");

        bytes32 commitment = mintCommitment[msg.sender];
        require(commitment != bytes32(0), "no commitment");

        uint256 committedAt = commitmentBlock[msg.sender];
        require(currentBlock() >= committedAt + REVEAL_DELAY, "wait one block");
        require(block.timestamp <= commitmentTime[msg.sender] + COMMIT_EXPIRY, "commit expired");
        require(keccak256(abi.encode(secret, msg.sender)) == commitment, "invalid secret");

        // Entropy for the artwork seed. The commit block hash cannot exist while
        // the commit is being signed, so the minter cannot preview the print
        // offline and re-commit until a rare one appears.
        bytes32 entropy = _snapshotCommitBlock(msg.sender);

        delete mintCommitment[msg.sender];
        delete commitmentBlock[msg.sender];
        delete commitmentTime[msg.sender];
        delete commitBlockHash[msg.sender];

        uint256 tokenId = ++_tokenIdCounter;
        hasMinted[msg.sender] = true;
        mintedTokenId[msg.sender] = tokenId;

        bytes32 seed = keccak256(abi.encode(secret, msg.sender, tokenId, entropy));

        tokenSeed[tokenId] = seed;

        _safeMint(msg.sender, tokenId);
        emit Minted(msg.sender, tokenId, seed);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        if (bytes(_walletPrintBaseURI).length > 0) {
            return string.concat(_walletPrintBaseURI, Strings.toString(tokenId));
        }

        bytes32 seed = tokenSeed[tokenId];

        (
            string memory svg,
            string memory paletteName,
            uint8 corners,
            uint8 pattern,
            uint8 printMode,
            uint8 distortion,
            uint8 rotations,
            uint8 layerCount,
            uint8 density
        ) = WalletPrintSVG.generateSVG(seed);

        string memory image = string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(svg)));

        string memory json = string.concat(
            '{"name":"Wallet Print #',
            Strings.toString(tokenId),
            '","description":"A generative print created from the deterministic identity of a blockchain mint.",',
            '"image":"',
            image,
            '","attributes":[',
            '{"trait_type":"Seed","value":"',
            Strings.toHexString(uint256(seed), 32),
            '"},{"trait_type":"Palette","value":"',
            paletteName,
            '"},{"trait_type":"Corners","value":"',
            Strings.toString(corners),
            '"},{"trait_type":"Pattern","value":"',
            WalletPrintSVG.patternLabel(pattern),
            '"},{"trait_type":"Print Mode","value":"',
            WalletPrintSVG.printModeLabel(printMode),
            '"},{"trait_type":"Distortion","value":"',
            WalletPrintSVG.distortionLabel(distortion),
            '"},{"trait_type":"Rotation","value":"',
            WalletPrintSVG.rotationLabel(rotations),
            '"},{"trait_type":"Layers","value":"',
            Strings.toString(layerCount),
            '"},{"trait_type":"Density","value":"',
            WalletPrintSVG.densityLabel(density),
            '"}]}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function setBaseURI(string memory baseURI_) external onlyOwner {
        _walletPrintBaseURI = baseURI_;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }

    /// @dev Disabled: an accidental (or malicious) call would permanently lock
    ///      `pause`, `unpause`, and `setBaseURI` with no recovery path. Use
    ///      `transferOwnership` to move to a new owner (e.g. a multisig)
    ///      instead of renouncing.
    function renounceOwnership() public view override onlyOwner {
        revert("renounce disabled");
    }
}
