// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {WalletPrint} from "../src/WalletPrint.sol";

contract WalletPrintTest is Test {
    WalletPrint public walletPrint;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        walletPrint = new WalletPrint();
    }

    function commitAndReveal(address minter, bytes32 secret) internal {
        vm.prank(minter);
        walletPrint.commitMint(keccak256(abi.encode(secret, minter)));
        vm.roll(block.number + 1);
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
        walletPrint.commitMint(keccak256(abi.encode(bytes32(uint256(2)), alice)));
    }

    function testMintRevertsWhenSoldOut() public {
        vm.store(address(walletPrint), bytes32(uint256(7)), bytes32(uint256(6767)));

        bytes32 bobSecret = bytes32(uint256(1));
        vm.prank(bob);
        walletPrint.commitMint(keccak256(abi.encode(bobSecret, bob)));

        vm.roll(block.number + 1);
        vm.expectRevert("sold out");
        vm.prank(bob);
        walletPrint.revealMint(bobSecret);
    }

    function testPauseBlocksMintUntilUnpaused() public {
        walletPrint.pause();

        vm.expectRevert();
        vm.prank(alice);
        walletPrint.commitMint(keccak256(abi.encode(bytes32(uint256(1)), alice)));

        walletPrint.unpause();
        commitAndReveal(alice, bytes32(uint256(1)));

        assertEq(walletPrint.totalSupply(), 1);
    }
}
