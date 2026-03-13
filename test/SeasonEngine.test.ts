import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SeasonEngine, RankSystem } from "../typechain-types";

describe("SeasonEngine", function () {
  let seasonEngine: SeasonEngine;
  let rankSystem: RankSystem;
  let owner: any, other: any;

  const THIRTY_DAYS = 30 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();

    const RankFactory = await ethers.getContractFactory("RankSystem");
    rankSystem = (await RankFactory.deploy()) as RankSystem;

    const Factory = await ethers.getContractFactory("SeasonEngine");
    seasonEngine = (await Factory.deploy(
      ethers.ZeroAddress, // questSystem placeholder
      await rankSystem.getAddress()
    )) as SeasonEngine;

    // Authorise SeasonEngine to call resetSeasonRP
    await rankSystem.setAuthorisedRecorder(await seasonEngine.getAddress(), true);
  });

  describe("startSeason", function () {
    it("starts season 1 and emits SeasonStarted", async function () {
      await expect(seasonEngine.connect(owner).startSeason())
        .to.emit(seasonEngine, "SeasonStarted");
      expect(await seasonEngine.currentSeasonId()).to.equal(1n);
      expect(await seasonEngine.seasonActive()).to.be.true;
    });

    it("reverts if a season is already active", async function () {
      await seasonEngine.connect(owner).startSeason();
      await expect(seasonEngine.connect(owner).startSeason())
        .to.be.revertedWithCustomError(seasonEngine, "SeasonAlreadyActive");
    });

    it("sets correct end time (startTime + 30 days)", async function () {
      const tx = await seasonEngine.connect(owner).startSeason();
      const block = await ethers.provider.getBlock(tx.blockNumber!);
      const season = await seasonEngine.getCurrentSeason();
      expect(season.endTime).to.equal(BigInt(block!.timestamp) + BigInt(THIRTY_DAYS));
    });

    it("reverts for non-owner", async function () {
      await expect(seasonEngine.connect(other).startSeason())
        .to.be.reverted;
    });
  });

  describe("finalizeSeason", function () {
    beforeEach(async function () {
      await seasonEngine.connect(owner).startSeason();
    });

    it("reverts before 30 days are up", async function () {
      await expect(seasonEngine.connect(owner).finalizeSeason())
        .to.be.revertedWithCustomError(seasonEngine, "SeasonNotOver");
    });

    it("finalizes after 30 days and emits SeasonFinalized", async function () {
      await time.increase(THIRTY_DAYS + 1);
      await expect(seasonEngine.connect(owner).finalizeSeason())
        .to.emit(seasonEngine, "SeasonFinalized");
      expect(await seasonEngine.seasonActive()).to.be.false;
    });

    it("archives the season with a non-zero hash", async function () {
      await time.increase(THIRTY_DAYS + 1);
      await seasonEngine.connect(owner).finalizeSeason();
      const season = await seasonEngine.getSeasonById(1n);
      expect(season.finalized).to.be.true;
      expect(season.archiveHash).to.not.equal(ethers.ZeroHash);
    });

    it("allows a new season after finalization", async function () {
      await time.increase(THIRTY_DAYS + 1);
      await seasonEngine.connect(owner).finalizeSeason();
      await expect(seasonEngine.connect(owner).startSeason())
        .to.emit(seasonEngine, "SeasonStarted");
      expect(await seasonEngine.currentSeasonId()).to.equal(2n);
    });

    it("reverts double finalization", async function () {
      await time.increase(THIRTY_DAYS + 1);
      await seasonEngine.connect(owner).finalizeSeason();
      await expect(seasonEngine.connect(owner).finalizeSeason())
        .to.be.revertedWithCustomError(seasonEngine, "NoActiveSeason");
    });
  });
});
