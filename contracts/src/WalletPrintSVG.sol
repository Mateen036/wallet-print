// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

library WalletPrintSVG {
    // ====== Constants ======
    // Must stay aligned with `src/generator/*`. See contracts/test/WalletPrintSVG.t.sol.
    uint256 internal constant SIZE = 640;
    uint256 internal constant MARGIN = 32;
    uint256 internal constant CELL = 36;
    uint256 internal constant HALF = 320;
    uint256 internal constant WARMUP = 8;
    int256 internal constant MICRO = 1_000_000;

    // ====== Palettes (copied from src/generator/palettes.ts) ======
    function getPalette(uint8 index) internal pure returns (string memory bg, string memory k, string memory c, string memory m, string memory y, bool dark, string memory name) {
        if (index == 0) return ("#FFFFFF","#0D0D0D","#00AEEF","#EC008C","#FFF100",false,"CMYK-01");
        if (index == 1) return ("#F5F0E8","#1A0F06","#1E4CB0","#CC2233","#C9980A",false,"CMYK-02");
        if (index == 2) return ("#FAFAFA","#0D0D0D","#333333","#666666","#999999",false,"CMYK-03");
        if (index == 3) return ("#EEF2FF","#0A1230","#1040CC","#8800CC","#BB9900",false,"CMYK-04");
        if (index == 4) return ("#FFF5F2","#1A0500","#BB3300","#AA0033","#CC7700",false,"CMYK-05");
        if (index == 5) return ("#F2F9EC","#060F02","#116622","#55991A","#CCEE00",false,"CMYK-06");
        if (index == 6) return ("#080808","#F2F2F2","#00CCFF","#FF2288","#FFEE00",true,"CMYK-07");
        if (index == 7) return ("#04101C","#C0DCFF","#3399EE","#1155CC","#66AAFF",true,"CMYK-08");
        if (index == 8) return ("#110006","#FFE0F4","#FF66BB","#EE0055","#FF5500",true,"CMYK-09");
        if (index == 9) return ("#050E06","#DFFFD8","#33EE66","#88EE22","#EEFF44",true,"CMYK-10");
        if (index == 10) return ("#0E0900","#FFFAD0","#FFD044","#FF9900","#E8FF44",true,"CMYK-11");
        if (index == 11) return ("#000000","#FFFFFF","#AAAAAA","#666666","#333333",true,"CMYK-12");
        if (index == 12) return ("#F2F0E6","#17151F","#00B8D9","#FF3D81","#B8F000",false,"NEON-13");
        if (index == 13) return ("#FFF1DE","#29120C","#007C91","#E43D30","#FF9E1B",false,"EMBER-14");
        if (index == 14) return ("#10151B","#F7F3E8","#00D9FF","#FF4FA3","#D4FF3F",true,"SIGNAL-15");
        return ("#120D20","#FFF4D6","#2ED8FF","#A66CFF","#FFCA3A",true,"VIOLET-16");
    }

    // ====== PRNG (xoshiro128**) ======
    struct PRNG { uint32 s0; uint32 s1; uint32 s2; uint32 s3; }

    function rotl(uint32 x, uint32 k) internal pure returns (uint32) {
        unchecked { return (x << k) | (x >> (32 - k)); }
    }

    function prngInit(bytes32 seed) internal pure returns (PRNG memory p) {
        // Mix ALL 32 bytes into xoshiro state (JS SeededRandom).
        p.s0 = uint32(bytes4(seed)) ^ uint32(bytes4(seed << 128));
        p.s1 = uint32(bytes4(seed << 32)) ^ uint32(bytes4(seed << 160));
        p.s2 = uint32(bytes4(seed << 64)) ^ uint32(bytes4(seed << 192));
        p.s3 = uint32(bytes4(seed << 96)) ^ uint32(bytes4(seed << 224));
        if (p.s0 == 0 && p.s1 == 0 && p.s2 == 0 && p.s3 == 0) p.s0 = 0xdeadbeef;
        for (uint256 i = 0; i < WARMUP; i++) {
            (, p) = prngNext(p);
        }
    }

    function prngNext(PRNG memory p) internal pure returns (uint32 result, PRNG memory next) {
        unchecked {
            uint32 s0 = p.s0; uint32 s1 = p.s1; uint32 s2 = p.s2; uint32 s3 = p.s3;
            result = rotl((s1 * 5) & 0xFFFFFFFF, 7) * 9 & 0xFFFFFFFF;
            uint32 t = s1 << 9;
            s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t; s3 = rotl(s3, 11);
            next = PRNG(s0, s1, s2, s3);
        }
    }

    function prngInt(PRNG memory p, uint8 n) internal pure returns (uint8 value, PRNG memory nextState) {
        (uint32 r, PRNG memory p2) = prngNext(p);
        nextState = p2;
        uint64 product = uint64(r) * uint64(n);
        value = uint8(product / 0x100000000);
    }

    /// @dev JS `rng.float(min, max)` in micro-units (1e6 = 1.0).
    function prngRange(PRNG memory p, int256 minS, int256 maxS) internal pure returns (int256 value, PRNG memory nextState) {
        (uint32 r, PRNG memory p2) = prngNext(p);
        nextState = p2;
        int256 span = maxS - minS;
        value = minS + int256((uint256(r) * uint256(span)) / 0x100000000);
    }

    function prngSignedRange(PRNG memory p, uint256 scale100) internal pure returns (int256 value, PRNG memory nextState) {
        return prngRange(p, -int256(scale100), int256(scale100));
    }

    // ====== Grid ======
    function getBit(uint256 grid, uint8 idx) internal pure returns (bool) {
        return ((grid >> (255 - idx)) & 1) == 1;
    }

    function setBit(uint256 grid, uint8 idx) internal pure returns (uint256) {
        return grid | (uint256(1) << (255 - idx));
    }

    function buildGrid(bytes32 seed) internal pure returns (uint256 grid) {
        // uint256 counter: a uint8 can never reach 256, so `i++` at 255 would
        // overflow and revert (checked arithmetic) — bricking generateSVG/tokenURI.
        for (uint256 i = 0; i < 256; i++) {
            uint256 byteIndex = i >> 3;
            uint256 bitOffset = 7 - (i & 7);
            if (((uint8(seed[byteIndex])) >> bitOffset) & 1 == 1) {
                grid |= (uint256(1) << (255 - i));
            }
        }
    }

    function rotate90(uint256 grid) internal pure returns (uint256 r) {
        for (uint8 row = 0; row < 16; row++) {
            for (uint8 col = 0; col < 16; col++) {
                uint8 oldIdx = row * 16 + col;
                if (getBit(grid, oldIdx)) {
                    uint8 newIdx = col * 16 + (15 - row);
                    r = setBit(r, newIdx);
                }
            }
        }
    }

    function applyRotation(uint256 grid, uint8 rotations) internal pure returns (uint256 result) {
        result = grid;
        for (uint8 i = 0; i < rotations; i++) result = rotate90(result);
    }

    // ====== Rarity ======
    function computeCorners(PRNG memory p) internal pure returns (uint8 corners, PRNG memory nextState) {
        (uint32 r, PRNG memory p2) = prngNext(p);
        uint256 score = uint256(r) * 6767;
        if (score < 4000 * 0x100000000) return (1, p2);
        if (score < 5700 * 0x100000000) return (2, p2);
        if (score < 6400 * 0x100000000) return (3, p2);
        if (score < 6700 * 0x100000000) return (4, p2);
        return (5, p2);
    }

    // ====== Trait labels ======
    function patternLabel(uint8 p) internal pure returns (string memory) {
        if (p == 0) return "Grid";
        if (p == 1) return "Blocks";
        if (p == 2) return "Stripes";
        if (p == 3) return "Fragments";
        return "Clusters";
    }

    function printModeLabel(uint8 p) internal pure returns (string memory) {
        if (p == 0) return "Registered";
        if (p == 1) return "Offset";
        if (p == 2) return "Drift";
        return "Misaligned";
    }

    function distortionLabel(uint8 d) internal pure returns (string memory) {
        if (d == 0) return "None";
        if (d == 1) return "Low";
        if (d == 2) return "Medium";
        return "High";
    }

    function densityLabel(uint8 d) internal pure returns (string memory) {
        if (d == 0) return "Sparse";
        if (d == 1) return "Light";
        if (d == 2) return "Medium";
        return "Dense";
    }

    function rotationLabel(uint8 r) internal pure returns (string memory) {
        if (r == 0) return unicode"0°";
        if (r == 1) return unicode"90°";
        if (r == 2) return unicode"180°";
        return unicode"270°";
    }

    // ====== Geometry ======
    struct GeomRect { uint8 x; uint8 y; uint8 w; uint8 h; uint16 area; uint8 shape; }

    function findConnectedComponents(uint256 grid) internal pure returns (GeomRect[] memory rects) {
        uint256 visited;
        GeomRect[] memory temp = new GeomRect[](256);
        uint256 count = 0;

        for (uint8 r = 0; r < 16; r++) {
            for (uint8 c = 0; c < 16; c++) {
                uint8 idx = r * 16 + c;
                if (!getBit(grid, idx) || getBit(visited, idx)) continue;

                uint8[256] memory queue;
                uint8 head = 0; uint8 tail = 0;
                queue[tail++] = idx;
                visited = setBit(visited, idx);

                uint8 minR = 15; uint8 maxR = 0; uint8 minC = 15; uint8 maxC = 0;
                uint16 compArea = 0;

                while (head < tail) {
                    uint8 cell = queue[head++];
                    compArea++;
                    uint8 cr = cell >> 4; uint8 cc = cell & 15;
                    if (cr < minR) minR = cr;
                    if (cr > maxR) maxR = cr;
                    if (cc < minC) minC = cc;
                    if (cc > maxC) maxC = cc;

                    if (cr > 0) { uint8 n = cell - 16; if (getBit(grid, n) && !getBit(visited, n)) { visited = setBit(visited, n); queue[tail++] = n; } }
                    if (cr < 15) { uint8 n = cell + 16; if (getBit(grid, n) && !getBit(visited, n)) { visited = setBit(visited, n); queue[tail++] = n; } }
                    if (cc > 0) { uint8 n = cell - 1; if (getBit(grid, n) && !getBit(visited, n)) { visited = setBit(visited, n); queue[tail++] = n; } }
                    if (cc < 15) { uint8 n = cell + 1; if (getBit(grid, n) && !getBit(visited, n)) { visited = setBit(visited, n); queue[tail++] = n; } }
                }

                temp[count] = GeomRect(minC, minR, maxC - minC + 1, maxR - minR + 1, compArea, 0);
                count++;
            }
        }

        rects = new GeomRect[](count);
        for (uint256 i = 0; i < count; i++) rects[i] = temp[i];

        // Stable sort descending by area — must match the JS generator's
        // `rects.sort((a, b) => b.area - a.area)` (stable per spec) so ties keep
        // discovery order. (The previous swap-based selection sort was unstable,
        // and `count - 1` underflowed when the grid had no components.)
        for (uint256 i = 1; i < count; i++) {
            GeomRect memory key = rects[i];
            uint256 j = i;
            while (j > 0 && rects[j - 1].area < key.area) {
                rects[j] = rects[j - 1];
                j--;
            }
            rects[j] = key;
        }
    }

    function buildGridPattern(uint256 grid) internal pure returns (GeomRect[] memory rects) {
        GeomRect[] memory temp = new GeomRect[](256);
        uint256 count = 0;
        for (uint8 r = 0; r < 16; r++) {
            for (uint8 c = 0; c < 16; c++) {
                if (getBit(grid, r * 16 + c)) {
                    temp[count] = GeomRect(c, r, 1, 1, 1, 1);
                    count++;
                }
            }
        }
        rects = new GeomRect[](count);
        for (uint256 i = 0; i < count; i++) rects[i] = temp[i];
    }

    function buildStripesPattern(uint256 grid) internal pure returns (GeomRect[] memory rects) {
        GeomRect[] memory temp = new GeomRect[](256);
        uint256 count = 0;
        for (uint8 r = 0; r < 16; r++) {
            uint8 activeCols = 0;
            for (uint8 c = 0; c < 16; c++) if (getBit(grid, r * 16 + c)) activeCols++;
            if (activeCols >= 8) {
                temp[count] = GeomRect(0, r, 16, 1, activeCols, 4);
                count++;
            } else if (activeCols >= 3) {
                int8 start = -1; int8 end = -1;
                for (uint8 c = 0; c < 16; c++) {
                    if (getBit(grid, r * 16 + c)) {
                        if (start == -1) start = int8(c);
                        end = int8(c);
                    }
                }
                if (start != -1) {
                    temp[count] = GeomRect(uint8(start), r, uint8(end - start + 1), 1, activeCols, 4);
                    count++;
                }
            }
        }
        rects = new GeomRect[](count);
        for (uint256 i = 0; i < count; i++) rects[i] = temp[i];
    }

    function buildFragmentsPattern(uint256 grid) internal pure returns (GeomRect[] memory rects) {
        GeomRect[] memory components = findConnectedComponents(grid);
        GeomRect[] memory temp = new GeomRect[](256);
        uint256 count = 0;
        for (uint256 i = 0; i < components.length; i++) {
            GeomRect memory comp = components[i];
            if (comp.area <= 3) {
                temp[count] = comp; count++;
            } else {
                uint8 limit = uint8(comp.area < 4 ? comp.area : 4);
                for (uint8 j = 0; j < limit; j++) {
                    temp[count] = GeomRect((comp.x + j) % 16, comp.y + j / 8, 1, 1, 1, 2);
                    count++;
                }
            }
        }
        rects = new GeomRect[](count);
        for (uint256 i = 0; i < count; i++) rects[i] = temp[i];
    }

    function buildClustersPattern(uint256 grid) internal pure returns (GeomRect[] memory rects) {
        GeomRect[] memory components = findConnectedComponents(grid);
        GeomRect[] memory temp = new GeomRect[](256);
        uint256 count = 0;
        uint16 minA;
        if (components.length > 4) minA = components[(components.length * 2) / 5].area;
        else minA = 1;
        if (minA < 4) minA = 4;
        for (uint256 i = 0; i < components.length; i++) {
            if (components[i].area >= minA) {
                temp[count] = GeomRect(components[i].x, components[i].y, components[i].w, components[i].h, components[i].area, 3);
                count++;
            }
        }
        rects = new GeomRect[](count);
        for (uint256 i = 0; i < count; i++) rects[i] = temp[i];
    }

    function buildGeometry(uint256 grid, uint8 pattern) internal pure returns (GeomRect[] memory rects) {
        if (pattern == 0) return buildGridPattern(grid);
        if (pattern == 1) return findConnectedComponents(grid);
        if (pattern == 2) return buildStripesPattern(grid);
        if (pattern == 3) return buildFragmentsPattern(grid);
        return buildClustersPattern(grid);
    }

    // ====== Plate assignment ======
    function assignToPlates(GeomRect[] memory sorted, uint8 layerCount)
        internal pure returns (
            uint256 kCount, GeomRect[] memory kRects,
            uint256 cCount, GeomRect[] memory cRects,
            uint256 mCount, GeomRect[] memory mRects,
            uint256 yCount, GeomRect[] memory yRects,
            uint8 activeCount
        )
    {
        uint256 n = sorted.length;
        activeCount = layerCount == 0 ? 1 : layerCount;
        if (activeCount > 4) activeCount = 4;

        if (n == 0) {
            return (0, new GeomRect[](0), 0, new GeomRect[](0), 0, new GeomRect[](0), 0, new GeomRect[](0), activeCount);
        }

        // One plate: every rect stays on K. Do not park leftovers on a hidden C plate.
        if (activeCount == 1) {
            kRects = new GeomRect[](n);
            for (uint256 i = 0; i < n; i++) kRects[i] = sorted[i];
            return (n, kRects, 0, new GeomRect[](0), 0, new GeomRect[](0), 0, new GeomRect[](0), activeCount);
        }

        uint256 kTake = (n + 1) / 2;
        uint256 remaining = n - kTake;
        uint256 secondaryCount = uint256(activeCount - 1);

        kRects = new GeomRect[](kTake);
        for (uint256 i = 0; i < kTake; i++) kRects[i] = sorted[i];
        kCount = kTake;

        uint256 base = remaining / secondaryCount;
        uint256 extra = remaining % secondaryCount;
        uint256 cntC = base + (extra >= 1 ? 1 : 0);
        uint256 cntM = activeCount > 2 ? base + (extra >= 2 ? 1 : 0) : 0;
        uint256 cntY = activeCount > 3 ? base + (extra >= 3 ? 1 : 0) : 0;
        if (activeCount == 2) {
            cntM = 0;
            cntY = 0;
        } else if (activeCount == 3) {
            cntY = 0;
        }

        cRects = new GeomRect[](cntC);
        mRects = new GeomRect[](cntM);
        yRects = new GeomRect[](cntY);

        uint256 ci = 0;
        uint256 mi = 0;
        uint256 yi = 0;
        for (uint256 i = 0; i < remaining; i++) {
            uint256 target = 1 + (i % secondaryCount);
            if (target == 1) {
                cRects[ci] = sorted[kTake + i];
                ci++;
            } else if (target == 2) {
                mRects[mi] = sorted[kTake + i];
                mi++;
            } else {
                yRects[yi] = sorted[kTake + i];
                yi++;
            }
        }

        cCount = ci;
        mCount = mi;
        yCount = yi;
    }

    // ====== Transforms (micro-units, JS SeededRandom.float) ======
    function computeTransforms(
        PRNG memory p, uint8 printMode, uint8 distortion
    ) internal pure returns (
        int256 dxC, int256 dyC, int256 angleC,
        int256 dxM, int256 dyM, int256 angleM,
        int256 dxY, int256 dyY, int256 angleY,
        PRNG memory next
    ) {
        // MAGNITUDES: None 0, Low 2px / 0.15°, Medium 4 / 0.35, High 8 / 0.65
        // MODE_SCALE: Registered 0.25, Offset 1, Drift 1.5, Misaligned 2.5
        uint256 offset = distortion == 0 ? 0 : (distortion == 1 ? 2 : (distortion == 2 ? 4 : 8));
        uint256 angleMilli = distortion == 0 ? 0 : (distortion == 1 ? 150_000 : (distortion == 2 ? 350_000 : 650_000));
        uint256 scale100 = printMode == 0 ? 25 : (printMode == 1 ? 100 : (printMode == 2 ? 150 : 250));

        int256 oMicro = int256(offset * scale100 * 10_000); // offset * scale * 1e6
        int256 aMicro = int256(angleMilli * scale100 / 100); // degrees * 1e6

        int256 driftX = 0;
        int256 driftY = 0;
        if (printMode == 2) {
            (driftX, p) = prngRange(p, -MICRO, MICRO);
            (driftY, p) = prngRange(p, -MICRO, MICRO);
        }

        (dxC, p) = prngRange(p, -oMicro, oMicro);
        dxC += driftX * oMicro / (2 * MICRO);
        (dyC, p) = prngRange(p, -oMicro, oMicro);
        dyC += driftY * oMicro / (2 * MICRO);
        (angleC, p) = prngRange(p, -aMicro, aMicro);

        (dxM, p) = prngRange(p, -oMicro, oMicro);
        dxM += driftX * oMicro / (2 * MICRO);
        (dyM, p) = prngRange(p, -oMicro, oMicro);
        dyM += driftY * oMicro / (2 * MICRO);
        (angleM, p) = prngRange(p, -aMicro, aMicro);

        (dxY, p) = prngRange(p, -oMicro, oMicro);
        dxY += driftX * oMicro / (2 * MICRO);
        (dyY, p) = prngRange(p, -oMicro, oMicro);
        dyY += driftY * oMicro / (2 * MICRO);
        (angleY, p) = prngRange(p, -aMicro, aMicro);

        next = p;
    }

    // ====== Fixed-point helpers ======
    function fmtU(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 temp = v; uint256 digits = 0;
        while (temp > 0) { digits++; temp /= 10; }
        bytes memory buf = new bytes(digits);
        temp = v;
        for (uint256 i = 0; i < digits; i++) {
            buf[digits - 1 - i] = bytes1(uint8(48 + (temp % 10)));
            temp /= 10;
        }
        return string(buf);
    }

    function fmtI(int256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        if (v < 0) return string.concat("-", fmtU(uint256(-v)));
        return fmtU(uint256(v));
    }

    // Format an int256 already in scale 100 (100 = 1.00) with 2 decimal places.
    // (Previously this divided by 100 a second time, so hexagon coordinates
    // rendered at 1/100 size - tiny specks near the origin.)
    function fmtF2(int256 v) internal pure returns (string memory) {
        bool neg = v < 0;
        uint256 abs = neg ? uint256(-v) : uint256(v);
        uint256 intPart = abs / 100;
        uint256 frac = abs % 100;
        string memory sign = neg ? "-" : "";
        string memory fracStr;
        if (frac < 10) fracStr = string.concat("0", fmtU(frac));
        else fracStr = fmtU(frac);
        return string.concat(sign, fmtU(intPart), ".", fracStr);
    }

    // Format micro-units (1e6 = 1.0) like JS Number.toFixed(2)
    function fmtMicro2(int256 v) internal pure returns (string memory) {
        bool neg = v < 0;
        uint256 abs = neg ? uint256(-v) : uint256(v);
        uint256 hundredths = (abs + 5_000) / 10_000;
        uint256 intPart = hundredths / 100;
        uint256 frac = hundredths % 100;
        string memory sign = neg && hundredths != 0 ? "-" : "";
        string memory fracStr = frac < 10 ? string.concat("0", fmtU(frac)) : fmtU(frac);
        return string.concat(sign, fmtU(intPart), ".", fracStr);
    }

    // Format micro-units like JS Number.toFixed(3)
    function fmtMicro3(int256 v) internal pure returns (string memory) {
        bool neg = v < 0;
        uint256 abs = neg ? uint256(-v) : uint256(v);
        uint256 thousandths = (abs + 500) / 1_000;
        uint256 intPart = thousandths / 1_000;
        uint256 frac = thousandths % 1_000;
        string memory sign = neg && thousandths != 0 ? "-" : "";
        string memory fracStr;
        if (frac < 10) fracStr = string.concat("00", fmtU(frac));
        else if (frac < 100) fracStr = string.concat("0", fmtU(frac));
        else fracStr = fmtU(frac);
        return string.concat(sign, fmtU(intPart), ".", fracStr);
    }

    // ====== SVG element builders ======
    function svgHeader() internal pure returns (string memory) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="640" height="640" shape-rendering="crispEdges">';
    }

    function svgBackground(string memory bg) internal pure returns (string memory) {
        return string.concat('<rect width="640" height="640" fill="', bg, '"/>');
    }

    function svgGridOverlay(string memory kColor, bool dark) internal pure returns (string memory) {
        string memory opacity = dark ? "0.04" : "0.05";
        string memory lines;
        for (uint8 i = 0; i <= 16; i++) {
            uint256 pos = MARGIN + uint256(i) * CELL;
            lines = string.concat(lines,
                '<line x1="', fmtU(pos), '" y1="32" x2="', fmtU(pos), '" y2="608" stroke="', kColor, '" stroke-width="0.5"/>',
                '<line x1="32" y1="', fmtU(pos), '" x2="608" y2="', fmtU(pos), '" stroke="', kColor, '" stroke-width="0.5"/>');
        }
        return string.concat('<g opacity="', opacity, '">', lines, '</g>');
    }

    function svgRectShape(uint256 x, uint256 y, uint256 w, uint256 h, uint256 inset, string memory color) internal pure returns (string memory) {
        uint256 ix = x + inset; uint256 iy = y + inset;
        uint256 iw = w > inset * 2 ? w - inset * 2 : 0;
        uint256 ih = h > inset * 2 ? h - inset * 2 : 0;
        return string.concat(
            '<rect x="', fmtU(ix), '" y="', fmtU(iy), '" width="', fmtU(iw), '" height="', fmtU(ih), '" fill="', color, '"/>');
    }

    function svgCircleShape(uint256 x, uint256 y, uint256 w, uint256 h, uint256 inset, string memory color) internal pure returns (string memory) {
        uint256 cx = x + w / 2;
        uint256 cy = y + h / 2;
        uint256 iw = w > inset * 2 ? w - inset * 2 : 0;
        uint256 ih = h > inset * 2 ? h - inset * 2 : 0;
        uint256 radius = iw < ih ? iw / 2 : ih / 2;
        if (radius < 3) radius = 3;
        return string.concat(
            '<circle cx="', fmtU(cx), '" cy="', fmtU(cy), '" r="', fmtU(radius), '" fill="', color, '"/>');
    }

    function svgDiamondShape(uint256 x, uint256 y, uint256 w, uint256 h, uint256 inset, string memory color) internal pure returns (string memory) {
        uint256 cx = x + w / 2;
        uint256 cy = y + h / 2;
        return string.concat(
            '<polygon points="',
            fmtU(cx), ',', fmtU(y + inset), ' ',
            fmtU(x + w - inset), ',', fmtU(cy), ' ',
            fmtU(cx), ',', fmtU(y + h - inset), ' ',
            fmtU(x + inset), ',', fmtU(cy),
            '" fill="', color, '"/>');
    }

    function svgHexShape(uint256 x, uint256 y, uint256 w, uint256 h, string memory color) internal pure returns (string memory) {
        uint256 cx = x + w / 2;
        uint256 cy = y + h / 2;
        uint256 radius = w < h ? w / 2 : h / 2;
        if (radius < 3) radius = 3;

        // cos(30°) ≈ 0.8660254, sin(30°) = 0.5
        // Compute in scale 10000 then convert to scale 100 with rounding
        uint256 rScaled = radius * 10000;
        uint256 h866 = (rScaled * 8660254 + 5000000) / 10000000; // r * cos(30°) in scale 10000
        uint256 h500 = (rScaled * 5000000 + 5000000) / 10000000;  // r * sin(30°) in scale 10000

        uint256 h866_100 = (h866 + 50) / 100;
        uint256 h500_100 = (h500 + 50) / 100;

        return string.concat(
            '<polygon points="',
            fmtF2(int256(cx * 100) + int256(h866_100)), ',', fmtF2(int256(cy * 100) - int256(h500_100)), ' ',
            fmtF2(int256(cx * 100) + int256(h866_100)), ',', fmtF2(int256(cy * 100) + int256(h500_100)), ' ',
            fmtF2(int256(cx * 100)), ',', fmtF2(int256(cy * 100) + int256(radius * 100)), ' ',
            fmtF2(int256(cx * 100) - int256(h866_100)), ',', fmtF2(int256(cy * 100) + int256(h500_100)), ' ',
            fmtF2(int256(cx * 100) - int256(h866_100)), ',', fmtF2(int256(cy * 100) - int256(h500_100)), ' ',
            fmtF2(int256(cx * 100)), ',', fmtF2(int256(cy * 100) - int256(radius * 100)),
            '" fill="', color, '"/>');
    }

    function svgLineShape(uint256 x, uint256 y, uint256 w, uint256 h, string memory color) internal pure returns (string memory) {
        uint256 x1 = x; uint256 y1 = y + h / 2;
        uint256 x2 = x + w; uint256 y2 = y + h / 2;
        // stroke-width in scale 100 (h * 0.72, min 4) to match the JS generator
        // `Math.max(4, height * 0.72).toFixed(2)` exactly.
        uint256 sw = h * 72;
        if (sw < 400) sw = 400;
        return string.concat(
            '<line x1="', fmtU(x1), '" y1="', fmtU(y1), '" ',
            'x2="', fmtU(x2), '" y2="', fmtU(y2), '" ',
            'stroke="', color, '" stroke-width="', fmtF2(int256(sw)), '"/>');
    }

    function svgPlateEntry(
        int256 dx, int256 dy, int256 angle, string memory opacity,
        GeomRect[] memory rects, string memory color, uint256 inset
    ) internal pure returns (string memory) {
        string memory transform = string.concat(
            "translate(", fmtMicro2(dx), ",", fmtMicro2(dy), ") rotate(", fmtMicro3(angle), ",320,320)");
        string memory shapes;
        uint256 count = rects.length;

        for (uint256 i = 0; i < count; i++) {
            GeomRect memory r = rects[i];
            uint256 svgX = MARGIN + uint256(r.x) * CELL;
            uint256 svgY = MARGIN + uint256(r.y) * CELL;
            uint256 svgW = uint256(r.w) * CELL;
            uint256 svgH = uint256(r.h) * CELL;

            if (r.shape == 0) {
                shapes = string.concat(shapes, svgRectShape(svgX, svgY, svgW, svgH, inset, color));
            } else if (r.shape == 1) {
                shapes = string.concat(shapes, svgCircleShape(svgX, svgY, svgW, svgH, inset, color));
            } else if (r.shape == 2) {
                shapes = string.concat(shapes, svgDiamondShape(svgX, svgY, svgW, svgH, inset, color));
            } else if (r.shape == 3) {
                shapes = string.concat(shapes, svgHexShape(svgX, svgY, svgW, svgH, color));
            } else if (r.shape == 4) {
                shapes = string.concat(shapes, svgLineShape(svgX, svgY, svgW, svgH, color));
            }
        }

        return string.concat(
            '<g transform="', transform, '" opacity="', opacity, '">',
            shapes,
            '</g>');
    }

    function svgBorder(string memory kColor) internal pure returns (string memory) {
        return string.concat(
            '<rect x="32" y="32" width="576" height="576" fill="none" ',
            'stroke="', kColor, '" stroke-width="0.75" opacity="0.3"/>');
    }

    function svgCornerMarkers(uint8 count, string memory kColor) internal pure returns (string memory markers) {
        uint256[5] memory cx = [uint256(16), uint256(624), uint256(16), uint256(624), uint256(320)];
        uint256[5] memory cy = [uint256(16), uint256(16), uint256(624), uint256(624), uint256(320)];

        for (uint8 i = 0; i < count; i++) {
            markers = string.concat(markers,
                '<line x1="', fmtU(cx[i] - 10), '" y1="', fmtU(cy[i]), '" x2="', fmtU(cx[i] + 10), '" y2="', fmtU(cy[i]), '" stroke="', kColor, '" stroke-width="0.75"/>',
                '<line x1="', fmtU(cx[i]), '" y1="', fmtU(cy[i] - 10), '" x2="', fmtU(cx[i]), '" y2="', fmtU(cy[i] + 10), '" stroke="', kColor, '" stroke-width="0.75"/>',
                '<circle cx="', fmtU(cx[i]), '" cy="', fmtU(cy[i]), '" r="3.5" fill="none" stroke="', kColor, '" stroke-width="0.75"/>');
        }
    }

    // ====== Main generator ======
    function generateSVG(bytes32 seed)
        internal pure returns (
            string memory svg,
            string memory paletteName,
            uint8 corners,
            uint8 pattern,
            uint8 printMode,
            uint8 distortion,
            uint8 rotations,
            uint8 layerCount,
            uint8 density
        )
    {
        PRNG memory p = prngInit(seed);

        (corners, p) = computeCorners(p);

        uint8 palIdx;
        (palIdx, pattern, printMode, distortion, rotations, layerCount, density, p) = _extractTraits(p);

        uint256 grid = applyRotation(buildGrid(seed), rotations);

        string memory bg;
        string memory k;
        string memory c;
        string memory m;
        string memory y;
        bool dark;
        (bg, k, c, m, y, dark, paletteName) = getPalette(palIdx);

        GeomRect[] memory allRects = buildGeometry(grid, pattern);
        uint256 n = allRects.length;
        GeomRect[] memory sorted = new GeomRect[](n);
        for (uint256 i = 0; i < n; i++) sorted[i] = allRects[i];
        if (n > 1) {
            // Stable descending-by-area insertion sort. Must match the JS
            // generator's `[...rects].sort((a, b) => b.area - a.area)`
            // (Array.prototype.sort is stable per spec) exactly, including
            // tie-break order: with equal areas — extremely common, e.g. a
            // grid of same-size cells — a non-stable sort (the previous
            // selection-sort-via-chained-swaps here) can reorder ties
            // differently than JS. Since `assignToPlates` below buckets
            // rects by their position in this sorted list, any tie-break
            // divergence changes which CMYK plate a shape lands on, making
            // the on-chain SVG differ from the JS preview shown at mint time.
            // Insertion sort with a strict `<` shift-condition never moves
            // equal-area elements past each other, so it is stable.
            for (uint256 i = 1; i < n; i++) {
                GeomRect memory key = sorted[i];
                uint256 j = i;
                while (j > 0 && sorted[j - 1].area < key.area) {
                    sorted[j] = sorted[j - 1];
                    j--;
                }
                sorted[j] = key;
            }
        }

        uint256 kCount;
        GeomRect[] memory kRects;
        uint256 cCount;
        GeomRect[] memory cRects;
        uint256 mCount;
        GeomRect[] memory mRects;
        uint256 yCount;
        GeomRect[] memory yRects;
        uint8 activeCount;
        (kCount, kRects, cCount, cRects, mCount, mRects, yCount, yRects, activeCount) = assignToPlates(sorted, layerCount);
        kCount = kCount;
        cCount = cCount;
        mCount = mCount;
        yCount = yCount;

        int256 dxC;
        int256 dyC;
        int256 angleC;
        int256 dxM;
        int256 dyM;
        int256 angleM;
        int256 dxY;
        int256 dyY;
        int256 angleY;
        (dxC, dyC, angleC, dxM, dyM, angleM, dxY, dyY, angleY, p) = computeTransforms(p, printMode, distortion);

        uint256 inset = (pattern == 0 || pattern == 3) ? 3 : 0;
        string memory blend = dark ? "screen" : "multiply";

        string memory parts;
        parts = string.concat(parts, svgHeader());
        parts = string.concat(parts, svgBackground(bg));
        parts = string.concat(parts, svgGridOverlay(k, dark));
        parts = string.concat(parts, '<g style="mix-blend-mode:', blend, '">');

        // K is the register plate: never offset.
        parts = string.concat(parts, svgPlateEntry(0, 0, 0, "1", kRects, k, inset));

        if (activeCount > 1) {
            parts = string.concat(parts, svgPlateEntry(dxC, dyC, angleC, "0.88", cRects, c, inset));
        }
        if (activeCount > 2) {
            parts = string.concat(parts, svgPlateEntry(dxM, dyM, angleM, "0.86", mRects, m, inset));
        }
        if (activeCount > 3) {
            parts = string.concat(parts, svgPlateEntry(dxY, dyY, angleY, "0.82", yRects, y, inset));
        }

        parts = string.concat(parts, '</g>');
        parts = string.concat(parts, svgBorder(k));
        parts = string.concat(parts, svgCornerMarkers(corners, k));
        parts = string.concat(parts, '</svg>');

        svg = parts;
    }

    function _extractTraits(PRNG memory p)
        internal pure returns (
            uint8 paletteIndex, uint8 pattern, uint8 printMode,
            uint8 distortion, uint8 rotations, uint8 layerCount, uint8 density,
            PRNG memory nextState
        )
    {
        (paletteIndex, p) = prngInt(p, 16);
        (pattern, p) = prngInt(p, 5);
        (printMode, p) = prngInt(p, 4);
        (distortion, p) = prngInt(p, 4);
        (rotations, p) = prngInt(p, 4);
        uint8 lc;
        (lc, p) = prngInt(p, 4);
        layerCount = lc + 1;
        (density, p) = prngInt(p, 4);
        nextState = p;
    }
}
