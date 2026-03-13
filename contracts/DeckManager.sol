// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Placeholder interface for BattleEngine — compiles cleanly without it.
/// Wire the real address once BattleEngine.sol is deployed.
interface IBattleEngine {
    function isBattleActive(address player) external view returns (bool);
}

/// @dev Minimal interface for CardNFT (ERC-1155) — provided by Dev 1.
interface ICardNFT {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

/**
 * @title DeckManager
 * @notice Handles deck registration, validation, and lock/unlock lifecycle.
 *         Interfaces with CardNFT for ownership checks and exposes a
 *         placeholder hook for BattleEngine.
 */
contract DeckManager is Ownable {
    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    struct Deck {
        uint256 deckId;
        uint256[20] cardIds;
        bool isLocked;
        bool exists;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    ICardNFT public cardNFT;
    IBattleEngine public battleEngine; // placeholder — can be zero address initially

    uint256 private _nextDeckId;

    /// @dev player → list of decks
    mapping(address => Deck[]) private _playerDecks;

    /// @dev deckId → owner (for quick lookup)
    mapping(uint256 => address) public deckOwner;

    /// @dev address authorised to lock/unlock decks (e.g. BattleEngine)
    mapping(address => bool) public authorisedLocker;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event DeckRegistered(address indexed player, uint256 indexed deckId, uint256[20] cardIds);
    event DeckLocked(address indexed player, uint256 indexed deckId);
    event DeckUnlocked(address indexed player, uint256 indexed deckId);
    event BattleEngineUpdated(address indexed newBattleEngine);
    event LockerAuthorised(address indexed locker, bool status);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error InvalidDeckSize(uint256 provided);
    error CardNotOwned(uint256 cardId);
    error DeckAlreadyLocked(uint256 deckId);
    error DeckNotLocked(uint256 deckId);
    error DeckNotFound(uint256 deckId);
    error NotAuthorised();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _cardNFT   Address of CardNFT.sol (Dev 1). Use address(0) as
     *                   placeholder until Dev 1 deploys.
     */
    constructor(address _cardNFT) Ownable(msg.sender) {
        cardNFT = ICardNFT(_cardNFT);
        _nextDeckId = 1;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setBattleEngine(address _battleEngine) external onlyOwner {
        battleEngine = IBattleEngine(_battleEngine);
        emit BattleEngineUpdated(_battleEngine);
    }

    function setCardNFT(address _cardNFT) external onlyOwner {
        cardNFT = ICardNFT(_cardNFT);
    }

    function setAuthorisedLocker(address locker, bool status) external onlyOwner {
        authorisedLocker[locker] = status;
        emit LockerAuthorised(locker, status);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new deck of exactly 20 cards.
     * @param cardIds Array of exactly 20 ERC-1155 token IDs the caller owns.
     */
    function registerDeck(uint256[20] calldata cardIds) external returns (uint256 deckId) {
        // Validate ownership of every card
        address sender = msg.sender;
        for (uint256 i = 0; i < 20; i++) {
            if (address(cardNFT) != address(0)) {
                if (cardNFT.balanceOf(sender, cardIds[i]) == 0) {
                    revert CardNotOwned(cardIds[i]);
                }
            }
        }

        deckId = _nextDeckId++;
        Deck memory newDeck = Deck({
            deckId: deckId,
            cardIds: cardIds,
            isLocked: false,
            exists: true
        });

        _playerDecks[sender].push(newDeck);
        deckOwner[deckId] = sender;

        emit DeckRegistered(sender, deckId, cardIds);
    }

    /**
     * @notice Lock a deck (called by BattleEngine or authorised locker).
     */
    function lockDeck(address player, uint256 deckId) external {
        if (!authorisedLocker[msg.sender] && msg.sender != owner()) revert NotAuthorised();
        Deck storage deck = _getDeck(player, deckId);
        if (deck.isLocked) revert DeckAlreadyLocked(deckId);
        deck.isLocked = true;
        emit DeckLocked(player, deckId);
    }

    /**
     * @notice Unlock a deck after battle is resolved.
     */
    function unlockDeck(address player, uint256 deckId) external {
        if (!authorisedLocker[msg.sender] && msg.sender != owner()) revert NotAuthorised();
        Deck storage deck = _getDeck(player, deckId);
        if (!deck.isLocked) revert DeckNotLocked(deckId);
        deck.isLocked = false;
        emit DeckUnlocked(player, deckId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function getPlayerDecks(address player) external view returns (Deck[] memory) {
        return _playerDecks[player];
    }

    function getDeckCount(address player) external view returns (uint256) {
        return _playerDecks[player].length;
    }

    function isDeckLocked(address player, uint256 deckId) external view returns (bool) {
        return _getDeck(player, deckId).isLocked;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _getDeck(address player, uint256 deckId) internal view returns (Deck storage) {
        Deck[] storage decks = _playerDecks[player];
        for (uint256 i = 0; i < decks.length; i++) {
            if (decks[i].deckId == deckId) return decks[i];
        }
        revert DeckNotFound(deckId);
    }
}
