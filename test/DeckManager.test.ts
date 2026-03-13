import { expect } from "chai";
import { ethers } from "hardhat";
import { DeckManager } from "../typechain-types";

describe("DeckManager", function () {
  let deckManager: DeckManager;
  let owner: any, player: any, locker: any;

  const ZERO_ADDRESS = ethers.ZeroAddress;

  function makeDeckIds(base = 1): [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] {
    return Array.from({ length: 20 }, (_, i) => BigInt(base + i)) as any;
  }

  beforeEach(async function () {
    [owner, player, locker] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DeckManager");
    // Pass address(0) for CardNFT — skips ownership check in tests
    deckManager = (await Factory.deploy(ZERO_ADDRESS)) as DeckManager;
  });

  describe("registerDeck", function () {
    it("registers a valid 20-card deck and emits DeckRegistered", async function () {
      const cardIds = makeDeckIds(1);
      await expect(deckManager.connect(player).registerDeck(cardIds))
        .to.emit(deckManager, "DeckRegistered")
        .withArgs(player.address, 1n, cardIds);
    });

    it("assigns deckOwner correctly", async function () {
      await deckManager.connect(player).registerDeck(makeDeckIds(1));
      expect(await deckManager.deckOwner(1n)).to.equal(player.address);
    });

    it("increments deck count for player", async function () {
      await deckManager.connect(player).registerDeck(makeDeckIds(1));
      await deckManager.connect(player).registerDeck(makeDeckIds(21));
      expect(await deckManager.getDeckCount(player.address)).to.equal(2n);
    });
  });

  describe("lock / unlock", function () {
    beforeEach(async function () {
      await deckManager.connect(player).registerDeck(makeDeckIds(1));
      // Authorise locker
      await deckManager.connect(owner).setAuthorisedLocker(locker.address, true);
    });

    it("authorised locker can lock a deck", async function () {
      await expect(deckManager.connect(locker).lockDeck(player.address, 1n))
        .to.emit(deckManager, "DeckLocked")
        .withArgs(player.address, 1n);
      expect(await deckManager.isDeckLocked(player.address, 1n)).to.be.true;
    });

    it("cannot lock an already-locked deck", async function () {
      await deckManager.connect(locker).lockDeck(player.address, 1n);
      await expect(deckManager.connect(locker).lockDeck(player.address, 1n))
        .to.be.revertedWithCustomError(deckManager, "DeckAlreadyLocked");
    });

    it("authorised locker can unlock a deck", async function () {
      await deckManager.connect(locker).lockDeck(player.address, 1n);
      await expect(deckManager.connect(locker).unlockDeck(player.address, 1n))
        .to.emit(deckManager, "DeckUnlocked");
      expect(await deckManager.isDeckLocked(player.address, 1n)).to.be.false;
    });

    it("cannot unlock a deck that isn't locked", async function () {
      await expect(deckManager.connect(locker).unlockDeck(player.address, 1n))
        .to.be.revertedWithCustomError(deckManager, "DeckNotLocked");
    });

    it("unauthorised address cannot lock", async function () {
      await expect(deckManager.connect(player).lockDeck(player.address, 1n))
        .to.be.revertedWithCustomError(deckManager, "NotAuthorised");
    });
  });
});
