// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRankSystemAI {
    function recordWin(address player, uint256 rpGain) external;
    function recordLoss(address player, uint256 rpLoss) external;
}

/**
 * @title AIBattleAgent
 * @notice Autonomous AI opponents for DeckWars.
 *
 *  Flow:
 *   1. Player calls challengeAI(deckId, difficulty)
 *   2. Contract emits AgentMove with a deterministic move hash
 *      (frontend subscribes and renders the AI's moves)
 *   3. An authorised resolver (oracle or owner) calls resolveAIBattle
 *      once the outcome is determined
 *   4. Winner receives HLUSD from the reward pool; RankSystem is updated
 */
contract AIBattleAgent is Ownable, ReentrancyGuard {
    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    enum Difficulty { Easy, Medium, Hard }

    enum BattleStatus { Pending, Resolved }

    struct Battle {
        uint256    battleId;
        address    player;
        uint256    deckId;
        Difficulty difficulty;
        BattleStatus status;
        bool       playerWon;
        uint256    startTime;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    // HLUSD rewards per difficulty (18 decimals)
    uint256 public constant REWARD_EASY   = 2  ether;
    uint256 public constant REWARD_MEDIUM = 5  ether;
    uint256 public constant REWARD_HARD   = 12 ether;

    // RP changes per difficulty
    uint256 public constant RP_GAIN_EASY   = 20;
    uint256 public constant RP_GAIN_MEDIUM = 40;
    uint256 public constant RP_GAIN_HARD   = 80;
    uint256 public constant RP_LOSS_ANY    = 15;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    IERC20           public hlUSD;
    IRankSystemAI    public rankSystem;

    uint256 private _nextBattleId;

    /// @dev battleId → Battle
    mapping(uint256 => Battle) public battles;

    /// @dev player → active battleId (0 = none)
    mapping(address => uint256) public activeBattle;

    /// @dev Authorised resolvers (oracles)
    mapping(address => bool) public authorisedResolver;

    /// @dev Current deterministic seed — updated on each challenge for variety
    bytes32 private _agentSeed;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Emitted for every AI move — frontend decodes moveHash to render the battle
    event AgentMove(
        address indexed player,
        uint256 indexed battleId,
        bytes32          moveHash
    );

    event AIBattleChallenged(
        address indexed player,
        uint256 indexed battleId,
        uint256         deckId,
        Difficulty      difficulty
    );

    event AIBattleResolved(
        address indexed player,
        uint256 indexed battleId,
        bool            playerWon,
        uint256         rewardPaid
    );

    event RewardPoolFunded(address indexed funder, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error NotAuthorised();
    error PlayerAlreadyInBattle(address player);
    error BattleNotPending(uint256 battleId);
    error BattleNotBelongToPlayer(uint256 battleId);
    error InsufficientRewardPool(uint256 required, uint256 available);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address _hlUSD, address _rankSystem) Ownable(msg.sender) {
        hlUSD      = IERC20(_hlUSD);
        rankSystem = IRankSystemAI(_rankSystem);
        _nextBattleId = 1;
        _agentSeed = keccak256(abi.encodePacked("DeckWars_AI_v1", block.timestamp));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setAuthorisedResolver(address resolver, bool status) external onlyOwner {
        authorisedResolver[resolver] = status;
    }

    function setRankSystem(address _rankSystem) external onlyOwner {
        rankSystem = IRankSystemAI(_rankSystem);
    }

    function setHLUSD(address _hlUSD) external onlyOwner {
        hlUSD = IERC20(_hlUSD);
    }

    /**
     * @notice Fund the AI reward pool with HLUSD. Anyone can call this.
     * @param amount  Amount of HLUSD (must be pre-approved by caller).
     */
    function fundRewardPool(uint256 amount) external {
        require(hlUSD.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit RewardPoolFunded(msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Challenge an AI opponent.
     * @param deckId      Deck ID registered in DeckManager.
     * @param difficulty  Easy / Medium / Hard.
     */
    function challengeAI(uint256 deckId, Difficulty difficulty)
        external
        returns (uint256 battleId)
    {
        if (activeBattle[msg.sender] != 0) revert PlayerAlreadyInBattle(msg.sender);

        battleId = _nextBattleId++;

        battles[battleId] = Battle({
            battleId:   battleId,
            player:     msg.sender,
            deckId:     deckId,
            difficulty: difficulty,
            status:     BattleStatus.Pending,
            playerWon:  false,
            startTime:  block.timestamp
        });

        activeBattle[msg.sender] = battleId;

        // Generate deterministic move hash for this battle:
        // seed = keccak256(previousSeed || player || deckId || difficulty || blockHash)
        // The frontend decodes this into a sequence of card plays.
        bytes32 moveHash = keccak256(
            abi.encodePacked(
                _agentSeed,
                msg.sender,
                deckId,
                uint256(difficulty),
                blockhash(block.number - 1)
            )
        );
        _agentSeed = moveHash; // evolve seed

        emit AIBattleChallenged(msg.sender, battleId, deckId, difficulty);
        emit AgentMove(msg.sender, battleId, moveHash);

        return battleId;
    }

    /**
     * @notice Resolve a battle. Called by an authorised oracle or the owner.
     * @param battleId   The battle to resolve.
     * @param player     The player's address (for verification).
     * @param playerWon  True if the player beat the AI.
     */
    function resolveAIBattle(
        uint256 battleId,
        address player,
        bool    playerWon
    ) external nonReentrant {
        if (!authorisedResolver[msg.sender] && msg.sender != owner()) revert NotAuthorised();

        Battle storage battle = battles[battleId];
        if (battle.status != BattleStatus.Pending) revert BattleNotPending(battleId);
        if (battle.player != player) revert BattleNotBelongToPlayer(battleId);

        battle.status    = BattleStatus.Resolved;
        battle.playerWon = playerWon;
        activeBattle[player] = 0;

        uint256 rewardPaid = 0;

        if (playerWon) {
            uint256 reward = _rewardForDifficulty(battle.difficulty);
            uint256 poolBalance = hlUSD.balanceOf(address(this));

            if (poolBalance < reward) {
                // Pool is dry — pay whatever is available
                reward = poolBalance;
            }

            if (reward > 0) {
                require(hlUSD.transfer(player, reward), "HLUSD transfer failed");
                rewardPaid = reward;
            }

            // Update rank
            if (address(rankSystem) != address(0)) {
                uint256 rpGain = _rpGainForDifficulty(battle.difficulty);
                rankSystem.recordWin(player, rpGain);
            }
        } else {
            if (address(rankSystem) != address(0)) {
                rankSystem.recordLoss(player, RP_LOSS_ANY);
            }
        }

        emit AIBattleResolved(player, battleId, playerWon, rewardPaid);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function getBattle(uint256 battleId) external view returns (Battle memory) {
        return battles[battleId];
    }

    function getRewardPoolBalance() external view returns (uint256) {
        return hlUSD.balanceOf(address(this));
    }

    function isPlayerInBattle(address player) external view returns (bool) {
        return activeBattle[player] != 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _rewardForDifficulty(Difficulty d) internal pure returns (uint256) {
        if (d == Difficulty.Hard)   return REWARD_HARD;
        if (d == Difficulty.Medium) return REWARD_MEDIUM;
        return REWARD_EASY;
    }

    function _rpGainForDifficulty(Difficulty d) internal pure returns (uint256) {
        if (d == Difficulty.Hard)   return RP_GAIN_HARD;
        if (d == Difficulty.Medium) return RP_GAIN_MEDIUM;
        return RP_GAIN_EASY;
    }
}
