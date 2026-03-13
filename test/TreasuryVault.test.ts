import { expect } from "chai";
import { ethers } from "hardhat";
import { TreasuryVault } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("TreasuryVault", () => {
    let treasury: TreasuryVault;
    let mockHLUSD: any;
    let owner: SignerWithAddress;
    let devWallet: SignerWithAddress;
    let prizePool: SignerWithAddress;
    let source: SignerWithAddress;
    let other: SignerWithAddress;

    beforeEach(async () => {
        [owner, devWallet, prizePool, source, other] = await ethers.getSigners();

        // Deploy a minimal ERC-20 mock for HLUSD
        const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        mockHLUSD = await ERC20Mock.deploy("HeLa USD", "HLUSD");
        await mockHLUSD.mint(owner.address, ethers.parseEther("1000000"));

        // Deploy TreasuryVault
        const Factory = await ethers.getContractFactory("TreasuryVault");
        treasury = await Factory.deploy(
            await mockHLUSD.getAddress(),
            devWallet.address,
            prizePool.address
        ) as TreasuryVault;

        // Authorize the source
        await treasury.authorizeSource(source.address);
    });

    describe("Revenue Distribution", () => {
        it("splits 85% to devWallet and 15% to prizePool", async () => {
            // Fund the vault directly
            const amount = ethers.parseEther("100");
            await mockHLUSD.transfer(await treasury.getAddress(), amount);

            const devBefore = await mockHLUSD.balanceOf(devWallet.address);
            const prizeBefore = await mockHLUSD.balanceOf(prizePool.address);

            await treasury.distributeRevenue();

            const devAfter = await mockHLUSD.balanceOf(devWallet.address);
            const prizeAfter = await mockHLUSD.balanceOf(prizePool.address);

            expect(devAfter - devBefore).to.equal(ethers.parseEther("85"));
            expect(prizeAfter - prizeBefore).to.equal(ethers.parseEther("15"));
        });

        it("reverts distributeRevenue when balance is zero", async () => {
            await expect(treasury.distributeRevenue()).to.be.reverted;
        });

        it("vault balance is zero after distribution", async () => {
            await mockHLUSD.transfer(await treasury.getAddress(), ethers.parseEther("200"));
            await treasury.distributeRevenue();
            expect(await treasury.vaultBalance()).to.equal(0);
        });
    });

    describe("Source Authorization", () => {
        it("authorized source can call receiveRevenue", async () => {
            await treasury.connect(source).receiveRevenue(100); // just emits event
        });

        it("unauthorized source is rejected", async () => {
            await expect(treasury.connect(other).receiveRevenue(100)).to.be.reverted;
        });
    });

    describe("Admin", () => {
        it("owner can update devWallet", async () => {
            await treasury.setDevWallet(other.address);
            expect(await treasury.devWallet()).to.equal(other.address);
        });

        it("owner can update prizePool", async () => {
            await treasury.setPrizePool(other.address);
            expect(await treasury.prizePool()).to.equal(other.address);
        });

        it("cannot set zero address", async () => {
            await expect(treasury.setDevWallet(ethers.ZeroAddress)).to.be.reverted;
        });
    });
});
