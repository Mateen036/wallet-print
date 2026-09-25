// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract WalletPrint is ERC721, Ownable, Pausable {
    uint256 public constant MAX_SUPPLY = 6767;

    uint256 private _tokenIdCounter;
    mapping(address => bool) public hasMinted;
    mapping(uint256 => bytes32) public tokenSeed;
    string private _baseURI;

    event Minted(address indexed to, uint256 indexed tokenId, bytes32 seed);

    constructor() ERC721("Wallet Print", "WPRINT") Ownable(msg.sender) {}

    function mint() external whenNotPaused {
        require(!hasMinted[msg.sender], "already minted");
        require(_tokenIdCounter < MAX_SUPPLY, "sold out");

        uint256 tokenId = ++_tokenIdCounter;
        hasMinted[msg.sender] = true;

        uint256 entropy = block.prevrandao != 0 ? uint256(block.prevrandao) : block.difficulty;
        bytes32 seed = keccak256(
            abi.encodePacked(msg.sender, tokenId, entropy, blockhash(block.number - 1))
        );

        tokenSeed[tokenId] = seed;

        _safeMint(msg.sender, tokenId);
        emit Minted(msg.sender, tokenId, seed);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _baseURI;
    }

    function setBaseURI(string memory baseURI_) external onlyOwner {
        _baseURI = baseURI_;
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
}
