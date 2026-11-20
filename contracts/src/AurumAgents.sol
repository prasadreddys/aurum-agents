// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title AurumAgents — AURUM AGENTS premium NFT minting (BNB Smart Chain Mainnet, chain 56)
/// @notice ERC-721 collection of 5,555 NFTs: 1,111 free (1 per wallet) + 4,444 paid
///         at 0.001 BNB each (max 10 paid per wallet, 11 combined).
/// @dev All mint limits are enforced inside this contract. There is NO owner mint
///      function and no hidden minting privilege: the owner can only pause/unpause,
///      set (and permanently freeze) the base URI, withdraw accumulated BNB, and
///      transfer ownership. Supply accounting is kept in two separate counters
///      (freeMinted / paidMinted) so the free and paid allocations can never mix.
///      Token IDs are sequential starting at 1. Metadata lives off-chain at
///      baseURI + "<tokenId>.json" (R2 / Pages-static per Stage 2 layout).
contract AurumAgents is ERC721, ERC721Enumerable, Ownable, ReentrancyGuard, Pausable {
    using Strings for uint256;

    // ------------------------------------------------------------------------
    // Constants — the collection's allocation rules, fixed at deployment.
    // ------------------------------------------------------------------------

    /// @notice Total collection supply.
    uint256 public constant MAX_SUPPLY = 5555;
    /// @notice Free-mint allocation (1 per wallet, price 0).
    uint256 public constant FREE_SUPPLY = 1111;
    /// @notice Paid-mint allocation.
    uint256 public constant PAID_SUPPLY = 4444;
    /// @notice Price of one paid mint, in wei (0.001 BNB).
    uint256 public constant PAID_PRICE = 0.001 ether;
    /// @notice Maximum paid mints per wallet.
    uint256 public constant MAX_PAID_PER_WALLET = 10;

    // ------------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------------

    /// @notice Number of free NFTs minted so far.
    uint256 public freeMinted;
    /// @notice Number of paid NFTs minted so far.
    uint256 public paidMinted;
    /// @notice Next token ID to mint (starts at 1).
    uint256 public nextTokenId = 1;

    /// @notice True once a wallet has claimed its one free NFT.
    mapping(address => bool) public hasClaimedFree;
    /// @notice Paid NFTs minted per wallet (cap: MAX_PAID_PER_WALLET).
    mapping(address => uint256) public paidMintedBy;

    /// @notice Base URI for token metadata, e.g. "https://.../metadata/".
    string private _baseTokenURI;
    /// @notice Once true, the base URI can never change again.
    bool public baseURIFrozen;

    // ------------------------------------------------------------------------
    // Events — emitted for every mint and every owner action.
    // ------------------------------------------------------------------------

    event FreeMinted(address indexed minter, uint256 indexed tokenId);
    event PaidMinted(address indexed minter, uint256 indexed tokenId, uint256 pricePaid);
    event Withdrawn(address indexed to, uint256 amount);
    event BaseURISet(string baseURI);
    event BaseURIFrozen(string baseURI);

    // ------------------------------------------------------------------------
    // Errors — cheaper and clearer than revert strings.
    // ------------------------------------------------------------------------

    error FreeMintAlreadyClaimed();
    error FreeSupplySoldOut();
    error MaxSupplyReached();
    error InvalidQuantity();
    error PaidMintLimitExceeded();
    error PaidSupplyExceeded();
    error IncorrectPayment();
    error BaseURIFrozenAlready();
    error WithdrawFailed();

    /// @param initialOwner The contract owner (deployer at Stage 9; multisig recommended).
    /// @param initialBaseURI Metadata base URI, e.g. "https://<bucket>/metadata/".
    constructor(address initialOwner, string memory initialBaseURI)
        ERC721("AURUM AGENTS", "AURUM")
        Ownable(initialOwner)
    {
        _baseTokenURI = initialBaseURI;
    }

    // ------------------------------------------------------------------------
    // Views — live supply / eligibility reads for the dashboard and gallery.
    // ------------------------------------------------------------------------

    /// @notice Total NFTs minted (free + paid).
    function totalMinted() public view returns (uint256) {
        return freeMinted + paidMinted;
    }

    /// @notice Free NFTs still available.
    function remainingFree() public view returns (uint256) {
        return FREE_SUPPLY - freeMinted;
    }

    /// @notice Paid NFTs still available.
    function remainingPaid() public view returns (uint256) {
        return PAID_SUPPLY - paidMinted;
    }

    /// @notice Total NFTs still available across both allocations.
    function remainingSupply() public view returns (uint256) {
        return MAX_SUPPLY - totalMinted();
    }

    /// @notice Paid mints a wallet may still buy (0..10).
    function paidMintRemaining(address wallet) public view returns (uint256) {
        return MAX_PAID_PER_WALLET - paidMintedBy[wallet];
    }

    /// @notice Whether a wallet is still eligible for its one free mint.
    function isFreeMintEligible(address wallet) public view returns (bool) {
        return !hasClaimedFree[wallet] && freeMinted < FREE_SUPPLY && !paused();
    }

    /// @notice Metadata base URI.
    function baseURI() public view returns (string memory) {
        return _baseTokenURI;
    }

    // ------------------------------------------------------------------------
    // Minting
    // ------------------------------------------------------------------------

    /// @notice Mint one free NFT. One per wallet, while the free allocation lasts.
    function freeMint() external nonReentrant whenNotPaused {
        if (hasClaimedFree[msg.sender]) revert FreeMintAlreadyClaimed();
        if (freeMinted >= FREE_SUPPLY) revert FreeSupplySoldOut();
        if (totalMinted() >= MAX_SUPPLY) revert MaxSupplyReached();

        hasClaimedFree[msg.sender] = true;
        freeMinted += 1;

        uint256 tokenId = nextTokenId;
        nextTokenId += 1;
        // Event first: a revert in _safeMint rolls the log back with the tx.
        emit FreeMinted(msg.sender, tokenId);
        _safeMint(msg.sender, tokenId);
    }

    /// @notice Mint `qty` paid NFTs at PAID_PRICE each. qty must be 1..10 and the
    ///         wallet's lifetime paid total may not exceed MAX_PAID_PER_WALLET.
    ///         Payment must be exactly qty * PAID_PRICE — over- and underpayment
    ///         both revert.
    function paidMint(uint256 qty) external payable nonReentrant whenNotPaused {
        if (qty < 1 || qty > 10) revert InvalidQuantity();
        if (paidMintedBy[msg.sender] + qty > MAX_PAID_PER_WALLET) revert PaidMintLimitExceeded();
        if (paidMinted + qty > PAID_SUPPLY) revert PaidSupplyExceeded();
        if (totalMinted() + qty > MAX_SUPPLY) revert MaxSupplyReached();
        if (msg.value != qty * PAID_PRICE) revert IncorrectPayment();

        paidMintedBy[msg.sender] += qty;
        paidMinted += qty;

        // All state is written before any external call: reserve the token-ID
        // range up front, then mint from it.
        uint256 firstTokenId = nextTokenId;
        nextTokenId += qty;
        for (uint256 i = 0; i < qty; i++) {
            uint256 tokenId = firstTokenId + i;
            // Event first: a revert in _safeMint rolls the log back with the tx.
            // False positive (see docs/contracts.md §5): the emit follows the
            // previous iteration's _safeMint, but the receiver cannot fabricate
            // logs from this contract, state is updated before any external
            // call, and nonReentrant blocks reentry.
            // forge-lint: disable-next-line(reentrancy-events)
            emit PaidMinted(msg.sender, tokenId, PAID_PRICE);
            _safeMint(msg.sender, tokenId);
        }
    }

    // ------------------------------------------------------------------------
    // Owner-only administration
    // ------------------------------------------------------------------------

    /// @notice Pause all minting (existing tokens still transfer).
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume minting.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Point tokenURI at a new metadata location. Reverts once frozen.
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        if (baseURIFrozen) revert BaseURIFrozenAlready();
        _baseTokenURI = newBaseURI;
        emit BaseURISet(newBaseURI);
    }

    /// @notice Permanently lock the base URI. One-way: cannot be undone.
    function freezeBaseURI() external onlyOwner {
        if (baseURIFrozen) revert BaseURIFrozenAlready();
        baseURIFrozen = true;
        emit BaseURIFrozen(_baseTokenURI);
    }

    /// @notice Send the contract's entire BNB balance to the owner.
    function withdraw() external nonReentrant onlyOwner {
        uint256 amount = address(this).balance;
        // Event first: a failed call reverts the whole tx, log included.
        emit Withdrawn(owner(), amount);
        (bool ok, ) = payable(owner()).call{value: amount}("");
        if (!ok) revert WithdrawFailed();
    }

    // ------------------------------------------------------------------------
    // Metadata
    // ------------------------------------------------------------------------

    /// @notice tokenURI = baseURI + "<tokenId>.json" (Stage 2 metadata layout).
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(_baseTokenURI, tokenId.toString(), ".json");
    }

    // ------------------------------------------------------------------------
    // OpenZeppelin overrides
    // ------------------------------------------------------------------------

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
