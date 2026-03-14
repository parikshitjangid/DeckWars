// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ReentrancyGuardLocal.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev Minimal interfaces for cross-contract calls
interface ICardNFTBattle {
    enum Element { Fire, Water, Earth }
    struct CardStats {
        uint16 attack;
        uint16 defense;
        Element element;
        uint8 rarity; // stored as uint8 for the enum
        bool exists;
    }
    function getCardStats(uint256 tokenId) external view returns (CardStats memory);
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

interface IDeckManagerBattle {
    function lockDeck(address player, uint256 deckId) external;
    function unlockDeck(address player, uint256 deckId) external;
    function getPlayerDecks(address player) external view returns (DeckView[] memory);
}

/// @dev Struct to read deck data from DeckManager
struct DeckView {
    uint256 deckId;
    uint256[20] cardIds;
    bool isLocked;
    bool exists;
}

interface IQuestSystemBattle {
    function notifyBattleWin(address player) external;
}

interface IRankSystemBattle {
    function recordWin(address player, uint256 rpGain) external;
    function recordLoss(address player, uint256 rpLoss) external;
}

/**
 * @title BattleEngine
 * @notice Fully on-chain PvP battle system for DeckWars.
 *
 *  Inspired by Clash Royale + Pokémon TCG:
 *   • Energy system: 5 energy per turn, each card costs 1-3 energy
 *   • Hand of 5 cards drawn from the 20-card deck
 *   • Element triangle: Fire > Earth > Water > Fire (+3 bonus damage)
 *   • 3 move types: Attack, Defend, Special (double damage, once per battle)
 *   • 5-minute turn timer with timeout claims
 *
 *  💰 Wager Mode:
 *   • Challenger sets a HLUSD wager when creating a challenge
 *   • Opponent must match the exact wager to accept
 *   • Both amounts are escrowed in this contract
 *   • Winner receives the full pot (both wagers)
 *   • Wager = 0 means a free (ranked) match
 *   • Cancelled challenges get their wager refunded
 *
 *  Flow:
 *   1. Player A approves HLUSD (if wagering), then calls challengePlayer(opponent, deckId, wagerAmount)
 *   2. Player B approves HLUSD (matching amount), then calls acceptBattle(battleId, deckId)
 *   3. Both decks locked → Battle ACTIVE, HLUSD escrowed
 *   4. Players alternate turns, choosing a card from their hand + a move
 *   5. First player to 0 HP loses
 *   6. Winner receives full pot, decks unlocked, quests + ranking updated
 */
contract BattleEngine is Ownable, ReentrancyGuardLocal {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    enum MoveType { Attack, Defend, Special }
    enum BattleStatus { Pending, Active, Completed, Cancelled }

    struct PlayerState {
        address player;
        uint256 deckId;
        int256  hp;
        uint256 energy;
        bool    specialUsed;
        bool    defending;
        uint256[5] hand;       // 5 cards drawn from deck
        uint256 handSize;      // cards remaining in hand
    }

    struct Battle {
        uint256      battleId;
        PlayerState  playerA;
        PlayerState  playerB;
        BattleStatus status;
        address      currentTurn;   // whose turn it is
        uint256      turnNumber;
        uint256      turnDeadline;  // block.timestamp + TURN_TIMEOUT
        uint256      totalDamageA;  // total damage dealt by A
        uint256      totalDamageB;  // total damage dealt by B
        address      winner;
        // ── Wager ────────────────────────────────────────────────────────────
        uint256      wagerAmount;   // HLUSD per player (0 = free match)
        bool         playerADeposited;
        bool         playerBDeposited;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    uint256 public constant STARTING_HP      = 100;
    uint256 public constant MAX_ENERGY       = 5;
    uint256 public constant TURN_TIMEOUT     = 5 minutes;
    uint256 public constant ELEMENT_BONUS    = 3;
    uint256 public constant MIN_DAMAGE       = 1;

    // RP rewards
    uint256 public constant RP_WIN_BASE     = 25;
    uint256 public constant RP_FAST_WIN     = 10;  // win in < 5 turns
    uint256 public constant RP_HEALTHY_WIN  = 20;  // win with HP > 80
    uint256 public constant RP_LOSS_BASE    = 10;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    ICardNFTBattle       public cardNFT;
    IDeckManagerBattle   public deckManager;
    IQuestSystemBattle   public questSystem;
    IRankSystemBattle    public rankSystem;
    IERC20               public hlusd;          // HLUSD stablecoin for wagers

    uint256 private _nextBattleId;

    /// @dev battleId → Battle
    mapping(uint256 => Battle) public battles;

    /// @dev player → active battleId (0 = none)
    mapping(address => uint256) public activeBattle;

    /// @dev Nonce for pseudo-random hand drawing
    uint256 private _nonce;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event BattleCreated(
        uint256 indexed battleId,
        address indexed challenger,
        address indexed opponent,
        uint256 deckId,
        uint256 wagerAmount
    );

    event BattleAccepted(
        uint256 indexed battleId,
        address indexed acceptor,
        uint256 deckId
    );

    event MoveMade(
        uint256 indexed battleId,
        address indexed player,
        uint256 cardId,
        MoveType moveType,
        uint256 damage,
        string  elementResult
    );

    event BattleResolved(
        uint256 indexed battleId,
        address indexed winner,
        address indexed loser,
        uint256 winnerHP,
        uint256 totalTurns,
        uint256 potPaid      // HLUSD won (0 if free match)
    );

    event BattleCancelled(uint256 indexed battleId, address indexed canceller);
    event WagerDeposited(uint256 indexed battleId, address indexed player, uint256 amount);
    event WagerRefunded(uint256 indexed battleId, address indexed player, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error PlayerAlreadyInBattle(address player);
    error CannotChallengeSelf();
    error BattleNotPending(uint256 battleId);
    error BattleNotActive(uint256 battleId);
    error NotYourTurn(address player);
    error NotBattleParticipant(address player);
    error InvalidCardIndex(uint256 index);
    error NotEnoughEnergy(uint256 required, uint256 available);
    error TurnNotTimedOut();
    error BattleNotFound(uint256 battleId);
    error HLUSDNotConfigured();
    error WagerTransferFailed();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(
        address _cardNFT,
        address _deckManager,
        address _questSystem,
        address _rankSystem,
        address _hlusd
    ) Ownable(msg.sender) {
        cardNFT     = ICardNFTBattle(_cardNFT);
        deckManager = IDeckManagerBattle(_deckManager);
        questSystem = IQuestSystemBattle(_questSystem);
        rankSystem  = IRankSystemBattle(_rankSystem);
        hlusd       = IERC20(_hlusd);
        _nextBattleId = 1;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setCardNFT(address _cardNFT) external onlyOwner {
        cardNFT = ICardNFTBattle(_cardNFT);
    }

    function setDeckManager(address _deckManager) external onlyOwner {
        deckManager = IDeckManagerBattle(_deckManager);
    }

    function setQuestSystem(address _questSystem) external onlyOwner {
        questSystem = IQuestSystemBattle(_questSystem);
    }

    function setRankSystem(address _rankSystem) external onlyOwner {
        rankSystem = IRankSystemBattle(_rankSystem);
    }

    function setHLUSD(address _hlusd) external onlyOwner {
        hlusd = IERC20(_hlusd);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core — Challenge & Accept
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Challenge another player to a battle.
     * @param opponent     Address of the player to challenge.
     * @param deckId       Your registered deck ID.
     * @param wagerAmount  HLUSD to wager (0 = free ranked match).
     *                     Opponent must match this amount to accept.
     *                     Must have approved this contract to spend the amount.
     */
    function challengePlayer(address opponent, uint256 deckId, uint256 wagerAmount)
        external
        nonReentrant
        returns (uint256 battleId)
    {
        if (msg.sender == opponent) revert CannotChallengeSelf();
        if (activeBattle[msg.sender] != 0) revert PlayerAlreadyInBattle(msg.sender);
        if (activeBattle[opponent] != 0) revert PlayerAlreadyInBattle(opponent);

        battleId = _nextBattleId++;

        Battle storage b = battles[battleId];
        b.battleId     = battleId;
        b.status       = BattleStatus.Pending;
        b.turnNumber   = 0;
        b.wagerAmount  = wagerAmount;

        // Set up challenger state
        b.playerA.player = msg.sender;
        b.playerA.deckId = deckId;
        b.playerA.hp     = int256(STARTING_HP);
        b.playerA.energy = MAX_ENERGY;

        // Set opponent placeholder
        b.playerB.player = opponent;

        activeBattle[msg.sender] = battleId;

        // ── Escrow challenger's wager ─────────────────────────────────────
        if (wagerAmount > 0) {
            if (address(hlusd) == address(0)) revert HLUSDNotConfigured();
            hlusd.safeTransferFrom(msg.sender, address(this), wagerAmount);
            b.playerADeposited = true;
            emit WagerDeposited(battleId, msg.sender, wagerAmount);
        }

        emit BattleCreated(battleId, msg.sender, opponent, deckId, wagerAmount);
    }

    /**
     * @notice Accept a pending battle challenge.
     * @param battleId  The battle to accept.
     * @param deckId    Your registered deck ID.
     *                  If the battle has a wager, you must have approved
     *                  this contract to spend the matching HLUSD amount.
     */
    function acceptBattle(uint256 battleId, uint256 deckId) external nonReentrant {
        Battle storage b = battles[battleId];
        if (b.status != BattleStatus.Pending) revert BattleNotPending(battleId);
        if (b.playerB.player != msg.sender) revert NotBattleParticipant(msg.sender);

        // ── Escrow acceptor's matching wager ─────────────────────────────
        if (b.wagerAmount > 0) {
            if (address(hlusd) == address(0)) revert HLUSDNotConfigured();
            hlusd.safeTransferFrom(msg.sender, address(this), b.wagerAmount);
            b.playerBDeposited = true;
            emit WagerDeposited(battleId, msg.sender, b.wagerAmount);
        }

        // Set up defender state
        b.playerB.deckId = deckId;
        b.playerB.hp     = int256(STARTING_HP);
        b.playerB.energy = MAX_ENERGY;

        activeBattle[msg.sender] = battleId;

        // Draw hands for both players
        _drawHand(b.playerA);
        _drawHand(b.playerB);

        // Lock both decks
        if (address(deckManager) != address(0)) {
            try deckManager.lockDeck(b.playerA.player, b.playerA.deckId) {} catch {}
            try deckManager.lockDeck(b.playerB.player, b.playerB.deckId) {} catch {}
        }

        // Activate battle
        b.status       = BattleStatus.Active;
        b.currentTurn  = b.playerA.player; // challenger goes first
        b.turnNumber   = 1;
        b.turnDeadline = block.timestamp + TURN_TIMEOUT;

        emit BattleAccepted(battleId, msg.sender, deckId);
    }

    /**
     * @notice Cancel a pending challenge (only challenger can cancel before accepted).
     *         Wager is refunded to the challenger.
     */
    function cancelChallenge(uint256 battleId) external nonReentrant {
        Battle storage b = battles[battleId];
        if (b.status != BattleStatus.Pending) revert BattleNotPending(battleId);
        if (b.playerA.player != msg.sender) revert NotBattleParticipant(msg.sender);

        b.status = BattleStatus.Cancelled;
        activeBattle[msg.sender] = 0;
        if (activeBattle[b.playerB.player] == battleId) {
            activeBattle[b.playerB.player] = 0;
        }

        // Refund challenger's wager
        if (b.wagerAmount > 0 && b.playerADeposited) {
            b.playerADeposited = false;
            hlusd.safeTransfer(msg.sender, b.wagerAmount);
            emit WagerRefunded(battleId, msg.sender, b.wagerAmount);
        }

        emit BattleCancelled(battleId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core — Make Move
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Make a move in an active battle.
     * @param battleId   The active battle ID.
     * @param handIndex  Index of the card in your hand (0-4).
     * @param move       The move type: Attack(0), Defend(1), Special(2).
     */
    function makeMove(
        uint256 battleId,
        uint256 handIndex,
        MoveType move
    ) external nonReentrant {
        Battle storage b = battles[battleId];
        if (b.status != BattleStatus.Active) revert BattleNotActive(battleId);
        if (b.currentTurn != msg.sender) revert NotYourTurn(msg.sender);

        // Identify attacker and defender
        bool isPlayerA = (msg.sender == b.playerA.player);
        PlayerState storage attacker = isPlayerA ? b.playerA : b.playerB;
        PlayerState storage defender = isPlayerA ? b.playerB : b.playerA;

        if (handIndex >= attacker.handSize) revert InvalidCardIndex(handIndex);

        uint256 cardId = attacker.hand[handIndex];
        ICardNFTBattle.CardStats memory attackerCard = cardNFT.getCardStats(cardId);

        // Energy cost: based on rarity (Common=1, Rare=2, Epic=3, Legendary=4)
        uint256 energyCost = uint256(attackerCard.rarity) + 1;
        if (attacker.energy < energyCost) revert NotEnoughEnergy(energyCost, attacker.energy);

        attacker.energy -= energyCost;

        // Calculate damage
        uint256 damage = 0;
        string memory elementResult = "Neutral";

        if (move == MoveType.Attack || move == MoveType.Special) {
            uint256 defCardId = defender.handSize > 0 ? defender.hand[0] : cardId;
            ICardNFTBattle.CardStats memory defCard = cardNFT.getCardStats(defCardId);

            // Base damage: ATK - DEF (minimum 1)
            uint256 atk = uint256(attackerCard.attack);
            uint256 def = uint256(defCard.defense);
            damage = atk > def ? atk - def : MIN_DAMAGE;

            // Element bonus
            if (_hasElementAdvantage(attackerCard.element, defCard.element)) {
                damage += ELEMENT_BONUS;
                elementResult = "Super Effective!";
            } else if (_hasElementAdvantage(defCard.element, attackerCard.element)) {
                if (damage > ELEMENT_BONUS) {
                    damage -= ELEMENT_BONUS;
                } else {
                    damage = MIN_DAMAGE;
                }
                elementResult = "Not Very Effective";
            }

            // Special: double damage, once per battle
            if (move == MoveType.Special) {
                require(!attacker.specialUsed, "Special already used");
                attacker.specialUsed = true;
                damage *= 2;
            }

            // If defender was defending, halve damage
            if (defender.defending) {
                damage = damage / 2;
                if (damage == 0) damage = MIN_DAMAGE;
                defender.defending = false;
            }

            // Apply damage
            defender.hp -= int256(damage);

            // Track total damage
            if (isPlayerA) {
                b.totalDamageA += damage;
            } else {
                b.totalDamageB += damage;
            }
        } else if (move == MoveType.Defend) {
            attacker.defending = true;
            elementResult = "Defending";
        }

        // Remove played card from hand (swap with last)
        _removeCardFromHand(attacker, handIndex);

        emit MoveMade(battleId, msg.sender, cardId, move, damage, elementResult);

        // Check if battle is over
        if (defender.hp <= 0) {
            _resolveBattle(b, attacker.player, defender.player);
            return;
        }

        // Switch turn
        b.currentTurn  = isPlayerA ? b.playerB.player : b.playerA.player;
        b.turnNumber  += 1;
        b.turnDeadline = block.timestamp + TURN_TIMEOUT;

        // Refill energy for next player (gain 3 energy per turn, capped at 5)
        PlayerState storage nextPlayer = isPlayerA ? b.playerB : b.playerA;
        nextPlayer.energy = nextPlayer.energy + 3;
        if (nextPlayer.energy > MAX_ENERGY) {
            nextPlayer.energy = MAX_ENERGY;
        }

        // If next player's hand is empty, redraw
        if (nextPlayer.handSize == 0) {
            _drawHand(nextPlayer);
        }
    }

    /**
     * @notice Claim victory if opponent has timed out on their turn.
     *         Winner receives the full wager pot.
     */
    function claimTimeout(uint256 battleId) external nonReentrant {
        Battle storage b = battles[battleId];
        if (b.status != BattleStatus.Active) revert BattleNotActive(battleId);
        if (block.timestamp < b.turnDeadline) revert TurnNotTimedOut();

        // The current turn player loses by timeout
        address loser = b.currentTurn;
        address winner = (loser == b.playerA.player) ? b.playerB.player : b.playerA.player;

        _resolveBattle(b, winner, loser);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function getBattle(uint256 battleId) external view returns (
        uint256 id,
        address playerA,
        address playerB,
        int256 hpA,
        int256 hpB,
        BattleStatus status,
        address currentTurn,
        uint256 turnNumber,
        uint256 turnDeadline,
        address winner,
        uint256 wagerAmount,
        uint256 pot            // total HLUSD in the pot (wagerAmount * 2 if both deposited)
    ) {
        Battle storage b = battles[battleId];
        uint256 currentPot = 0;
        if (b.playerADeposited) currentPot += b.wagerAmount;
        if (b.playerBDeposited) currentPot += b.wagerAmount;
        return (
            b.battleId,
            b.playerA.player,
            b.playerB.player,
            b.playerA.hp,
            b.playerB.hp,
            b.status,
            b.currentTurn,
            b.turnNumber,
            b.turnDeadline,
            b.winner,
            b.wagerAmount,
            currentPot
        );
    }

    function getPlayerHand(uint256 battleId, address player)
        external view returns (uint256[5] memory hand, uint256 handSize, uint256 energy)
    {
        Battle storage b = battles[battleId];
        if (player == b.playerA.player) {
            return (b.playerA.hand, b.playerA.handSize, b.playerA.energy);
        } else if (player == b.playerB.player) {
            return (b.playerB.hand, b.playerB.handSize, b.playerB.energy);
        }
        revert NotBattleParticipant(player);
    }

    function isBattleActive(address player) external view returns (bool) {
        return activeBattle[player] != 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Draw 5 cards pseudo-randomly from a player's 20-card deck.
     */
    function _drawHand(PlayerState storage pState) internal {
        for (uint256 i = 0; i < 5; i++) {
            _nonce++;
            uint256 cardIndex = uint256(
                keccak256(abi.encodePacked(
                    block.prevrandao, block.timestamp, pState.player, _nonce, i
                ))
            ) % 20;
            pState.hand[i] = (cardIndex % 20) + 1;
        }
        pState.handSize = 5;
    }

    /**
     * @dev Remove a card from hand by swapping with the last card.
     */
    function _removeCardFromHand(PlayerState storage pState, uint256 index) internal {
        uint256 lastIndex = pState.handSize - 1;
        if (index != lastIndex) {
            pState.hand[index] = pState.hand[lastIndex];
        }
        pState.hand[lastIndex] = 0;
        pState.handSize--;
    }

    /**
     * @dev Check element advantage: Fire > Earth > Water > Fire
     */
    function _hasElementAdvantage(
        ICardNFTBattle.Element attacker,
        ICardNFTBattle.Element defender
    ) internal pure returns (bool) {
        if (attacker == ICardNFTBattle.Element.Fire   && defender == ICardNFTBattle.Element.Earth) return true;
        if (attacker == ICardNFTBattle.Element.Earth  && defender == ICardNFTBattle.Element.Water) return true;
        if (attacker == ICardNFTBattle.Element.Water  && defender == ICardNFTBattle.Element.Fire)  return true;
        return false;
    }

    /**
     * @dev Resolve a battle:
     *      1. Pay out wager pot to winner (if any)
     *      2. Unlock decks
     *      3. Update quests + rankings
     *      4. Emit result
     */
    function _resolveBattle(
        Battle storage b,
        address winner,
        address loser
    ) internal {
        b.status = BattleStatus.Completed;
        b.winner = winner;

        // ── Pay wager pot to winner ───────────────────────────────────────
        uint256 pot = 0;
        if (b.wagerAmount > 0) {
            if (b.playerADeposited) pot += b.wagerAmount;
            if (b.playerBDeposited) pot += b.wagerAmount;

            b.playerADeposited = false;
            b.playerBDeposited = false;

            if (pot > 0) {
                hlusd.safeTransfer(winner, pot);
            }
        }

        // Unlock decks
        if (address(deckManager) != address(0)) {
            try deckManager.unlockDeck(b.playerA.player, b.playerA.deckId) {} catch {}
            try deckManager.unlockDeck(b.playerB.player, b.playerB.deckId) {} catch {}
        }

        // Clear active battles
        activeBattle[b.playerA.player] = 0;
        activeBattle[b.playerB.player] = 0;

        // Calculate RP for winner
        uint256 rpGain = RP_WIN_BASE;
        PlayerState storage winnerState = (winner == b.playerA.player) ? b.playerA : b.playerB;

        if (b.turnNumber < 5)             rpGain += RP_FAST_WIN;
        if (winnerState.hp > int256(80))  rpGain += RP_HEALTHY_WIN;

        // Update ranking
        if (address(rankSystem) != address(0)) {
            try rankSystem.recordWin(winner, rpGain) {} catch {}
            try rankSystem.recordLoss(loser, RP_LOSS_BASE) {} catch {}
        }

        // Update quest progress
        if (address(questSystem) != address(0)) {
            try questSystem.notifyBattleWin(winner) {} catch {}
        }

        uint256 winnerHP = winnerState.hp > 0 ? uint256(winnerState.hp) : 0;

        emit BattleResolved(
            b.battleId,
            winner,
            loser,
            winnerHP,
            b.turnNumber,
            pot
        );
    }
}
