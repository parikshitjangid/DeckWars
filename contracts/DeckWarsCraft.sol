// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {DeckWarsCard} from "./DeckWarsCard.sol";
import {DeckWarsQuest} from "./DeckWarsQuest.sol";

contract DeckWarsCraft is Ownable {
    mapping(address => uint256) public craftCount;

    DeckWarsCard public immutable cardContract;
    DeckWarsQuest public immutable questContract;

    event CardCrafted(
        address indexed player,
        uint256 inputCard,
        uint256 outputCard,
        uint8 newRarity
    );

    constructor(address _card, address _quest) Ownable(msg.sender) {
        require(_card != address(0), "Card required");
        require(_quest != address(0), "Quest required");
        cardContract = DeckWarsCard(_card);
        questContract = DeckWarsQuest(_quest);
    }

    function craftCard(uint256 inputCardId) external {
        require(inputCardId >= 1 && inputCardId <= 20, "Invalid card");
        require(
            cardContract.balanceOf(msg.sender, inputCardId) >= 3,
            "Need at least 3 cards"
        );

        uint8 rarity = cardContract.getRarity(inputCardId);
        require(rarity < 4, "Cannot craft beyond Legendary");

        cardContract.burn(msg.sender, inputCardId, 3);

        uint8 outputRarity = rarity + 1;
        uint256 seed = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    msg.sender,
                    inputCardId,
                    block.timestamp
                )
            )
        );
        uint256 outputCardId = _randomCardOfRarity(outputRarity, seed);

        cardContract.mintCard(msg.sender, outputCardId, 1);
        craftCount[msg.sender] += 1;
        questContract.updateCraft(msg.sender);

        emit CardCrafted(
            msg.sender,
            inputCardId,
            outputCardId,
            outputRarity
        );
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

    function getCraftCount(address player) external view returns (uint256) {
        return craftCount[player];
    }

    function getRecipe(uint8 inputRarity) external pure returns (string memory) {
        require(inputRarity < 4, "No recipe");
        if (inputRarity == 0) {
            return "3x Common -> 1x Uncommon";
        } else if (inputRarity == 1) {
            return "3x Uncommon -> 1x Rare";
        } else if (inputRarity == 2) {
            return "3x Rare -> 1x Epic";
        } else {
            return "3x Epic -> 1x Legendary";
        }
    }
}

