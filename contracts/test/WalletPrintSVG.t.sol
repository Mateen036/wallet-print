// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {WalletPrintSVG} from "../src/WalletPrintSVG.sol";
import {WalletPrintSVGTestHelper} from "./WalletPrintSVGTestHelper.sol";

/// @dev Covers the on-chain SVG generator and pins it to the JS generator
///      (`src/generator/*`). The parity vectors below come from
///      `node src/generator/parity.test.ts` / `extractTraits` on the JS side.
///      If you change trait order, PRNG init or plate assignment on either
///      side, update the other and these vectors.
contract WalletPrintSVGTest is Test {
    WalletPrintSVGTestHelper internal h;

    function setUp() public {
        h = new WalletPrintSVGTestHelper();
    }

    // ---- grid ----------------------------------------------------------

    function testBuildGridProcessesFull256Seed() public view {
        assertEq(h.buildGrid(bytes32(type(uint256).max)), type(uint256).max);
    }

    function testBuildGridWithZeroSeed() public view {
        assertEq(h.buildGrid(bytes32(0)), 0);
    }

    // ---- JS <-> Solidity trait parity ---------------------------------

    function _assertTraits(
        bytes32 seed,
        string memory palette,
        uint8 corners,
        uint8 pattern,
        uint8 printMode,
        uint8 distortion,
        uint8 rotations,
        uint8 layerCount,
        uint8 density
    ) internal view {
        WalletPrintSVGTestHelper.GeneratedPrint memory g = h.generateSVG(seed);
        assertEq(g.paletteName, palette, "palette");
        assertEq(g.corners, corners, "corners");
        assertEq(g.pattern, pattern, "pattern");
        assertEq(g.printMode, printMode, "printMode");
        assertEq(g.distortion, distortion, "distortion");
        assertEq(g.rotations, rotations, "rotations");
        assertEq(g.layerCount, layerCount, "layerCount");
        assertEq(g.density, density, "density");
        assertGt(bytes(g.svg).length, 0, "svg empty");
    }

    function testTraitParitySeedOne() public view {
        _assertTraits(bytes32(uint256(1)), "CMYK-10", 2, 3, 2, 3, 3, 1, 2);
    }

    function testTraitParitySeedFF() public view {
        _assertTraits(bytes32(uint256(0xff)), "CMYK-07", 2, 2, 2, 2, 3, 2, 2);
    }

    function testTraitParityPatternedSeed() public view {
        _assertTraits(
            bytes32(0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef),
            "CMYK-05", 1, 1, 2, 1, 0, 1, 2
        );
    }

    function testTraitsAreInRange(bytes32 seed) public view {
        WalletPrintSVGTestHelper.GeneratedPrint memory g = h.generateSVG(seed);
        assertTrue(g.corners >= 1 && g.corners <= 5, "corners");
        assertLe(g.pattern, 4);
        assertLe(g.printMode, 3);
        assertLe(g.distortion, 3);
        assertLe(g.rotations, 3);
        assertTrue(g.layerCount >= 1 && g.layerCount <= 4, "layers");
        assertLe(g.density, 3);
        assertGt(bytes(g.paletteName).length, 0);
    }

    // ---- geometry edge cases ------------------------------------------

    function testFindConnectedComponentsEmpty() public view {
        assertEq(h.findConnectedComponents(0).length, 0);
    }

    function testFindConnectedComponentsSingleCell() public view {
        WalletPrintSVG.GeomRect[] memory r = h.findConnectedComponents(1);
        assertEq(r.length, 1);
        assertEq(r[0].area, 1);
    }

    function testBuildGridPatternEmpty() public view {
        assertEq(h.buildGridPattern(0).length, 0);
    }

    function testBuildGridPatternSingleCell() public view {
        assertEq(h.buildGridPattern(1).length, 1);
    }

    // ---- plate assignment ---------------------------------------------

    function testAssignToPlatesEmpty() public view {
        WalletPrintSVG.GeomRect[] memory empty = new WalletPrintSVG.GeomRect[](0);
        (uint256 k,, uint256 c,, uint256 m,, uint256 y,, uint8 active) = h.assignToPlates(empty, 1);
        assertEq(k, 0);
        assertEq(c, 0);
        assertEq(m, 0);
        assertEq(y, 0);
        assertEq(active, 1);
    }

    function testAssignToPlates256Elements() public view {
        WalletPrintSVG.GeomRect[] memory sorted = new WalletPrintSVG.GeomRect[](256);
        for (uint256 i = 0; i < 256; i++) sorted[i] = WalletPrintSVG.GeomRect(0, 0, 1, 1, 1, 0);
        (uint256 k,, uint256 c,, uint256 m,, uint256 y,, uint8 active) = h.assignToPlates(sorted, 4);
        assertEq(k, 128);
        assertEq(c, 43);
        assertEq(m, 43);
        assertEq(y, 42);
        assertEq(active, 4);
    }

    // ---- end-to-end ----------------------------------------------------

    function testGenerateSVGIsDeterministic() public view {
        bytes32 seed = keccak256("determinism");
        assertEq(h.generateSVG(seed).svg, h.generateSVG(seed).svg);
    }

    function testGenerateSVGDoesNotRevertOnManySeeds() public view {
        for (uint256 i = 0; i < 64; i++) {
            assertGt(bytes(h.generateSVG(keccak256(abi.encode(i))).svg).length, 0);
        }
    }
}
