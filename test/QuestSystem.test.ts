import { expect } from "chai";
import { ethers } from "hardhat";
import { QuestSystem } from "../typechain-types";

describe("QuestSystem", function () {
  let questSystem: QuestSystem;
  let owner: any, player: any, player2: any;

  const SEASON_ID = 1n;
  const DESCRIPTIONS: [string, string, string, string, string] = [
    "Win 10 battles", "Craft 3 cards", "Open 5 packs", "Reach Gold rank", "Play 20 battles"
  ];
  const TARGETS: [bigint, bigint, bigint, bigint, bigint] = [10n, 3n, 5n, 1n, 20n];

  beforeEach(async function () {
    [owner, player, player2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("QuestSystem");
    questSystem = (await Factory.deploy()) as QuestSystem;

    // Authorise owner as updater (already is via owner check)
    // Set up quests for season 1
    await questSystem.connect(owner).setSeasonQuests(SEASON_ID, DESCRIPTIONS, TARGETS);
    await questSystem.connect(owner).setCurrentSeasonId(SEASON_ID);
  });

  describe("progress tracking", function () {
    it("updates progress and emits event", async function () {
      await expect(questSystem.connect(owner).updateProgress(player.address, SEASON_ID, 0n, 5n))
        .to.emit(questSystem, "QuestProgressUpdated")
        .withArgs(player.address, SEASON_ID, 0n, 5n);
    });

    it("emits QuestCompleted when target is reached", async function () {
      await expect(questSystem.connect(owner).updateProgress(player.address, SEASON_ID, 0n, 10n))
        .to.emit(questSystem, "QuestCompleted")
        .withArgs(player.address, SEASON_ID, 0n);
    });

    it("allows incremental completion over multiple calls", async function () {
      await questSystem.connect(owner).updateProgress(player.address, SEASON_ID, 0n, 6n);
      await expect(questSystem.connect(owner).updateProgress(player.address, SEASON_ID, 0n, 5n))
        .to.emit(questSystem, "QuestCompleted");
    });

    it("does not update progress after completion (no-op)", async function () {
      await questSystem.connect(owner).updateProgress(player.address, SEASON_ID, 0n, 10n);
      // Second call should not emit anything (no-op after completion)
      const tx = await questSystem.connect(owner).updateProgress(player.address, SEASON_ID, 0n, 100n);
      const receipt = await tx.wait();
      const progressEvents = receipt?.logs.filter(
        (log: any) => log.fragment?.name === "QuestProgressUpdated"
      ) ?? [];
      expect(progressEvents.length).to.equal(0);
    });

    it("reverts for invalid questId", async function () {
      await expect(questSystem.connect(owner).updateProgress(player.address, SEASON_ID, 99n, 1n))
        .to.be.revertedWithCustomError(questSystem, "InvalidQuestId");
    });

    it("reverts for unauthorised updater", async function () {
      await expect(questSystem.connect(player).updateProgress(player.address, SEASON_ID, 0n, 1n))
        .to.be.revertedWithCustomError(questSystem, "NotAuthorised");
    });
  });

  describe("claimQuestReward", function () {
    beforeEach(async function () {
      // Complete quest 0 for player
      await questSystem.connect(owner).updateProgress(player.address, SEASON_ID, 0n, 10n);
    });

    it("allows claim for completed quest", async function () {
      await expect(questSystem.connect(player).claimQuestReward(SEASON_ID, 0n))
        .to.emit(questSystem, "QuestRewardClaimed")
        .withArgs(player.address, SEASON_ID, 0n);
    });

    it("reverts double claim", async function () {
      await questSystem.connect(player).claimQuestReward(SEASON_ID, 0n);
      await expect(questSystem.connect(player).claimQuestReward(SEASON_ID, 0n))
        .to.be.revertedWithCustomError(questSystem, "AlreadyClaimed");
    });

    it("reverts claim for incomplete quest", async function () {
      await expect(questSystem.connect(player).claimQuestReward(SEASON_ID, 1n))
        .to.be.revertedWithCustomError(questSystem, "QuestNotCompleted");
    });
  });

  describe("DAO card voting", function () {
    it("allows a player to vote once per season", async function () {
      await expect(questSystem.connect(player).voteOnCard(5n))
        .to.emit(questSystem, "CardVoted")
        .withArgs(player.address, SEASON_ID, 5n);
      expect(await questSystem.getCardVotes(SEASON_ID, 5n)).to.equal(1n);
    });

    it("reverts if player votes twice in same season", async function () {
      await questSystem.connect(player).voteOnCard(5n);
      await expect(questSystem.connect(player).voteOnCard(5n))
        .to.be.revertedWithCustomError(questSystem, "AlreadyVoted");
    });

    it("allows different players to vote for same card", async function () {
      await questSystem.connect(player).voteOnCard(5n);
      await questSystem.connect(player2).voteOnCard(5n);
      expect(await questSystem.getCardVotes(SEASON_ID, 5n)).to.equal(2n);
    });
  });
});
