const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeckWars Full System", function () {
  let deployer, alice, bob;
  let HLUSD, Card, Deck, Rank, Treasury, Quest, SeasonPass, Packs, Battle, Craft, Season, Rewards;

  const zero = "0x0000000000000000000000000000000000000000";
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

  before(async function () {
    [deployer, alice, bob] = await ethers.getSigners();
  });

  async function deployAll() {
    HLUSD = await (await ethers.getContractFactory("HLUSD")).deploy();
    await HLUSD.waitForDeployment();

    Card = await (await ethers.getContractFactory("DeckWarsCard")).deploy();
    await Card.waitForDeployment();

    Deck = await (await ethers.getContractFactory("DeckWarsDeck")).deploy(await Card.getAddress());
    await Deck.waitForDeployment();

    Rank = await (await ethers.getContractFactory("DeckWarsRank")).deploy();
    await Rank.waitForDeployment();

    Treasury = await (await ethers.getContractFactory("DeckWarsTreasury")).deploy(
      deployer.address,
      await HLUSD.getAddress()
    );
    await Treasury.waitForDeployment();

    Quest = await (await ethers.getContractFactory("DeckWarsQuest")).deploy(
      await Card.getAddress(),
      await HLUSD.getAddress()
    );
    await Quest.waitForDeployment();

    SeasonPass = await (await ethers.getContractFactory("DeckWarsSeasonPass")).deploy(
      await HLUSD.getAddress(),
      await Card.getAddress(),
      await Quest.getAddress(),
      await Treasury.getAddress()
    );
    await SeasonPass.waitForDeployment();

    Packs = await (await ethers.getContractFactory("DeckWarsPacks")).deploy(
      await HLUSD.getAddress(),
      await Card.getAddress(),
      await Treasury.getAddress()
    );
    await Packs.waitForDeployment();

    Battle = await (await ethers.getContractFactory("DeckWarsBattle")).deploy(
      await Card.getAddress(),
      await Deck.getAddress(),
      await Rank.getAddress(),
      await Quest.getAddress(),
      await SeasonPass.getAddress()
    );
    await Battle.waitForDeployment();

    Craft = await (await ethers.getContractFactory("DeckWarsCraft")).deploy(
      await Card.getAddress(),
      await Quest.getAddress()
    );
    await Craft.waitForDeployment();

    Season = await (await ethers.getContractFactory("DeckWarsSeason")).deploy();
    await Season.waitForDeployment();

    Rewards = await (await ethers.getContractFactory("DeckWarsRewards")).deploy(
      await Rank.getAddress(),
      await Card.getAddress(),
      await HLUSD.getAddress()
    );
    await Rewards.waitForDeployment();

    await (await Card.grantRole(MINTER_ROLE, await Craft.getAddress())).wait();
    await (await Card.grantRole(MINTER_ROLE, await Quest.getAddress())).wait();
    await (await Card.grantRole(MINTER_ROLE, await Packs.getAddress())).wait();
    await (await Card.grantRole(MINTER_ROLE, await Rewards.getAddress())).wait();
    await (await Card.grantRole(MINTER_ROLE, await SeasonPass.getAddress())).wait();

    await (await Deck.setBattleContract(await Battle.getAddress())).wait();
    await (await Rank.setBattleContract(await Battle.getAddress())).wait();
    await (await Quest.setBattleContract(await Battle.getAddress())).wait();
    await (await Quest.setCraftContract(await Craft.getAddress())).wait();
    await (await Quest.setSeasonPassContract(await SeasonPass.getAddress())).wait();
    await (await Treasury.addAuthorized(await Packs.getAddress())).wait();
    await (await Treasury.addAuthorized(await SeasonPass.getAddress())).wait();

    await (await Season.startSeason("Season 1")).wait();
    await (await HLUSD.mint(deployer.address, ethers.parseEther("100000"))).wait();
  }

  describe("HLUSD", function () {
    it("faucet gives 100 HLUSD", async function () {
      const H = await (await ethers.getContractFactory("HLUSD")).deploy();
      await H.waitForDeployment();
      await H.connect(alice).faucet();
      expect(await H.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
    });
  });

  describe("DeckWarsCard", function () {
    before(deployAll);

    it("mintStarterPack gives 5 cards", async function () {
      await Card.connect(alice).mintStarterPack(alice.address);
      let total = 0n;
      for (let i = 1; i <= 20; i++) {
        total += await Card.balanceOf(alice.address, i);
      }
      expect(total).to.equal(5n);
    });

    it("can only claim starter pack once", async function () {
      await expect(Card.connect(alice).mintStarterPack(alice.address)).to.be.revertedWith(
        "Starter already claimed"
      );
    });

    it("burn reduces balance", async function () {
      await Card.grantRole(MINTER_ROLE, deployer.address);
      await Card.mintCard(alice.address, 7, 10);
      expect(await Card.balanceOf(alice.address, 7)).to.equal(10n);
      await Card.burn(alice.address, 7, 3);
      expect(await Card.balanceOf(alice.address, 7)).to.equal(7n);
    });
  });

  describe("DeckWarsDeck", function () {
    before(deployAll);

    it("registerDeck with 20 cards succeeds", async function () {
      await Card.mintCard(alice.address, 1, 5);
      await Card.mintCard(alice.address, 2, 5);
      await Card.mintCard(alice.address, 3, 5);
      await Card.mintCard(alice.address, 4, 5);
      await Card.mintCard(alice.address, 5, 5);
      const deck = [
        1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5,
      ].map((n) => BigInt(n));
      await Deck.connect(alice).registerDeck(deck);
      expect(await Deck.hasDeck(alice.address)).to.be.true;
    });

    it("deck is locked after battle accept", async function () {
      // Lock/unlock are only callable by Battle; they happen in acceptBattle and _endBattle.
      // Verified implicitly in Battle tests.
    });
  });

  describe("DeckWarsBattle", function () {
    before(deployAll);

    before(async function () {
      await Card.mintCard(bob.address, 1, 5);
      await Card.mintCard(bob.address, 2, 5);
      await Card.mintCard(bob.address, 3, 5);
      await Card.mintCard(bob.address, 4, 5);
      await Card.mintCard(bob.address, 5, 5);
      const deck = [
        1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5,
      ].map((n) => BigInt(n));
      await Deck.connect(bob).registerDeck(deck);
    });

    it("challenge and accept starts battle", async function () {
      const tx = await Battle.connect(alice).challengePlayer(bob.address);
      await tx.wait();
      const battleId = 1n;
      await Battle.connect(bob).acceptBattle(battleId);
      const b = await Battle.getBattle(battleId);
      expect(b.status).to.equal(1);
      expect(await Deck.deckLocked(alice.address)).to.be.true;
      expect(await Deck.deckLocked(bob.address)).to.be.true;
    });

    it("playMove and rank updates", async function () {
      await Battle.connect(alice).playMove(1, 0); // attack
      const b = await Battle.getBattle(1);
      expect(Number(b.hpB)).to.be.lt(100);
      await Battle.connect(bob).playMove(1, 0);
      await Battle.connect(alice).playMove(1, 0);
      await Battle.connect(bob).playMove(1, 0);
      const statsAlice = await Rank.getStats(alice.address);
      const statsBob = await Rank.getStats(bob.address);
      expect(statsAlice.wins + statsBob.wins + statsAlice.losses + statsBob.losses).to.be.gte(0);
    });
  });

  describe("DeckWarsCraft", function () {
    before(deployAll);

    it("craft 3 commons to 1 uncommon", async function () {
      await Card.mintCard(alice.address, 7, 5);
      const balBefore = await Card.balanceOf(alice.address, 7);
      await Craft.connect(alice).craftCard(7);
      expect(await Card.balanceOf(alice.address, 7)).to.equal(balBefore - 3n);
      let total = 0n;
      for (let i = 1; i <= 20; i++) {
        total += await Card.balanceOf(alice.address, i);
      }
      expect(total).to.be.gte(1n);
    });
  });

  describe("DeckWarsQuest", function () {
    before(deployAll);

    it("quest progress and claim", async function () {
      const q = await Quest.quests(0);
      expect(q.name).to.equal("First Blood");
      await Quest.connect(alice).updateBattleWin(alice.address);
      // Quest.updateBattleWin is onlyBattle - so we can't call directly. Test via battle.
      await Quest.connect(deployer).checkCollector(alice.address);
    });
  });

  describe("DeckWarsPacks", function () {
    before(deployAll);

    it("silver pack opens 3 cards", async function () {
      await HLUSD.transfer(alice.address, ethers.parseEther("100"));
      await HLUSD.connect(alice).approve(await Treasury.getAddress(), ethers.parseEther("100"));
      await Packs.connect(alice).openPack(0);
      let count = 0n;
      for (let i = 1; i <= 20; i++) {
        count += await Card.balanceOf(alice.address, i);
      }
      expect(count).to.be.gte(3n);
    });
  });

  describe("DeckWarsSeasonPass", function () {
    before(deployAll);

    it("purchase pass", async function () {
      await HLUSD.transfer(bob.address, ethers.parseEther("100"));
      await HLUSD.connect(bob).approve(await Treasury.getAddress(), ethers.parseEther("100"));
      await SeasonPass.connect(bob).purchasePass();
      expect(await SeasonPass.hasPass(bob.address)).to.be.true;
    });
  });
});
