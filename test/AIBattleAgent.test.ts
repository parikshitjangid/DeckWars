import { expect } from "chai";
import { ethers } from "hardhat";
import { AIBattleAgent, RankSystem } from "../typechain-types";

// Mock ERC20 used in place of HLUSD in tests
async function deployMockHLUSD() {
  // Use OpenZeppelin's ERC20 mock via a minimal inline contract
  const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
  const token = await ERC20Mock.deploy("HLUSD Mock", "HLUSD");
  return token;
}

describe("AIBattleAgent", function () {
  let aiAgent: AIBattleAgent;
  let rankSystem: RankSystem;
  let hlUSD: any;
  let owner: any, player: any, resolver: any;

  beforeEach(async function () {
    [owner, player, resolver] = await ethers.getSigners();

    // Deploy RankSystem
    const RankFactory = await ethers.getContractFactory("RankSystem");
    rankSystem = (await RankFactory.deploy()) as RankSystem;

    // Deploy a minimal ERC20 for HLUSD
    const ERC20Factory = await ethers.getContractFactory("ERC20Mock");
    hlUSD = await ERC20Factory.deploy("HLUSD Mock", "HLUSD");

    // Deploy AIBattleAgent
    const AgentFactory = await ethers.getContractFactory("AIBattleAgent");
    aiAgent = (await AgentFactory.deploy(
      await hlUSD.getAddress(),
      await rankSystem.getAddress()
    )) as AIBattleAgent;

    // Authorise AIBattleAgent as rank recorder
    await rankSystem.setAuthorisedRecorder(await aiAgent.getAddress(), true);

    // Authorise resolver
    await aiAgent.setAuthorisedResolver(resolver.address, true);

    // Fund the reward pool with 100 HLUSD
    await hlUSD.mint(owner.address, ethers.parseEther("100"));
    await hlUSD.approve(await aiAgent.getAddress(), ethers.parseEther("100"));
    await aiAgent.fundRewardPool(ethers.parseEther("100"));
  });

  describe("challengeAI", function () {
    it("creates a battle and emits AIBattleChallenged and AgentMove", async function () {
      await expect(aiAgent.connect(player).challengeAI(1n, 0n)) // Easy
        .to.emit(aiAgent, "AIBattleChallenged")
        .withArgs(player.address, 1n, 1n, 0n)
        .and.to.emit(aiAgent, "AgentMove");
    });

    it("sets player as active in battle", async function () {
      await aiAgent.connect(player).challengeAI(1n, 0n);
      expect(await aiAgent.isPlayerInBattle(player.address)).to.be.true;
    });

    it("reverts if player already in a battle", async function () {
      await aiAgent.connect(player).challengeAI(1n, 0n);
      await expect(aiAgent.connect(player).challengeAI(2n, 0n))
        .to.be.revertedWithCustomError(aiAgent, "PlayerAlreadyInBattle");
    });
  });

  describe("resolveAIBattle", function () {
    beforeEach(async function () {
      await aiAgent.connect(player).challengeAI(1n, 1n); // Medium
    });

    it("resolves with player win — transfers HLUSD reward", async function () {
      const balanceBefore = await hlUSD.balanceOf(player.address);
      await expect(aiAgent.connect(resolver).resolveAIBattle(1n, player.address, true))
        .to.emit(aiAgent, "AIBattleResolved")
        .withArgs(player.address, 1n, true, ethers.parseEther("5")); // Medium = 5 HLUSD
      const balanceAfter = await hlUSD.balanceOf(player.address);
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("5"));
    });

    it("resolves with player loss — pool unchanged for player", async function () {
      const poolBefore = await aiAgent.getRewardPoolBalance();
      await aiAgent.connect(resolver).resolveAIBattle(1n, player.address, false);
      const poolAfter = await aiAgent.getRewardPoolBalance();
      expect(poolAfter).to.equal(poolBefore);
    });

    it("records win in RankSystem on player win", async function () {
      await aiAgent.connect(resolver).resolveAIBattle(1n, player.address, true);
      const stats = await rankSystem.getPlayerStats(player.address);
      expect(stats.wins).to.equal(1n); // Medium = 40 RP gain
      expect(stats.currentSeasonRP).to.equal(40n);
    });

    it("records loss in RankSystem on player loss", async function () {
      await aiAgent.connect(resolver).resolveAIBattle(1n, player.address, false);
      const stats = await rankSystem.getPlayerStats(player.address);
      expect(stats.losses).to.equal(1n);
    });

    it("reverts for non-resolver", async function () {
      await expect(aiAgent.connect(player).resolveAIBattle(1n, player.address, true))
        .to.be.revertedWithCustomError(aiAgent, "NotAuthorised");
    });

    it("reverts double resolution", async function () {
      await aiAgent.connect(resolver).resolveAIBattle(1n, player.address, true);
      await expect(aiAgent.connect(resolver).resolveAIBattle(1n, player.address, true))
        .to.be.revertedWithCustomError(aiAgent, "BattleNotPending");
    });

    it("player is no longer in battle after resolution", async function () {
      await aiAgent.connect(resolver).resolveAIBattle(1n, player.address, true);
      expect(await aiAgent.isPlayerInBattle(player.address)).to.be.false;
    });
  });

  describe("fundRewardPool", function () {
    it("correctly increases pool balance", async function () {
      const before = await aiAgent.getRewardPoolBalance();
      await hlUSD.mint(owner.address, ethers.parseEther("10"));
      await hlUSD.approve(await aiAgent.getAddress(), ethers.parseEther("10"));
      await aiAgent.fundRewardPool(ethers.parseEther("10"));
      expect(await aiAgent.getRewardPoolBalance()).to.equal(before + ethers.parseEther("10"));
    });
  });
});
