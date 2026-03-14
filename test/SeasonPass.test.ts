import { expect } from "chai";
import { ethers } from "hardhat";
import { SeasonPass, CardNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SeasonPass", () => {
    let seasonPass: SeasonPass;
    let cardNFT: CardNFT;
    let mockHLUSD: any;
    let mockTreasury: any;
    let owner: SignerWithAddress;
    let player: SignerWithAddress;
    let xpGranter: SignerWithAddress;

    beforeEach(async () => {
        [owner, player, xpGranter] = await ethers.getSigners();

        // Deploy mock HLUSD
        const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        mockHLUSD = await ERC20Mock.deploy("HeLa USD", "HLUSD");
        await mockHLUSD.mint(owner.address, ethers.parseEther("1000000"));

        // Give player HLUSD
        await mockHLUSD.transfer(player.address, ethers.parseEther("500"));

        // Deploy mock TreasuryVault
        const TreasuryFactory = await ethers.getContractFactory("TreasuryVault");
        mockTreasury = await TreasuryFactory.deploy(
            await mockHLUSD.getAddress(), owner.address, owner.address
        );

        // Deploy CardNFT
        const CardFactory = await ethers.getContractFactory("CardNFT");
        cardNFT = await CardFactory.deploy("https://api.deckwars.io/metadata/{id}.json") as CardNFT;
        await cardNFT.setCardStats(6, 6, 5, 1, 1); // Rare card for milestone

        // Deploy SeasonPass
        const PassFactory = await ethers.getContractFactory("SeasonPass");
        seasonPass = await PassFactory.deploy(
            await mockTreasury.getAddress(),
            await mockHLUSD.getAddress()
        ) as SeasonPass;

        // Wire up
        await mockTreasury.authorizeSource(await seasonPass.getAddress());
        await cardNFT.addMinter(await seasonPass.getAddress());
        await seasonPass.setCardNFT(await cardNFT.getAddress());
        await seasonPass.authorizeXPGranter(xpGranter.address);

        // Configure milestone: level 10 → card #6
        await seasonPass.setMilestone(10, 6);

        // Player approves pass purchase
        await mockHLUSD.connect(player).approve(
            await seasonPass.getAddress(),
            ethers.parseEther("1000")
        );
    });

    describe("Pass Purchase", () => {
        it("player can purchase a pass", async () => {
            await seasonPass.connect(player).purchasePass();
            const pass = await seasonPass.getPass(player.address);
            expect(pass.active).to.be.true;
            expect(pass.level).to.equal(1);
        });

        it("cannot purchase pass twice in same season", async () => {
            await seasonPass.connect(player).purchasePass();
            await expect(seasonPass.connect(player).purchasePass()).to.be.reverted;
        });
    });

    describe("XP and Level Up", () => {
        beforeEach(async () => {
            await seasonPass.connect(player).purchasePass();
        });

        it("authorized granter can add XP", async () => {
            await seasonPass.connect(xpGranter).addXP(player.address, 50);
            const pass = await seasonPass.getPass(player.address);
            expect(pass.xp).to.equal(50);
        });

        it("unauthorized address cannot grant XP", async () => {
            await expect(seasonPass.connect(player).addXP(player.address, 50)).to.be.reverted;
        });

        it("levels up when XP reaches threshold (100 XP per level)", async () => {
            await seasonPass.connect(xpGranter).addXP(player.address, 100);
            const pass = await seasonPass.getPass(player.address);
            expect(pass.level).to.equal(2);
            expect(pass.xp).to.equal(0);
        });

        it("levels up multiple times from bulk XP", async () => {
            await seasonPass.connect(xpGranter).addXP(player.address, 950);
            const pass = await seasonPass.getPass(player.address);
            expect(pass.level).to.equal(10); // 1 + 9 level-ups (9 × 100 = 900 XP consumed)
        });
    });

    describe("Milestone Claims", () => {
        beforeEach(async () => {
            await seasonPass.connect(player).purchasePass();
            await seasonPass.connect(xpGranter).addXP(player.address, 900); // reach level 10
        });

        it("player can claim milestone at correct level", async () => {
            await seasonPass.connect(player).claimMilestone(10);
            // Should have received card #6
            expect(await cardNFT.balanceOf(player.address, 6)).to.equal(1);
        });

        it("cannot claim milestone twice", async () => {
            await seasonPass.connect(player).claimMilestone(10);
            await expect(seasonPass.connect(player).claimMilestone(10)).to.be.reverted;
        });

        it("cannot claim milestone before reaching required level", async () => {
            await expect(seasonPass.connect(player).claimMilestone(25)).to.be.reverted;
        });
    });

    describe("Premium Multiplier", () => {
        it("returns false for player without pass", async () => {
            expect(await seasonPass.hasPremiumMultiplier(player.address)).to.be.false;
        });

        it("returns true for player with active pass", async () => {
            await seasonPass.connect(player).purchasePass();
            expect(await seasonPass.hasPremiumMultiplier(player.address)).to.be.true;
        });
    });
});
