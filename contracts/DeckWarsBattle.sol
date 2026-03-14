// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {DeckWarsCard} from "./DeckWarsCard.sol";
import {DeckWarsDeck} from "./DeckWarsDeck.sol";
import {DeckWarsRank} from "./DeckWarsRank.sol";
import {DeckWarsQuest} from "./DeckWarsQuest.sol";
import {DeckWarsSeasonPass} from "./DeckWarsSeasonPass.sol";

contract DeckWarsBattle is Ownable {
    struct Battle {
        address playerA;
        address playerB;
        uint256 hpA;
        uint256 hpB;
        uint8 currentTurn;
        uint256 turnNumber;
        uint256 lastMoveTime;
        uint8 status;
        address winner;
        bool specialUsedA;
        bool specialUsedB;
        bool defendedA;
        bool defendedB;
    }

    uint256 public constant TURN_TIMER = 300;
    uint256 public constant STARTING_HP = 100;

    mapping(uint256 => Battle) public battles;
    mapping(address => uint256) public activeBattle;
    uint256 public battleCount;
    uint256 public totalBattles;

    DeckWarsCard public immutable cardContract;
    DeckWarsDeck public immutable deckContract;
    DeckWarsRank public immutable rankContract;
    DeckWarsQuest public immutable questContract;
    DeckWarsSeasonPass public immutable seasonPass;

    event BattleCreated(
        uint256 indexed battleId,
        address indexed playerA,
        address indexed playerB
    );
    event BattleStarted(uint256 indexed battleId);
    event MovePlayed(
        uint256 indexed battleId,
        address indexed player,
        uint8 move,
        uint256 damage,
        uint256 remainingHP
    );
    event BattleEnded(
        uint256 indexed battleId,
        address winner,
        address loser
    );
    event TimeoutClaimed(uint256 indexed battleId, address winner);

    constructor(
        address _card,
        address _deck,
        address _rank,
        address _quest,
        address _seasonPass
    ) Ownable(msg.sender) {
        require(_card != address(0), "Card required");
        require(_deck != address(0), "Deck required");
        require(_rank != address(0), "Rank required");
        require(_quest != address(0), "Quest required");
        require(_seasonPass != address(0), "SeasonPass required");
        cardContract = DeckWarsCard(_card);
        deckContract = DeckWarsDeck(_deck);
        rankContract = DeckWarsRank(_rank);
        questContract = DeckWarsQuest(_quest);
        seasonPass = DeckWarsSeasonPass(_seasonPass);
    }

    function challengePlayer(address opponent) external returns (uint256) {
        require(opponent != msg.sender, "Cannot challenge self");
        require(
            deckContract.hasDeck(msg.sender),
            "Challenger has no deck"
        );
        require(deckContract.hasDeck(opponent), "Opponent has no deck");
        require(activeBattle[msg.sender] == 0, "Already in battle");
        require(activeBattle[opponent] == 0, "Opponent in battle");

        battleCount += 1;

        Battle storage b = battles[battleCount];
        b.playerA = msg.sender;
        b.playerB = opponent;
        b.hpA = STARTING_HP;
        b.hpB = STARTING_HP;
        b.currentTurn = 0;
        b.turnNumber = 0;
        b.status = 0;

        activeBattle[msg.sender] = battleCount;

        emit BattleCreated(battleCount, msg.sender, opponent);
        return battleCount;
    }

    function acceptBattle(uint256 battleId) external {
        Battle storage b = battles[battleId];
        require(b.playerB == msg.sender, "Not challenged player");
        require(b.status == 0, "Not pending");

        deckContract.lockDeck(b.playerA);
        deckContract.lockDeck(b.playerB);

        b.status = 1;
        b.lastMoveTime = block.timestamp;

        activeBattle[msg.sender] = battleId;
        totalBattles += 1;

        emit BattleStarted(battleId);
    }

    function playMove(uint256 battleId, uint8 move) external {
        require(move <= 2, "Invalid move");
        Battle storage b = battles[battleId];
        require(b.status == 1, "Battle not active");
        require(
            block.timestamp <= b.lastMoveTime + TURN_TIMER,
            "Turn timed out"
        );

        address attacker;
        address defender;
        bool attackerIsA = b.currentTurn == 0;
        if (attackerIsA) {
            attacker = b.playerA;
            defender = b.playerB;
        } else {
            attacker = b.playerB;
            defender = b.playerA;
        }
        require(msg.sender == attacker, "Not your turn");

        if (move == 2) {
            if (attackerIsA) {
                require(!b.specialUsedA, "Special already used");
                b.specialUsedA = true;
            } else {
                require(!b.specialUsedB, "Special already used");
                b.specialUsedB = true;
            }
        }

        uint256 atkCardId = deckContract.getCardAtTurn(
            attacker,
            b.turnNumber
        );
        uint256 defCardId = deckContract.getCardAtTurn(
            defender,
            b.turnNumber
        );

        DeckWarsCard.CardData memory atkCard = cardContract.getCard(atkCardId);
        DeckWarsCard.CardData memory defCard = cardContract.getCard(defCardId);

        uint256 baseDamage;
        if (move == 1) {
            baseDamage = 0;
        } else {
            if (atkCard.attack > defCard.defense) {
                baseDamage = atkCard.attack - defCard.defense;
            } else {
                baseDamage = 1;
            }

            if (_winsElement(atkCard.element, defCard.element)) {
                baseDamage += 3;
            }
        }

        if (move == 2) {
            baseDamage *= 2;
        }

        if (attackerIsA && b.defendedB) {
            baseDamage = baseDamage / 2;
        } else if (!attackerIsA && b.defendedA) {
            baseDamage = baseDamage / 2;
        }

        if (attackerIsA) {
            b.defendedA = move == 1;
            b.defendedB = false;
        } else {
            b.defendedB = move == 1;
            b.defendedA = false;
        }

        if (move == 1) {
            baseDamage = 0;
        }

        uint256 damage = baseDamage;
        if (attackerIsA) {
            if (damage >= b.hpB) {
                b.hpB = 0;
            } else {
                b.hpB -= damage;
            }
        } else {
            if (damage >= b.hpA) {
                b.hpA = 0;
            } else {
                b.hpA -= damage;
            }
        }

        b.lastMoveTime = block.timestamp;
        b.turnNumber += 1;
        b.currentTurn = attackerIsA ? 1 : 0;

        uint256 remainingHP = attackerIsA ? b.hpB : b.hpA;

        emit MovePlayed(battleId, attacker, move, damage, remainingHP);

        if (b.hpA == 0 || b.hpB == 0) {
            address winner = b.hpA == 0 ? b.playerB : b.playerA;
            _endBattle(battleId, winner);
        } else if (damage > 0) {
            rankContract.recordDamage(attacker, damage);
        }
    }

    function claimTimeout(uint256 battleId) external {
        Battle storage b = battles[battleId];
        require(b.status == 1, "Battle not active");
        require(
            block.timestamp > b.lastMoveTime + TURN_TIMER,
            "Turn not timed out"
        );

        address winner;
        if (b.currentTurn == 0) {
            winner = b.playerB;
        } else {
            winner = b.playerA;
        }

        _endBattle(battleId, winner);

        emit TimeoutClaimed(battleId, winner);
    }

    function _endBattle(uint256 battleId, address winner) internal {
        Battle storage b = battles[battleId];
        require(b.status == 1, "Battle not active");
        b.winner = winner;
        b.status = 2;

        address loser = winner == b.playerA ? b.playerB : b.playerA;

        deckContract.unlockDeck(b.playerA);
        deckContract.unlockDeck(b.playerB);

        rankContract.recordResult(winner, loser);
        questContract.updateBattleWin(winner);

        activeBattle[b.playerA] = 0;
        activeBattle[b.playerB] = 0;

        seasonPass.addPassXP(winner, 10);

        emit BattleEnded(battleId, winner, loser);
    }

    function getBattle(uint256 battleId) external view returns (Battle memory) {
        return battles[battleId];
    }

    function getActiveBattle(address player) external view returns (uint256) {
        return activeBattle[player];
    }

    function _winsElement(
        uint8 a,
        uint8 b
    ) internal pure returns (bool) {
        if (a == 0 && b == 2) return true;
        if (a == 2 && b == 1) return true;
        if (a == 1 && b == 0) return true;
        return false;
    }
}

