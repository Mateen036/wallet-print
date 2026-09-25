// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract WalletPrint is ERC721, Ownable, Pausable {
    uint256 public constant MAX_SUPPLY = 6767;
    uint256 public constant REVEAL_DELAY = 1;

    uint256 private _tokenIdCounter;
    mapping(address => bool) public hasMinted;
    mapping(address => uint256) public mintedTokenId;
    mapping(address => bytes32) public mintCommitment;
    mapping(address => uint256) public commitmentBlock;
    mapping(uint256 => bytes32) public tokenSeed;
    string private _walletPrintBaseURI;

    event MintCommitted(address indexed to, bytes32 commitment, uint256 commitmentBlock);
    event Minted(address indexed to, uint256 indexed tokenId, bytes32 seed);

    constructor() ERC721("Wallet Print", "WPRINT") Ownable(msg.sender) {}

    function commitMint(bytes32 commitment) external whenNotPaused {
        require(!hasMinted[msg.sender], "already minted");
        require(commitment != bytes32(0), "empty commitment");

        mintCommitment[msg.sender] = commitment;
        commitmentBlock[msg.sender] = block.number;
        emit MintCommitted(msg.sender, commitment, block.number);
    }

    function revealMint(bytes32 secret) external whenNotPaused {
        require(!hasMinted[msg.sender], "already minted");
        require(_tokenIdCounter < MAX_SUPPLY, "sold out");

        bytes32 commitment = mintCommitment[msg.sender];
        require(commitment != bytes32(0), "no commitment");
        require(block.number > commitmentBlock[msg.sender], "wait one block");
        require(keccak256(abi.encode(secret, msg.sender)) == commitment, "invalid secret");

        uint256 committedAt = commitmentBlock[msg.sender];
        delete mintCommitment[msg.sender];
        delete commitmentBlock[msg.sender];

        uint256 tokenId = ++_tokenIdCounter;
        hasMinted[msg.sender] = true;
        mintedTokenId[msg.sender] = tokenId;

        bytes32 seed = keccak256(abi.encode(secret, msg.sender, tokenId, block.prevrandao, blockhash(committedAt)));

        tokenSeed[tokenId] = seed;

        _safeMint(msg.sender, tokenId);
        emit Minted(msg.sender, tokenId, seed);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        if (bytes(_walletPrintBaseURI).length > 0) {
            return string.concat(_walletPrintBaseURI, Strings.toString(tokenId));
        }

        string memory json = string.concat(
            '{"name":"Wallet Print #',
            Strings.toString(tokenId),
            '","description":"A generative print created from the deterministic identity of a blockchain mint.","attributes":[{"trait_type":"Seed","value":"',
            Strings.toHexString(uint256(tokenSeed[tokenId]), 32),
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
}
