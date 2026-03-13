// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;


import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

/**
 * @title CardNFT
 * @notice ERC-1155 multi-token for DeckWars cards.
 *         Token IDs 1–20 represent 20 card types.
 *         Each card has stats and a rarity level.
 *         Supply caps enforced per token.
 *         Authorized minters: CraftingSystem + PremiumPacks.
 */
contract CardNFT is ERC1155, Ownable, ERC1155Burnable, ERC1155Supply {
    // ─── Types ───────────────────────────────────────────────────────────────

    /// @notice Rarity tiers for cards
    enum Rarity { Common, Rare, Epic, Legendary }

    /// @notice Element types for the element triangle (Fire > Earth > Water > Fire)
    enum Element { Fire, Water, Earth }

    struct CardStats {
        uint16 attack;
        uint16 defense;
        Element element;
        Rarity rarity;
        bool exists; // guard for uninitialized token IDs
    }

    // ─── State ───────────────────────────────────────────────────────────────

    /// @notice Total number of distinct card types
    uint256 public constant MAX_CARD_TYPES = 20;

    /// @notice stats[tokenId] → CardStats
    mapping(uint256 => CardStats) public cardStats;

    /// @notice supplyCap[tokenId] → max mintable amount (0 = uncapped during setup)
    mapping(uint256 => uint256) public supplyCap;

    /// @notice Addresses permitted to call mint()
    mapping(address => bool) public authorizedMinters;

    // ─── Events ──────────────────────────────────────────────────────────────

    event CardStatsSet(uint256 indexed tokenId, CardStats stats);
    event SupplyCapSet(uint256 indexed tokenId, uint256 cap);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event CardsMinted(address indexed to, uint256 indexed tokenId, uint256 amount);
    event CardsBurned(address indexed from, uint256 indexed tokenId, uint256 amount);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error NotAuthorizedMinter();
    error InvalidTokenId(uint256 tokenId);
    error SupplyCapExceeded(uint256 tokenId, uint256 cap);
    error CardStatsNotSet(uint256 tokenId);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(string memory baseURI) ERC1155(baseURI) Ownable(msg.sender) {}

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Set or update metadata URI
    function setURI(string memory newURI) external onlyOwner {
        _setURI(newURI);
    }

    /// @notice Configure stats for a card type (tokenId 1–20)
    function setCardStats(
        uint256 tokenId,
        uint16 attack,
        uint16 defense,
        Element element,
        Rarity rarity
    ) external onlyOwner {
        if (tokenId == 0 || tokenId > MAX_CARD_TYPES) revert InvalidTokenId(tokenId);
        cardStats[tokenId] = CardStats(attack, defense, element, rarity, true);
        emit CardStatsSet(tokenId, cardStats[tokenId]);
    }

    /// @notice Set supply cap per token (call before minting begins)
    function setSupplyCap(uint256 tokenId, uint256 cap) external onlyOwner {
        if (tokenId == 0 || tokenId > MAX_CARD_TYPES) revert InvalidTokenId(tokenId);
        supplyCap[tokenId] = cap;
        emit SupplyCapSet(tokenId, cap);
    }

    /// @notice Grant minter role (CraftingSystem, PremiumPacks)
    function addMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
        emit MinterAdded(minter);
    }

    /// @notice Revoke minter role
    function removeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRemoved(minter);
    }

    // ─── Minting / Burning ───────────────────────────────────────────────────

    /// @notice Mint cards — only authorized minters
    function mint(address to, uint256 tokenId, uint256 amount) external {
        if (!authorizedMinters[msg.sender]) revert NotAuthorizedMinter();
        if (tokenId == 0 || tokenId > MAX_CARD_TYPES) revert InvalidTokenId(tokenId);
        if (!cardStats[tokenId].exists) revert CardStatsNotSet(tokenId);

        uint256 cap = supplyCap[tokenId];
        if (cap > 0 && totalSupply(tokenId) + amount > cap) {
            revert SupplyCapExceeded(tokenId, cap);
        }

        _mint(to, tokenId, amount, "");
        emit CardsMinted(to, tokenId, amount);
    }

    /// @notice Batch-mint for pack opening efficiency
    function mintBatch(
        address to,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts
    ) external {
        if (!authorizedMinters[msg.sender]) revert NotAuthorizedMinter();
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tid = tokenIds[i];
            if (tid == 0 || tid > MAX_CARD_TYPES) revert InvalidTokenId(tid);
            if (!cardStats[tid].exists) revert CardStatsNotSet(tid);
            uint256 cap = supplyCap[tid];
            if (cap > 0 && totalSupply(tid) + amounts[i] > cap) {
                revert SupplyCapExceeded(tid, cap);
            }
        }
        _mintBatch(to, tokenIds, amounts, "");
    }

    /// @notice Burn cards — called by CraftingSystem (burns player's own cards)
    function burnFrom(address from, uint256 tokenId, uint256 amount) external {
        if (!authorizedMinters[msg.sender]) revert NotAuthorizedMinter();
        _burn(from, tokenId, amount);
        emit CardsBurned(from, tokenId, amount);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    /// @notice Get stats for a card type
    function getCardStats(uint256 tokenId) external view returns (CardStats memory) {
        return cardStats[tokenId];
    }

    /// @notice Get rarity for a token ID (convenience for CraftingSystem)
    function getRarity(uint256 tokenId) external view returns (Rarity) {
        if (!cardStats[tokenId].exists) revert CardStatsNotSet(tokenId);
        return cardStats[tokenId].rarity;
    }

    /// @notice Get element for a token ID (convenience for BattleEngine)
    function getElement(uint256 tokenId) external view returns (Element) {
        if (!cardStats[tokenId].exists) revert CardStatsNotSet(tokenId);
        return cardStats[tokenId].element;
    }

    // ─── Required Overrides ──────────────────────────────────────────────────

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }
}
