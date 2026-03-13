import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SeasonRewards, RankSystem } from "../typechain-types";

describe("SeasonRewards", function () {
  let seasonRewards: SeasonRewards;
  let rankSystem: RankSystem;
  let owner: any, player: any, other: any;

  const SEASON_ID = 1n;
  const NINETY_DAYS = 90 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, player, other] = await ethers.getSigners();

    const RankFactory = await ethers.getContractFactory("RankSystem");
    rankSystem = (await RankFactory.deploy()) as RankSystem;

    // Give player Diamond rank (75 HLUSD reward)
    await rankSystem.setAuthorisedRecorder(owner.address, true);
    await rankSystem.recordWin(player.address, 6000n); // Diamond = 5001+

    const Factory = await ethers.getContractFactory("SeasonRewards");
    seasonRewards = (await Factory.deploy(
      ethers.ZeroAddress, // HLUSD — ZeroAddress, so direct transfer path used in tests
      ethers.ZeroAddress, // CardNFT placeholder
      ethers.ZeroAddress, // TreasuryVault placeholder
      await rankSystem.getAddress()
    )) as SeasonRewards;

    // Register season (simulates SeasonEngine calling registerSeason)
    await seasonRewards.setSeasonEngine(owner.address);
    await seasonRewards.registerSeason(SEASON_ID);
  });

  describe("claimRankReward", function () {
    it("reverts if season is not registered", async function () {
      await expect(seasonRewards.connect(player).claimRankReward(99n))
        .to.be.revertedWithCustomError(seasonRewards, "SeasonNotRegistered");
    });

    it("reverts if claim window has expired", async function () {
      await time.increase(NINETY_DAYS + 1);
      await expect(seasonRewards.connect(player).claimRankReward(SEASON_ID))
        .to.be.revertedWithCustomError(seasonRewards, "ClaimWindowExpired");
    });

    it("reverts if player rank is Bronze (no reward)", async function () {
      await expect(seasonRewards.connect(other).claimRankReward(SEASON_ID))
        .to.be.revertedWithCustomError(seasonRewards, "NotEligible");
    });
  });

  describe("claimMilestone", function () {
    it("reverts for out-of-range milestone index", async function () {
      await expect(seasonRewards.connect(player).claimMilestone(SEASON_ID, 99n))
        .to.be.revertedWithCustomError(seasonRewards, "NotEligible");
    });

    it("reverts if player does not meet milestone requirements", async function () {
      // player has 6000 totalRP but 1 win — milestone 2 needs 40 wins
      await expect(seasonRewards.connect(player).claimMilestone(SEASON_ID, 2n))
        .to.be.revertedWithCustomError(seasonRewards, "NotEligible");
    });
  });

  describe("getClaimDeadline", function () {
    it("returns finalizedAt + 90 days for registered season", async function () {
      const deadline = await seasonRewards.getClaimDeadline(SEASON_ID);
      const NINETY_DAYS_BN = BigInt(NINETY_DAYS);
      // Should be approximately now + 90 days
      const approxExpected = BigInt(await time.latest()) + NINETY_DAYS_BN;
      expect(deadline).to.be.closeTo(approxExpected, 60n); // 60s tolerance
    });

    it("returns 0 for unknown season", async function () {
      expect(await seasonRewards.getClaimDeadline(999n)).to.equal(0n);
    });
  });
});
