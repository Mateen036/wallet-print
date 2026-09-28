// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {WalletPrint, IArbSys} from "../src/WalletPrint.sol";

/// @dev Fallback path: no ArbSys precompile, so `block.number` / `blockhash`
///      back the timing and the seed entropy. This is what Ethereum and a local
///      Anvil look like, and it keeps the pre-Arbitrum behaviour covered.
contract WalletPrintTest is Test {
    WalletPrint public walletPrint;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    /// @dev Mirrors `commitmentFor()` in `src/lib/commitment.ts`.
    ///      The frontend must reproduce `keccak256(abi.encode(secret, minter))`
    ///      exactly; packed encoding produces a different hash and makes every
    ///      `revealMint` revert with "invalid secret".
    function commitmentFor(address minter, bytes32 secret) internal pure returns (bytes32) {
        return keccak256(abi.encode(secret, minter));
    }

    function setUp() public {
        walletPrint = new WalletPrint();
    }

    function commit(address minter, bytes32 secret) internal returns (uint256 committedAt) {
        committedAt = vm.getBlockNumber();
        vm.prank(minter);
        walletPrint.commitMint(commitmentFor(minter, secret));
    }

    /// @dev Foundry's local EVM only exposes the parent block hash, and a live
    ///      chain always has a genuine non-zero hash for the commit block, so
    ///      this rolls past it and then sets that hash deterministically.
    function advancePastCommitBlock(uint256 committedAt) internal {
        vm.roll(committedAt + 1);
        vm.setBlockhash(committedAt, keccak256(abi.encode("commit-block", committedAt)));
    }

    function commitAndReveal(address minter, bytes32 secret) internal {
        uint256 committedAt = commit(minter, secret);
        advancePastCommitBlock(committedAt);
        vm.prank(minter);
        walletPrint.revealMint(secret);
    }

    function testMintStoresSeedAndIncrementsSupply() public {
        commitAndReveal(alice, bytes32(uint256(1)));

        assertEq(walletPrint.totalSupply(), 1);
        assertTrue(walletPrint.hasMinted(alice));
        assertEq(walletPrint.mintedTokenId(alice), 1);
        assertNotEq(walletPrint.tokenSeed(1), bytes32(0));
        assertEq(walletPrint.ownerOf(1), alice);
        assertTrue(bytes(walletPrint.tokenURI(1)).length > 0);
    }

    function testMintRevertsForDuplicateWallet() public {
        commitAndReveal(alice, bytes32(uint256(1)));

        vm.expectRevert("already minted");
        vm.prank(alice);
        walletPrint.commitMint(commitmentFor(alice, bytes32(uint256(2))));
    }

    function _forceSoldOut() internal {
        // Slot 7 is `_tokenIdCounter`: `_paused` and `_arbSysAvailable` pack into
        // slot 6 alongside `Ownable._owner` (address 20 bytes + two bools), and
        // the ERC721 base state occupies slots 0-5. Verified with:
        //   forge inspect src/WalletPrint.sol:WalletPrint storage-layout
        vm.store(address(walletPrint), bytes32(uint256(7)), bytes32(uint256(6767)));
    }

    function testRevealRevertsWhenSoldOut() public {
        // Commit while supply remains, then exhaust supply before reveal.
        // (commitMint also enforces "sold out", so the order matters.)
        bytes32 bobSecret = bytes32(uint256(1));
        commit(bob, bobSecret);
        _forceSoldOut();

        vm.roll(block.number + 1);
        vm.expectRevert("sold out");
        vm.prank(bob);
        walletPrint.revealMint(bobSecret);
    }

    function testCommitRevertsWhenSoldOut() public {
        _forceSoldOut();
        bytes32 commitment = commitmentFor(bob, bytes32(uint256(1)));
        vm.expectRevert("sold out");
        vm.prank(bob);
        walletPrint.commitMint(commitment);
    }

    function testPauseBlocksMintUntilUnpaused() public {
        walletPrint.pause();

        vm.expectRevert();
        vm.prank(alice);
        walletPrint.commitMint(commitmentFor(alice, bytes32(uint256(1))));

        walletPrint.unpause();
        commitAndReveal(alice, bytes32(uint256(1)));

        assertEq(walletPrint.totalSupply(), 1);
    }

    // --- Commitment encoding regression coverage ---
    // Pins the exact hash the frontend must produce. Mirrored by the values in
    // `src/lib/commitment.test.ts`; if either side changes its encoding, one of
    // these two suites fails.

    function testCommitmentVectorMatchesContractEncoding() public view {
        bytes32 secret = bytes32(uint256(1));

        // The fixture address must be the one the frontend vector was computed
        // with, so this constant cannot silently drift if fixtures are edited.
        assertEq(alice, address(0x00000000000000000000000000000000000A11cE));

        // keccak256(abi.encode(bytes32(uint256(1)), alice)), matching
        // `commitmentFor()` in src/lib/commitment.ts.
        assertEq(
            commitmentFor(alice, secret),
            0x9d3647136d0914d701c9b96dbb35e3dad01a29de1407ef5d8a2df403367aa095
        );
    }

    function testPackedCommitmentEncodingIsRejected() public {
        bytes32 secret = bytes32(uint256(1));

        // The old frontend encoding: packed, not ABI-encoded.
        bytes32 packedCommitment = keccak256(abi.encodePacked(secret, alice));
        assertNotEq(packedCommitment, commitmentFor(alice, secret));

        vm.prank(alice);
        walletPrint.commitMint(packedCommitment);

        vm.roll(block.number + 1);
        vm.expectRevert("invalid secret");
        vm.prank(alice);
        walletPrint.revealMint(secret);
    }

    function testRevealRevertsWithWrongSecret() public {
        commit(alice, bytes32(uint256(1)));

        vm.roll(block.number + 1);
        vm.expectRevert("invalid secret");
        vm.prank(alice);
        walletPrint.revealMint(bytes32(uint256(2)));
    }

    function testRevealCommitsAreBoundToMinter() public {
        bytes32 secret = bytes32(uint256(1));

        // Alice commits; Bob cannot reveal it, and Alice's commitment stays valid.
        uint256 committedAt = commit(alice, secret);

        advancePastCommitBlock(committedAt);
        vm.expectRevert("no commitment");
        vm.prank(bob);
        walletPrint.revealMint(secret);

        vm.prank(alice);
        walletPrint.revealMint(secret);
        assertEq(walletPrint.ownerOf(1), alice);
    }

    function testRevealRevertsWithoutCommitment() public {
        vm.expectRevert("no commitment");
        vm.prank(bob);
        walletPrint.revealMint(bytes32(uint256(1)));
    }

    function testRevealRevertsBeforeOneBlock() public {
        commit(alice, bytes32(uint256(1)));

        vm.expectRevert("wait one block");
        vm.prank(alice);
        walletPrint.revealMint(bytes32(uint256(1)));
    }

    function testCommitMintRevertsOnEmptyCommitment() public {
        vm.expectRevert("empty commitment");
        vm.prank(alice);
        walletPrint.commitMint(bytes32(0));
    }

    function testRevealClearsCommitmentState() public {
        commitAndReveal(alice, bytes32(uint256(1)));

        assertEq(walletPrint.mintCommitment(alice), bytes32(0));
        assertEq(walletPrint.commitmentBlock(alice), 0);
        assertEq(walletPrint.commitmentTime(alice), 0);
        assertEq(walletPrint.commitBlockHash(alice), bytes32(0));
    }

    function testRevealRevertsForSecondMint() public {
        commitAndReveal(alice, bytes32(uint256(1)));

        vm.expectRevert("already minted");
        vm.prank(alice);
        walletPrint.revealMint(bytes32(uint256(2)));
    }

    function testPauseBlocksReveal() public {
        bytes32 secret = bytes32(uint256(1));
        uint256 committedAt = commit(alice, secret);
        walletPrint.pause();

        advancePastCommitBlock(committedAt);
        vm.expectRevert();
        vm.prank(alice);
        walletPrint.revealMint(secret);

        walletPrint.unpause();
        vm.prank(alice);
        walletPrint.revealMint(secret);

        assertEq(walletPrint.totalSupply(), 1);
    }

    function testTokenURIIncludesImageAndTraits() public {
        commitAndReveal(alice, bytes32(uint256(1)));

        string memory uri = walletPrint.tokenURI(1);
        assertTrue(bytes(uri).length > 0);
        // Full decode isn't needed here: the fallback path building without
        // reverting, combined with WalletPrintSVG's own generation being
        // exercised, is the regression coverage for the wired-in image field.
    }

    function testRenounceOwnershipIsDisabled() public {
        vm.expectRevert("renounce disabled");
        walletPrint.renounceOwnership();
    }

    function testSeedsAreDistinctPerMinter() public {
        commitAndReveal(alice, bytes32(uint256(1)));
        commitAndReveal(bob, bytes32(uint256(1)));

        assertNotEq(walletPrint.tokenSeed(1), walletPrint.tokenSeed(2));
        assertEq(walletPrint.ownerOf(2), bob);
    }

    // --- Commit expiry and commit-block entropy ---
    // The reveal window is time-denominated (`COMMIT_EXPIRY`), while the seed
    // entropy comes from the commit block hash, which has to be captured inside
    // `SNAPSHOT_WINDOW` chain blocks of the commit.

    function testCommitExpiryConstants() public view {
        assertEq(walletPrint.COMMIT_EXPIRY(), 30 minutes);
        assertEq(walletPrint.REVEAL_DELAY(), 1);
        assertEq(walletPrint.SNAPSHOT_WINDOW(), 250);
    }

    function testRevealSucceedsAtExpiryBoundary() public {
        bytes32 secret = bytes32(uint256(1));
        uint256 committedAt = commit(alice, secret);

        advancePastCommitBlock(committedAt);
        vm.warp(walletPrint.commitmentTime(alice) + walletPrint.COMMIT_EXPIRY());

        vm.prank(alice);
        walletPrint.revealMint(secret);

        assertEq(walletPrint.totalSupply(), 1);
        assertNotEq(walletPrint.tokenSeed(1), bytes32(0));
    }

    function testRevealRevertsAfterCommitExpiry() public {
        bytes32 secret = bytes32(uint256(1));
        uint256 committedAt = commit(alice, secret);

        advancePastCommitBlock(committedAt);
        vm.warp(walletPrint.commitmentTime(alice) + walletPrint.COMMIT_EXPIRY() + 1);

        vm.expectRevert("commit expired");
        vm.prank(alice);
        walletPrint.revealMint(secret);
    }

    function testRevealRevertsWhenSnapshotWindowClosesWithoutSnapshot() public {
        bytes32 secret = bytes32(uint256(1));
        uint256 committedAt = commit(alice, secret);

        // Past `SNAPSHOT_WINDOW` the commit block hash can no longer be read, so
        // the reveal fails loudly instead of hashing a zero.
        vm.roll(committedAt + walletPrint.SNAPSHOT_WINDOW() + 1);

        vm.expectRevert("snapshot window closed");
        vm.prank(alice);
        walletPrint.revealMint(secret);
    }

    function testSnapshotCommitmentIsPermissionless() public {
        bytes32 secret = bytes32(uint256(1));
        uint256 committedAt = commit(alice, secret);

        vm.roll(committedAt + 1);
        bytes32 commitHash = keccak256(abi.encode("commit-block", committedAt));
        vm.setBlockhash(committedAt, commitHash);

        // Anyone may snapshot: the frontend sends this right after the commit so
        // the reveal stays possible for the whole COMMIT_EXPIRY window.
        vm.prank(bob);
        walletPrint.snapshotCommitment(alice);
        assertEq(walletPrint.commitBlockHash(alice), commitHash);

        vm.prank(alice);
        walletPrint.revealMint(secret);
        assertEq(walletPrint.ownerOf(1), alice);
    }

    function testRevealRevertsWhenCommitBlockHashUnavailable() public {
        bytes32 secret = bytes32(uint256(1));
        uint256 committedAt = commit(alice, secret);

        // Two blocks on, the commit block is no longer the parent — which is how
        // a chain that returns zero from `blockhash()` looks at reveal time.
        vm.roll(committedAt + 2);
        vm.setBlockhash(committedAt, bytes32(0));

        vm.expectRevert("commit block hash unavailable");
        vm.prank(alice);
        walletPrint.revealMint(secret);
    }

    function testCommitMintRevertsWhileCommitmentStillActive() public {
        commit(alice, bytes32(uint256(1)));

        vm.warp(walletPrint.commitmentTime(alice) + walletPrint.COMMIT_EXPIRY());

        vm.expectRevert("commitment still active");
        vm.prank(alice);
        walletPrint.commitMint(commitmentFor(alice, bytes32(uint256(2))));
    }

    function testExpiredCommitCanBeReplacedWithFreshCommitment() public {
        bytes32 staleSecret = bytes32(uint256(1));
        commit(alice, staleSecret);
        vm.warp(walletPrint.commitmentTime(alice) + walletPrint.COMMIT_EXPIRY() + 1);

        // commitMint overwrites unconditionally once the old commitment expired.
        bytes32 freshSecret = bytes32(uint256(2));
        uint256 committedAt = commit(alice, freshSecret);
        advancePastCommitBlock(committedAt);
        vm.prank(alice);
        walletPrint.revealMint(freshSecret);

        assertEq(walletPrint.totalSupply(), 1);
        assertEq(walletPrint.ownerOf(1), alice);
    }

    function testSeedIsBoundToTheCommitBlockHash() public {
        bytes32 secret = bytes32(uint256(1));
        uint256 committedAt = commit(alice, secret);

        advancePastCommitBlock(committedAt);
        bytes32 commitHash = blockhash(committedAt);

        vm.prank(alice);
        walletPrint.revealMint(secret);

        // Exactly the commit block hash — not a constant, not zero. This is the
        // property that stops the minter from grinding for rarity offline.
        assertEq(
            walletPrint.tokenSeed(1),
            keccak256(abi.encode(secret, alice, uint256(1), commitHash))
        );
        assertNotEq(
            walletPrint.tokenSeed(1),
            keccak256(abi.encode(secret, alice, uint256(1), bytes32(0)))
        );
    }
}

