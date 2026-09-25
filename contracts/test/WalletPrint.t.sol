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

    function testMintStoresSeedAndIncrementsSupply() public {
        vm.prank(alice);
        walletPrint.mint();

        assertEq(walletPrint.totalSupply(), 1);
        assertTrue(walletPrint.hasMinted(alice));
        assertNotEq(walletPrint.tokenSeed(1), bytes32(0));
        assertEq(walletPrint.ownerOf(1), alice);
    }

    function testMintRevertsForDuplicateWallet() public {
        vm.prank(alice);
        walletPrint.mint();

        vm.expectRevert("already minted");
        vm.prank(alice);
        walletPrint.mint();
    }

    function testMintRevertsWhenSoldOut() public {
        for (uint256 i = 0; i < 6767; i++) {
            address minter = vm.addr(uint256(keccak256(abi.encode(i))));
            vm.prank(minter);
            walletPrint.mint();
        }

        vm.expectRevert("sold out");
        vm.prank(bob);
        walletPrint.mint();
    }
}
