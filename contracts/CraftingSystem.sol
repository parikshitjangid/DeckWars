// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CardNFT.sol";

/**
 * @title IQuestSystem
 * @notice Minimal interface so CraftingSystem can notify Dev 2's QuestSystem
 *         without depending on the full implementation.
 */
interface IQuestSystem {
    function notifyCraft(address player) external;
}

/**
 * @title CraftingSystem
 * @notice Burns 3 cards of the same rarity and mints 1 card of the next rarity.
 *         Common × 3 → Rare
 *         Rare   × 3 → Epic
 *         Epic   × 3 → Legendary
 *         Legendary  → reverts (max rarity)
 *
 *         Emits QuestProgressNotification for Dev 2's QuestSystem to hook into.
 */
contract CraftingSystem is Ownable {
    // ─── State ───────────────────────────────────────────────────────────────

    CardNFT public immutable cardNFT;
    IQuestSystem public questSystem;

    /// @notice Mapping: rarity → token IDs that belong to that rarity
    ///         Populated by owner. Used to pick the upgrade result.
    mapping(CardNFT.Rarity => uint256[]) public rarityTokenIds;

    /// @notice Nonce for pseudo-randomness when selecting the output card
    uint256 private _nonce;

    // ─── Events ──────────────────────────────────────────────────────────────

    event CraftingComplete(
        address indexed player,
        uint256[] burnedTokenIds,
        uint256 resultTokenId,
        CardNFT.Rarity resultRarity
    );
    event QuestProgressNotification(address indexed player, string questType);
    event QuestSystemSet(address indexed qs);
    event RarityTokenAdded(CardNFT.Rarity rarity, uint256 tokenId);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error MustCraftThreeCards();
    error CardsMustBeSameRarity();
    error MaxRarityReached();
    error NoCraftableTokenAtTargetRarity();
    error InsufficientCardBalance(uint256 tokenId);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _cardNFT) Ownable(msg.sender) {
        cardNFT = CardNFT(_cardNFT);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Link to Dev 2's QuestSystem (can be set after deployment)
    function setQuestSystem(address _qs) external onlyOwner {
        questSystem = IQuestSystem(_qs);
        emit QuestSystemSet(_qs);
    }

    /// @notice Register which token IDs belong to each rarity
    ///         Must be populated before crafting can work.
    function addRarityToken(CardNFT.Rarity rarity, uint256 tokenId) external onlyOwner {
        rarityTokenIds[rarity].push(tokenId);
        emit RarityTokenAdded(rarity, tokenId);
    }

    // ─── Core Crafting ───────────────────────────────────────────────────────

    /**
     * @notice Craft 3 same-rarity cards into 1 higher-rarity card.
     * @param tokenIds  Array of exactly 3 token IDs. All must share the same rarity.
     *                  Can be different token IDs within the same rarity.
     */
    function craft(uint256[] calldata tokenIds) external returns (uint256 resultTokenId) {
        if (tokenIds.length != 3) revert MustCraftThreeCards();

        // Verify all three share the same rarity
        CardNFT.Rarity inputRarity = cardNFT.getRarity(tokenIds[0]);
        for (uint256 i = 1; i < 3; i++) {
            if (cardNFT.getRarity(tokenIds[i]) != inputRarity) revert CardsMustBeSameRarity();
        }

        // Can't upgrade beyond Legendary
        if (inputRarity == CardNFT.Rarity.Legendary) revert MaxRarityReached();

        // Verify player owns at least 1 of each
        for (uint256 i = 0; i < 3; i++) {
            if (cardNFT.balanceOf(msg.sender, tokenIds[i]) == 0) {
                revert InsufficientCardBalance(tokenIds[i]);
            }
        }

        // Burn all 3 input cards
        for (uint256 i = 0; i < 3; i++) {
            cardNFT.burnFrom(msg.sender, tokenIds[i], 1);
        }

        // Determine target rarity
        CardNFT.Rarity targetRarity = CardNFT.Rarity(uint8(inputRarity) + 1);

        // Pick a random token from target rarity pool
        uint256[] storage targetPool = rarityTokenIds[targetRarity];
        if (targetPool.length == 0) revert NoCraftableTokenAtTargetRarity();

        _nonce++;
        uint256 randomIndex = uint256(
            keccak256(abi.encodePacked(block.prevrandao, block.timestamp, msg.sender, _nonce))
        ) % targetPool.length;
        resultTokenId = targetPool[randomIndex];

        // Mint the result card to the player
        cardNFT.mint(msg.sender, resultTokenId, 1);

        emit CraftingComplete(msg.sender, tokenIds, resultTokenId, targetRarity);

        // Notify QuestSystem if wired up
        if (address(questSystem) != address(0)) {
            try questSystem.notifyCraft(msg.sender) {} catch {}
            emit QuestProgressNotification(msg.sender, "CRAFT");
        }
    }
}