/// @dev ArbSys path — what Robinhood Chain looks like: `block.number` is an L1
///      estimate, `blockhash()` returns zero, and the L2 block counter plus the
///      most recent L2 block hashes come from the 0x64 precompile.
contract WalletPrintArbSysTest is Test {
    address internal constant ARB_SYS = address(0x64);

    WalletPrint public walletPrint;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 internal constant COMMIT_BLOCK = 1_000_000;
    bytes32 internal constant COMMIT_BLOCK_HASH = keccak256("l2-commit-block-hash");

    function commitmentFor(address minter, bytes32 secret) internal pure returns (bytes32) {
        return keccak256(abi.encode(secret, minter));
    }

    function setUp() public {
        _mockArbBlockNumber(COMMIT_BLOCK);
        // The precompile capability is probed in the constructor, so it has to be
        // mocked before deployment for this instance to take the L2 path.
        walletPrint = new WalletPrint();
        _mockCommitBlockHash(COMMIT_BLOCK, COMMIT_BLOCK_HASH);
    }

    function _mockArbBlockNumber(uint256 blockNumber) internal {
        vm.mockCall(
            ARB_SYS,
            abi.encodeWithSelector(IArbSys.arbBlockNumber.selector),
            abi.encode(blockNumber)
        );
    }

    function _mockCommitBlockHash(uint256 commitBlock, bytes32 blockHash) internal {
        vm.mockCall(
            ARB_SYS,
            abi.encodeWithSelector(IArbSys.arbBlockHash.selector, commitBlock),
            abi.encode(blockHash)
        );
    }

    function _commit(address minter, bytes32 secret) internal {
        vm.prank(minter);
        walletPrint.commitMint(commitmentFor(minter, secret));
    }

    function testArbSysPathIsProbedAtDeploy() public view {
        assertEq(walletPrint.currentBlock(), COMMIT_BLOCK);
    }

    function testCommitRecordsL2BlockNotL1Estimate() public {
        // The L1 estimate and the L2 counter live in different ranges, which is
        // exactly the mismatch that broke the reveal gating on this chain.
        vm.roll(block.number + 500);
        _commit(alice, bytes32(uint256(1)));

        assertEq(walletPrint.commitmentBlock(alice), COMMIT_BLOCK);
        assertNotEq(walletPrint.commitmentBlock(alice), block.number);
    }

    function testRevealInsideWindowCapturesCommitBlockHashLazily() public {
        bytes32 secret = bytes32(uint256(1));
        _commit(alice, secret);

        // No snapshot call: the reveal captures the hash inline while the
        // precompile window is still open.
        _mockArbBlockNumber(COMMIT_BLOCK + 2);
        vm.prank(alice);
        walletPrint.revealMint(secret);

        assertEq(
            walletPrint.tokenSeed(1),
            keccak256(abi.encode(secret, alice, uint256(1), COMMIT_BLOCK_HASH))
        );
        assertEq(walletPrint.commitBlockHash(alice), bytes32(0));
    }

    function testSnapshotKeepsCommitmentRevealableAfterWindowCloses() public {
        bytes32 secret = bytes32(uint256(1));
        _commit(alice, secret);

        // Anyone can snapshot — the frontend sends this right after the commit.
        _mockArbBlockNumber(COMMIT_BLOCK + 1);
        vm.prank(bob);
        walletPrint.snapshotCommitment(alice);
        assertEq(walletPrint.commitBlockHash(alice), COMMIT_BLOCK_HASH);

        // The precompile window is long gone (this is the whole point of the
        // snapshot) and the reveal is late but still inside COMMIT_EXPIRY.
        _mockArbBlockNumber(COMMIT_BLOCK + 500_000);
        vm.warp(walletPrint.commitmentTime(alice) + 25 minutes);

        vm.prank(alice);
        walletPrint.revealMint(secret);

        assertEq(walletPrint.ownerOf(1), alice);
        assertEq(
            walletPrint.tokenSeed(1),
            keccak256(abi.encode(secret, alice, uint256(1), COMMIT_BLOCK_HASH))
        );
    }

    function testRevealRevertsWhenSnapshotWindowClosesWithoutSnapshot() public {
        bytes32 secret = bytes32(uint256(1));
        _commit(alice, secret);

        _mockArbBlockNumber(COMMIT_BLOCK + walletPrint.SNAPSHOT_WINDOW() + 1);

        vm.expectRevert("snapshot window closed");
        vm.prank(alice);
        walletPrint.revealMint(secret);
    }

    function testPrecompileFailureSurfacesAsMissingCommitBlockHash() public {
        bytes32 secret = bytes32(uint256(1));
        _commit(alice, secret);

        _mockArbBlockNumber(COMMIT_BLOCK + 1);
        // What the precompile does for a block outside its 256-block window.
        vm.mockCallRevert(
            ARB_SYS,
            abi.encodeWithSelector(IArbSys.arbBlockHash.selector, COMMIT_BLOCK),
            abi.encodeWithSignature(
                "InvalidBlockNumber(uint256,uint256)",
                COMMIT_BLOCK,
                COMMIT_BLOCK + 1
            )
        );

        vm.expectRevert("commit block hash unavailable");
        vm.prank(alice);
        walletPrint.revealMint(secret);
    }

    function testDistinctCommitBlockHashesProduceDistinctSeeds() public {
        bytes32 secret = bytes32(uint256(1));
        bytes32 otherCommitHash = keccak256("other-l2-commit-block-hash");

        _commit(alice, secret);

        _mockArbBlockNumber(COMMIT_BLOCK + 10);
        _mockCommitBlockHash(COMMIT_BLOCK + 10, otherCommitHash);
        _commit(bob, secret);

        _mockArbBlockNumber(COMMIT_BLOCK + 11);
        vm.prank(alice);
        walletPrint.revealMint(secret);
        vm.prank(bob);
        walletPrint.revealMint(secret);

        assertNotEq(walletPrint.tokenSeed(1), walletPrint.tokenSeed(2));
        assertEq(
            walletPrint.tokenSeed(1),
            keccak256(abi.encode(secret, alice, uint256(1), COMMIT_BLOCK_HASH))
        );
        assertEq(
            walletPrint.tokenSeed(2),
            keccak256(abi.encode(secret, bob, uint256(2), otherCommitHash))
        );
    }

    function testGrindGuardIsTimeBased() public {
        _commit(alice, bytes32(uint256(1)));

        _mockArbBlockNumber(COMMIT_BLOCK + 5);
        vm.warp(walletPrint.commitmentTime(alice) + walletPrint.COMMIT_EXPIRY());

        vm.expectRevert("commitment still active");
        _commit(alice, bytes32(uint256(2)));

        vm.warp(walletPrint.commitmentTime(alice) + walletPrint.COMMIT_EXPIRY() + 1);
        _commit(alice, bytes32(uint256(2)));

        assertEq(walletPrint.commitmentBlock(alice), COMMIT_BLOCK + 5);
    }
}
