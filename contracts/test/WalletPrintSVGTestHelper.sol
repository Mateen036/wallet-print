// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {WalletPrintSVG} from "../src/WalletPrintSVG.sol";

/// @dev Test helper that exposes `WalletPrintSVG` internal library functions
///      so Foundry tests can directly verify correctness of each function.
contract WalletPrintSVGTestHelper {
    function buildGrid(bytes32 seed) external pure returns (uint256 grid) {
        return WalletPrintSVG.buildGrid(seed);
    }

    struct GeneratedPrint {
        string svg;
        string paletteName;
        uint8 corners;
        uint8 pattern;
        uint8 printMode;
        uint8 distortion;
        uint8 rotations;
        uint8 layerCount;
        uint8 density;
    }

    /// @dev Returns a struct (not 9 loose return values): the wide tuple
    ///      made the via-IR pipeline hit "stack too deep" in computeTransforms.
    function generateSVG(bytes32 seed) external pure returns (GeneratedPrint memory g) {
        (
            g.svg, g.paletteName, g.corners, g.pattern, g.printMode,
            g.distortion, g.rotations, g.layerCount, g.density
        ) = WalletPrintSVG.generateSVG(seed);
    }

    function findConnectedComponents(uint256 grid)
        external
        pure
        returns (WalletPrintSVG.GeomRect[] memory rects)
    {
        return WalletPrintSVG.findConnectedComponents(grid);
    }

    function buildGridPattern(uint256 grid)
        external
        pure
        returns (WalletPrintSVG.GeomRect[] memory rects)
    {
        return WalletPrintSVG.buildGridPattern(grid);
    }

    function buildStripesPattern(uint256 grid)
        external
        pure
        returns (WalletPrintSVG.GeomRect[] memory rects)
    {
        return WalletPrintSVG.buildStripesPattern(grid);
    }

    function buildFragmentsPattern(uint256 grid)
        external
        pure
        returns (WalletPrintSVG.GeomRect[] memory rects)
    {
        return WalletPrintSVG.buildFragmentsPattern(grid);
    }

    function buildClustersPattern(uint256 grid)
        external
        pure
        returns (WalletPrintSVG.GeomRect[] memory rects)
    {
        return WalletPrintSVG.buildClustersPattern(grid);
    }

    function assignToPlates(WalletPrintSVG.GeomRect[] memory sorted, uint8 layerCount)
        external
        pure
        returns (
            uint256 kCount, WalletPrintSVG.GeomRect[] memory kRects,
            uint256 cCount, WalletPrintSVG.GeomRect[] memory cRects,
            uint256 mCount, WalletPrintSVG.GeomRect[] memory mRects,
            uint256 yCount, WalletPrintSVG.GeomRect[] memory yRects,
            uint8 activeCount
        )
    {
        return WalletPrintSVG.assignToPlates(sorted, layerCount);
    }

    function patternLabel(uint8 p) external pure returns (string memory) {
        return WalletPrintSVG.patternLabel(p);
    }

    function printModeLabel(uint8 p) external pure returns (string memory) {
        return WalletPrintSVG.printModeLabel(p);
    }

    function distortionLabel(uint8 d) external pure returns (string memory) {
        return WalletPrintSVG.distortionLabel(d);
    }

    function densityLabel(uint8 d) external pure returns (string memory) {
        return WalletPrintSVG.densityLabel(d);
    }

    function rotationLabel(uint8 r) external pure returns (string memory) {
        return WalletPrintSVG.rotationLabel(r);
    }
}
