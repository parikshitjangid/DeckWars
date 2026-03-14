import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * deploy/02_game.ts
 * -----------------
 * Deploys all Dev 2 contracts and links them together.
 * Reads Dev 1's deployedAddresses.json for CardNFT, TreasuryVault, HLUSD addresses.
 * Appends new addresses back to deployedAddresses.json for Dev 3 (frontend).
 */

const ADDRESSES_FILE = path.join(__dirname, "../deployedAddresses.json");

function readAddresses(): Record<string, string> {
  if (fs.existsSync(ADDRESSES_FILE)) {
    return JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8"));
  }
  return {};
}

function writeAddresses(addresses: Record<string, string>) {
  fs.writeFileSync(ADDRESSES_FILE, JSON.stringify(addresses, null, 2));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🚀 DeckWars — Dev 2 Deploy (Game Logic)");
  console.log(`   Deployer : ${deployer.address}`);
  console.log(`   Network  : ${(await ethers.provider.getNetwork()).name}\n`);

  // ── Read Dev 1 addresses (placeholders if not yet deployed) ───────────────
  const existing = readAddresses();

  const CARD_NFT_ADDRESS    = existing.CardNFT        || ethers.ZeroAddress;
  const TREASURY_ADDRESS    = existing.TreasuryVault   || ethers.ZeroAddress;
  const HLUSD_ADDRESS       = process.env.HLUSD_ADDRESS || existing.HLUSDToken || ethers.ZeroAddress;

  console.log(`   CardNFT       : ${CARD_NFT_ADDRESS}`);
  console.log(`   TreasuryVault : ${TREASURY_ADDRESS}`);
  console.log(`   HLUSD         : ${HLUSD_ADDRESS}\n`);

  // ── 1. RankSystem ─────────────────────────────────────────────────────────
  console.log("1️⃣  Deploying RankSystem...");
  const RankSystem = await ethers.getContractFactory("RankSystem");
  const rankSystem = await RankSystem.deploy();
  await rankSystem.waitForDeployment();
  const rankSystemAddress = await rankSystem.getAddress();
  console.log(`   ✅ RankSystem: ${rankSystemAddress}`);

  // ── 2. SeasonEngine ───────────────────────────────────────────────────────
  console.log("2️⃣  Deploying SeasonEngine...");
  const SeasonEngine = await ethers.getContractFactory("SeasonEngine");
  const seasonEngine = await SeasonEngine.deploy(
    ethers.ZeroAddress, // questSystem wired after
    rankSystemAddress
  );
  await seasonEngine.waitForDeployment();
  const seasonEngineAddress = await seasonEngine.getAddress();
  console.log(`   ✅ SeasonEngine: ${seasonEngineAddress}`);

  // ── 3. QuestSystem ────────────────────────────────────────────────────────
  console.log("3️⃣  Deploying QuestSystem...");
  const QuestSystem = await ethers.getContractFactory("QuestSystem");
  const questSystem = await QuestSystem.deploy();
  await questSystem.waitForDeployment();
  const questSystemAddress = await questSystem.getAddress();
  console.log(`   ✅ QuestSystem: ${questSystemAddress}`);

  // ── 4. SeasonRewards ──────────────────────────────────────────────────────
  console.log("4️⃣  Deploying SeasonRewards...");
  const SeasonRewards = await ethers.getContractFactory("SeasonRewards");
  const seasonRewards = await SeasonRewards.deploy(
    HLUSD_ADDRESS,
    CARD_NFT_ADDRESS,
    TREASURY_ADDRESS,
    rankSystemAddress
  );
  await seasonRewards.waitForDeployment();
  const seasonRewardsAddress = await seasonRewards.getAddress();
  console.log(`   ✅ SeasonRewards: ${seasonRewardsAddress}`);

  // ── 5. DeckManager ────────────────────────────────────────────────────────
  console.log("5️⃣  Deploying DeckManager...");
  const DeckManager = await ethers.getContractFactory("DeckManager");
  const deckManager = await DeckManager.deploy(CARD_NFT_ADDRESS);
  await deckManager.waitForDeployment();
  const deckManagerAddress = await deckManager.getAddress();
  console.log(`   ✅ DeckManager: ${deckManagerAddress}`);

  // ── 6. AIBattleAgent ──────────────────────────────────────────────────────
  console.log("6️⃣  Deploying AIBattleAgent...");
  const AIBattleAgent = await ethers.getContractFactory("AIBattleAgent");
  const aiBattleAgent = await AIBattleAgent.deploy(HLUSD_ADDRESS, rankSystemAddress);
  await aiBattleAgent.waitForDeployment();
  const aiBattleAgentAddress = await aiBattleAgent.getAddress();
  console.log(`   ✅ AIBattleAgent: ${aiBattleAgentAddress}`);

  // ── 7. BattleEngine ───────────────────────────────────────────────────────
  console.log("7️⃣  Deploying BattleEngine...");
  const BattleEngine = await ethers.getContractFactory("BattleEngine");
  const battleEngine = await BattleEngine.deploy(
    CARD_NFT_ADDRESS,
    deckManagerAddress,
    questSystemAddress,
    rankSystemAddress,
    HLUSD_ADDRESS       // ← new: for HLUSD wager escrow
  );
  await battleEngine.waitForDeployment();
  const battleEngineAddress = await battleEngine.getAddress();
  console.log(`   ✅ BattleEngine: ${battleEngineAddress}`);

  // ── Wire contracts together ───────────────────────────────────────────────
  console.log("\n🔗 Wiring contracts...");

  // SeasonEngine ← QuestSystem
  let tx = await seasonEngine.setQuestSystem(questSystemAddress);
  await tx.wait();
  console.log("   SeasonEngine.setQuestSystem ✅");

  // QuestSystem → authorise SeasonEngine as updater
  tx = await questSystem.setAuthorisedUpdater(seasonEngineAddress, true);
  await tx.wait();
  console.log("   QuestSystem.setAuthorisedUpdater(SeasonEngine) ✅");

  // QuestSystem → authorise BattleEngine as updater (for notifyBattleWin)
  tx = await questSystem.setAuthorisedUpdater(battleEngineAddress, true);
  await tx.wait();
  console.log("   QuestSystem.setAuthorisedUpdater(BattleEngine) ✅");

  // QuestSystem → SeasonRewards for reward notification
  tx = await questSystem.setSeasonRewards(seasonRewardsAddress);
  await tx.wait();
  console.log("   QuestSystem.setSeasonRewards ✅");

  // SeasonRewards → questSystem address
  tx = await seasonRewards.setQuestSystem(questSystemAddress);
  await tx.wait();
  console.log("   SeasonRewards.setQuestSystem ✅");

  // SeasonRewards → seasonEngine address
  tx = await seasonRewards.setSeasonEngine(seasonEngineAddress);
  await tx.wait();
  console.log("   SeasonRewards.setSeasonEngine ✅");

  // RankSystem → authorise AIBattleAgent as recorder
  tx = await rankSystem.setAuthorisedRecorder(aiBattleAgentAddress, true);
  await tx.wait();
  console.log("   RankSystem.setAuthorisedRecorder(AIBattleAgent) ✅");

  // RankSystem → authorise BattleEngine as recorder
  tx = await rankSystem.setAuthorisedRecorder(battleEngineAddress, true);
  await tx.wait();
  console.log("   RankSystem.setAuthorisedRecorder(BattleEngine) ✅");

  // RankSystem → authorise SeasonEngine as recorder (for resetSeasonRP)
  tx = await rankSystem.setAuthorisedRecorder(seasonEngineAddress, true);
  await tx.wait();
  console.log("   RankSystem.setAuthorisedRecorder(SeasonEngine) ✅");

  // DeckManager → authorise BattleEngine as deck locker
  tx = await deckManager.setAuthorisedLocker(battleEngineAddress, true);
  await tx.wait();
  console.log("   DeckManager.setAuthorisedLocker(BattleEngine) ✅");

  // ── Save addresses ────────────────────────────────────────────────────────
  const newAddresses: Record<string, string> = {
    ...existing,
    RankSystem:    rankSystemAddress,
    SeasonEngine:  seasonEngineAddress,
    QuestSystem:   questSystemAddress,
    SeasonRewards: seasonRewardsAddress,
    DeckManager:   deckManagerAddress,
    AIBattleAgent: aiBattleAgentAddress,
    BattleEngine:  battleEngineAddress,
  };

  writeAddresses(newAddresses);
  console.log(`\n💾 Addresses saved to deployedAddresses.json`);

  // ── Export ABIs to frontend ───────────────────────────────────────────────
  const abiDir = path.join(__dirname, "../frontend/src/abis");
  if (!fs.existsSync(abiDir)) fs.mkdirSync(abiDir, { recursive: true });

  const contracts = [
    "RankSystem", "SeasonEngine", "QuestSystem",
    "SeasonRewards", "DeckManager", "AIBattleAgent", "BattleEngine"
  ];

  for (const name of contracts) {
    const artifactPath = path.join(
      __dirname,
      `../artifacts/contracts/${name}.sol/${name}.json`
    );
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      fs.writeFileSync(
        path.join(abiDir, `${name}.json`),
        JSON.stringify(artifact.abi, null, 2)
      );
      console.log(`   📄 ABI exported: ${name}.json`);
    }
  }

  console.log("\n🎉 Dev 2 deployment complete!\n");
  console.log("─────────────────────────────────────────────");
  console.log("Contract         Address");
  console.log("─────────────────────────────────────────────");
  Object.entries(newAddresses).forEach(([name, addr]) => {
    console.log(`${name.padEnd(16)} ${addr}`);
  });
  console.log("─────────────────────────────────────────────\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
