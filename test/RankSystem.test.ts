import { expect } from "chai";
import { ethers } from "hardhat";
import { RankSystem } from "../typechain-types";

describe("RankSystem", function () {
  let rankSystem: RankSystem;
  let owner: any, recorder: any, player: any, player2: any, player3: any;

  beforeEach(async function () {
    [owner, recorder, player, player2, player3] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RankSystem");
    rankSystem = (await Factory.deploy()) as RankSystem;
    await rankSystem.setAuthorisedRecorder(recorder.address, true);
  });

  describe("recordWin", function () {
    it("initialises player and awards RP", async function () {
      await rankSystem.connect(recorder).recordWin(player.address, 100n);
      const stats = await rankSystem.getPlayerStats(player.address);
      expect(stats.totalRP).to.equal(100n);
      expect(stats.currentSeasonRP).to.equal(100n);
      expect(stats.wins).to.equal(1n);
    });

    it("reverts for unauthorised recorder", async function () {
      await expect(rankSystem.connect(player).recordWin(player.address, 100n))
        .to.be.revertedWithCustomError(rankSystem, "NotAuthorised");
    });
  });

  describe("rank tier transitions", function () {
    it("promotes to Silver at 500 RP", async function () {
      await rankSystem.connect(recorder).recordWin(player.address, 500n);
      const stats = await rankSystem.getPlayerStats(player.address);
      expect(stats.rank).to.equal(1n); // Rank.Silver = 1
    });

    it("promotes to Legend at 10000 RP", async function () {
      await rankSystem.connect(recorder).recordWin(player.address, 10000n);
      const stats = await rankSystem.getPlayerStats(player.address);
      expect(stats.rank).to.equal(5n); // Rank.Legend = 5
    });

    it("drops rank on RP loss", async function () {
      await rankSystem.connect(recorder).recordWin(player.address, 600n); // Silver
      await rankSystem.connect(recorder).recordLoss(player.address, 200n); // drops below 500
      const stats = await rankSystem.getPlayerStats(player.address);
      expect(stats.rank).to.equal(0n); // Back to Bronze
    });
  });

  describe("recordLoss", function () {
    it("decrements RP, floors at 0", async function () {
      await rankSystem.connect(recorder).recordWin(player.address, 30n);
      await rankSystem.connect(recorder).recordLoss(player.address, 50n);
      const stats = await rankSystem.getPlayerStats(player.address);
      expect(stats.currentSeasonRP).to.equal(0n);
    });

    it("increments loss count", async function () {
      await rankSystem.connect(recorder).recordLoss(player.address, 10n);
      const stats = await rankSystem.getPlayerStats(player.address);
      expect(stats.losses).to.equal(1n);
    });
  });

  describe("leaderboard", function () {
    it("adds player to leaderboard on first win", async function () {
      await rankSystem.connect(recorder).recordWin(player.address, 100n);
      const pos = await rankSystem.getLeaderboardPosition(player.address);
      expect(pos).to.equal(1n);
    });

    it("sorts by descending RP — higher earner goes to position 1", async function () {
      await rankSystem.connect(recorder).recordWin(player.address, 50n);
      await rankSystem.connect(recorder).recordWin(player2.address, 200n);
      expect(await rankSystem.getLeaderboardPosition(player2.address)).to.equal(1n);
      expect(await rankSystem.getLeaderboardPosition(player.address)).to.equal(2n);
    });
  });

  describe("resetSeasonRP", function () {
    it("resets currentSeasonRP to 0 and clears leaderboard", async function () {
      await rankSystem.connect(recorder).recordWin(player.address, 500n);
      await rankSystem.connect(recorder).resetSeasonRP(1n);

      const stats = await rankSystem.getPlayerStats(player.address);
      expect(stats.currentSeasonRP).to.equal(0n);
      // But career totalRP is preserved
      expect(stats.totalRP).to.equal(500n);
    });
  });
});
