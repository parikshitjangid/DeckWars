// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {HLUSD} from "./HLUSD.sol";
import {DeckWarsCard} from "./DeckWarsCard.sol";
import {DeckWarsTreasury} from "./DeckWarsTreasury.sol";

contract DeckWarsPacks is Ownable {
    HLUSD public immutable token;
    DeckWarsCard public immutable cardContract;
    DeckWarsTreasury public immutable treasury;

    mapping(address => mapping(uint8 => uint256)) public packsPurchased;
    mapping(address => mapping(uint8 => uint256)) public pityCounter;

    event PackOpened(
        address indexed player,
        uint8 packType,
        uint256[] cardIds
    );

    constructor(
        address _token,
        address _card,
        address _treasury
    ) Ownable(msg.sender) {
        require(_token != address(0), "Token required");
        require(_card != address(0), "Card required");
        require(_treasury != address(0), "Treasury required");
        token = HLUSD(_token);
        cardContract = DeckWarsCard(_card);
        treasury = DeckWarsTreasury(_treasury);
    }

    function openPack(uint8 packType) external {
        require(packType <= 2, "Invalid pack type");
        uint256 price = getPackPrice(packType);
        uint8 cardsCount = packType == 0 ? 3 : 5;

        treasury.receivePayment(msg.sender, price);

        pityCounter[msg.sender][packType] += 1;
        uint256 pityThreshold = _pityThreshold(packType);

        uint256[] memory cardIds = new uint256[](cardsCount);
        bool pityTriggered = pityCounter[msg.sender][packType] >= pityThreshold;

        for (uint256 i = 0; i < cardsCount; i++) {
            uint8 rarity;
            if (pityTriggered) {
                rarity = _pityMinimumRarity(packType);
            } else {
                rarity = _weightedRarity(
                    packType,
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                blockhash(block.number - 1),
                                msg.sender,
                                packType,
                                i,
                                block.timestamp
                            )
                        )
                    )
                );
            }
            uint256 seed = uint256(
                keccak256(
                    abi.encodePacked(
                        blockhash(block.number - 1),
                        msg.sender,
                        packType,
                        i,
                        block.timestamp,
                        rarity
                    )
                )
            );
            uint256 cardId = _randomCardOfRarity(rarity, seed);
            cardIds[i] = cardId;
            cardContract.mintCard(msg.sender, cardId, 1);
        }

        if (pityTriggered) {
            pityCounter[msg.sender][packType] = 0;
        }

        packsPurchased[msg.sender][packType] += 1;

        emit PackOpened(msg.sender, packType, cardIds);
    }

    function _pityThreshold(uint8 packType) internal pure returns (uint256) {
        if (packType == 0) return 50;
        if (packType == 1) return 20;
        return 10;
    }

    function _pityMinimumRarity(uint8 packType) internal pure returns (uint8) {
        if (packType == 0) return 2;
        if (packType == 1) return 3;
        return 4;
    }

    function _weightedRarity(
        uint8 packType,
        uint256 seed
    ) internal pure returns (uint8) {
        uint256 roll = seed % 1000;
        if (packType == 0) {
            if (roll < 600) return 0;
            if (roll < 850) return 1;
            if (roll < 980) return 2;
            if (roll < 995) return 3;
            return 4;
        } else if (packType == 1) {
            if (roll < 400) return 0;
            if (roll < 700) return 1;
            if (roll < 900) return 2;
            if (roll < 970) return 3;
            return 4;
        } else {
            if (roll < 200) return 0;
            if (roll < 450) return 1;
            if (roll < 750) return 2;
            if (roll < 850) return 3;
            return 4;
        }
    }

    function _randomCardOfRarity(
        uint8 rarity,
        uint256 seed
    ) internal view returns (uint256) {
        uint256[] memory matches = new uint256[](20);
        uint256 count;
        for (uint256 i = 1; i <= 20; i++) {
            if (cardContract.getRarity(i) == rarity) {
                matches[count] = i;
                count++;
            }
        }
        require(count > 0, "No cards for rarity");
        uint256 index = seed % count;
        return matches[index];
    }

    function getPackPrice(uint8 packType) public pure returns (uint256) {
        if (packType == 0) return 5 ether;
        if (packType == 1) return 15 ether;
        if (packType == 2) return 50 ether;
        revert("Invalid pack type");
    }

    function getPityProgress(
        address player,
        uint8 packType
    ) external view returns (uint256 current, uint256 threshold) {
        return (pityCounter[player][packType], _pityThreshold(packType));
    }
}

