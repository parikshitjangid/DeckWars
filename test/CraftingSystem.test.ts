import { expect } from "chai";
import { ethers } from "hardhat";
import { CraftingSystem, CardNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CraftingSystem", () => {
    let cardNFT: CardNFT;
    let crafting: CraftingSystem;
    let owner: SignerWithAddress;
    let player: SignerWithAddress;

    beforeEach(async () => {
        [owner, player] = await ethers.getSigners();

        // Deploy CardNFT
        const CardFactory = await ethers.getContractFactory("CardNFT");
        cardNFT = await CardFactory.deploy("https://api.deckwars.io/metadata/{id}.json") as CardNFT;

        // Set up 15 cards: 5 Common, 5 Rare, 5 Epic
        for (let id = 1; id <= 5; id++)  await cardNFT.setCardStats(id, 3, 2, 0, 0); // Common, Fire
        for (let id = 6; id <= 10; id++) await cardNFT.setCardStats(id, 6, 5, 1, 1); // Rare, Water
        for (let id = 11; id <= 15; id++) await cardNFT.setCardStats(id, 8, 7, 2, 2); // Epic, Earth
        for (let id = 16; id <= 20; id++) await cardNFT.setCardStats(id, 10, 9, 0, 3); // Legendary, Fire

        // Deploy CraftingSystem
        const CraftFactory = await ethers.getContractFactory("CraftingSystem");
        crafting = await CraftFactory.deploy(await cardNFT.getAddress()) as CraftingSystem;

        // Authorize CraftingSystem to mint/burn
        await cardNFT.addMinter(await crafting.getAddress());

        // Register rarity pools
        for (let id = 1; id <= 5; id++)   await crafting.addRarityToken(0, id); // Common pool
        for (let id = 6; id <= 10; id++)  await crafting.addRarityToken(1, id); // Rare pool
        for (let id = 11; id <= 15; id++) await crafting.addRarityToken(2, id); // Epic pool
        for (let id = 16; id <= 20; id++) await crafting.addRarityToken(3, id); // Legendary pool

        // Give player some Common cards (token 1)
        await cardNFT.addMinter(owner.address);
        await cardNFT.mint(player.address, 1, 10); // 10× Common card #1
        await cardNFT.mint(player.address, 2, 10); // 10× Common card #2
        await cardNFT.mint(player.address, 3, 10); // 10× Common card #3
    });

    describe("Crafting Commons → Rare", () => {
        it("burns 3 same-rarity cards and mints 1 higher-rarity card", async () => {
            const before1 = await cardNFT.balanceOf(player.address, 1);
            await crafting.connect(player).craft([1, 1, 1]); // burn 3× Common #1
            const after1 = await cardNFT.balanceOf(player.address, 1);
            expect(after1).to.equal(before1 - 3n);

            // Player should now own at least 1 Rare card (token 6–10)
            let hasRare = false;
            for (let id = 6; id <= 10; id++) {
                if ((await cardNFT.balanceOf(player.address, id)) > 0n) {
                    hasRare = true;
                    break;
                }
            }
            expect(hasRare).to.be.true;
        });

        it("can craft with 3 different Common tokens", async () => {
            await crafting.connect(player).craft([1, 2, 3]);
            // Player lost 1 of each Common
            expect(await cardNFT.balanceOf(player.address, 1)).to.equal(9);
            expect(await cardNFT.balanceOf(player.address, 2)).to.equal(9);
            expect(await cardNFT.balanceOf(player.address, 3)).to.equal(9);
        });
    });

    describe("Error Cases", () => {
        it("reverts when fewer than 3 cards provided", async () => {
            await expect(crafting.connect(player).craft([1, 1])).to.be.reverted;
        });

        it("reverts when cards are of different rarities", async () => {
            await cardNFT.mint(player.address, 6, 2); // 2× Rare card #6
            await expect(crafting.connect(player).craft([1, 1, 6])).to.be.reverted;
        });

        it("reverts when player does not own the card", async () => {
            await expect(crafting.connect(player).craft([11, 11, 11])).to.be.reverted; // owns no Epics
        });

        it("reverts when trying to craft Legendary (max rarity)", async () => {
            await cardNFT.mint(player.address, 16, 10);
            await expect(crafting.connect(player).craft([16, 16, 16])).to.be.reverted;
        });
    });
});
