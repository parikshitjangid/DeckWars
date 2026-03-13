import { expect } from "chai";
import { ethers } from "hardhat";
import { CardNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CardNFT", () => {
    let cardNFT: CardNFT;
    let owner: SignerWithAddress;
    let minter: SignerWithAddress;
    let player: SignerWithAddress;
    let other: SignerWithAddress;

    beforeEach(async () => {
        [owner, minter, player, other] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("CardNFT");
        cardNFT = await Factory.deploy("https://api.deckwars.io/metadata/{id}.json") as CardNFT;
    });

    describe("Card Stats", () => {
        it("owner can set card stats for valid token IDs", async () => {
            await cardNFT.setCardStats(1, 70, 50, 60, 0); // Common
            const stats = await cardNFT.getCardStats(1);
            expect(stats.attack).to.equal(70);
            expect(stats.defense).to.equal(50);
            expect(stats.speed).to.equal(60);
            expect(stats.rarity).to.equal(0); // Common
        });

        it("reverts for token ID 0", async () => {
            await expect(cardNFT.setCardStats(0, 70, 50, 60, 0)).to.be.reverted;
        });

        it("reverts for token ID > 20", async () => {
            await expect(cardNFT.setCardStats(21, 70, 50, 60, 0)).to.be.reverted;
        });

        it("non-owner cannot set card stats", async () => {
            await expect(cardNFT.connect(other).setCardStats(1, 70, 50, 60, 0)).to.be.reverted;
        });
    });

    describe("Supply Cap", () => {
        it("owner can set supply cap", async () => {
            await cardNFT.setSupplyCap(1, 1000);
            expect(await cardNFT.supplyCap(1)).to.equal(1000);
        });

        it("minting beyond supply cap reverts", async () => {
            await cardNFT.setCardStats(1, 70, 50, 60, 0);
            await cardNFT.setSupplyCap(1, 2);      // cap = 2
            await cardNFT.addMinter(minter.address);

            await cardNFT.connect(minter).mint(player.address, 1, 2); // fills cap
            await expect(cardNFT.connect(minter).mint(player.address, 1, 1)).to.be.reverted;
        });
    });

    describe("Minter Access Control", () => {
        beforeEach(async () => {
            await cardNFT.setCardStats(1, 70, 50, 60, 0);
        });

        it("unauthorized address cannot mint", async () => {
            await expect(cardNFT.connect(other).mint(player.address, 1, 1)).to.be.reverted;
        });

        it("authorized minter can mint", async () => {
            await cardNFT.addMinter(minter.address);
            await cardNFT.connect(minter).mint(player.address, 1, 5);
            expect(await cardNFT.balanceOf(player.address, 1)).to.equal(5);
        });

        it("revoked minter cannot mint", async () => {
            await cardNFT.addMinter(minter.address);
            await cardNFT.removeMinter(minter.address);
            await expect(cardNFT.connect(minter).mint(player.address, 1, 1)).to.be.reverted;
        });

        it("authorized minter can burn via burnFrom", async () => {
            await cardNFT.addMinter(minter.address);
            await cardNFT.connect(minter).mint(player.address, 1, 3);
            await cardNFT.connect(minter).burnFrom(player.address, 1, 2);
            expect(await cardNFT.balanceOf(player.address, 1)).to.equal(1);
        });
    });

    describe("Total Supply", () => {
        it("tracks total supply correctly after minting", async () => {
            await cardNFT.setCardStats(2, 65, 55, 70, 0);
            await cardNFT.addMinter(minter.address);
            await cardNFT.connect(minter).mint(player.address, 2, 10);
            const supply = await cardNFT["totalSupply(uint256)"](2);
            expect(supply).to.equal(10);
        });
    });

    describe("Rarity Getter", () => {
        it("returns correct rarity", async () => {
            await cardNFT.setCardStats(16, 140, 110, 110, 3); // Legendary
            expect(await cardNFT.getRarity(16)).to.equal(3);
        });

        it("reverts for uninitialized card", async () => {
            await expect(cardNFT.getRarity(5)).to.be.reverted;
        });
    });
});
