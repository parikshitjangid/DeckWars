import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * deploy/01_economy.ts
 * Dev 1 — Deploys and wires all 5 Core Economy contracts:
 *   CardNFT → TreasuryVault → CraftingSystem → PremiumPacks → SeasonPass
 *
 * Run: npx hardhat run deploy/01_economy.ts --network hela_testnet
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying DeckWars Core Economy with:", deployer.address);

    // ── Config from env ──────────────────────────────────────────────────────
    const HLUSD_ADDRESS = process.env.HLUSD_ADDRESS || "";
    const DEV_WALLET = process.env.DEV_WALLET || deployer.address;
    const PRIZE_POOL = process.env.PRIZE_POOL_WALLET || deployer.address;
    const METADATA_URI = "https://api.deckwars.io/metadata/{id}.json";

    if (!HLUSD_ADDRESS) {
        throw new Error("HLUSD_ADDRESS not set in .env");
    }

    // ── 1. Deploy CardNFT ────────────────────────────────────────────────────
    console.log("\n[1/5] Deploying CardNFT...");
    const CardNFTFactory = await ethers.getContractFactory("CardNFT");
    const cardNFT = await CardNFTFactory.deploy(METADATA_URI);
    await cardNFT.waitForDeployment();
    const cardNFTAddr = await cardNFT.getAddress();
    console.log("✅  CardNFT deployed:", cardNFTAddr);

    // ── 2. Deploy TreasuryVault ──────────────────────────────────────────────
    console.log("\n[2/5] Deploying TreasuryVault...");
    const TreasuryFactory = await ethers.getContractFactory("TreasuryVault");
    const treasury = await TreasuryFactory.deploy(HLUSD_ADDRESS, DEV_WALLET, PRIZE_POOL);
    await treasury.waitForDeployment();
    const treasuryAddr = await treasury.getAddress();
    console.log("✅  TreasuryVault deployed:", treasuryAddr);

    // ── 3. Deploy CraftingSystem ─────────────────────────────────────────────
    console.log("\n[3/5] Deploying CraftingSystem...");
    const CraftingFactory = await ethers.getContractFactory("CraftingSystem");
    const crafting = await CraftingFactory.deploy(cardNFTAddr);
    await crafting.waitForDeployment();
    const craftingAddr = await crafting.getAddress();
    console.log("✅  CraftingSystem deployed:", craftingAddr);

    // ── 4. Deploy PremiumPacks ───────────────────────────────────────────────
    console.log("\n[4/5] Deploying PremiumPacks...");
    const PacksFactory = await ethers.getContractFactory("PremiumPacks");
    const packs = await PacksFactory.deploy(cardNFTAddr, treasuryAddr, HLUSD_ADDRESS);
    await packs.waitForDeployment();
    const packsAddr = await packs.getAddress();
    console.log("✅  PremiumPacks deployed:", packsAddr);

    // ── 5. Deploy SeasonPass ─────────────────────────────────────────────────
    console.log("\n[5/5] Deploying SeasonPass...");
    const PassFactory = await ethers.getContractFactory("SeasonPass");
    const seasonPass = await PassFactory.deploy(treasuryAddr, HLUSD_ADDRESS);
    await seasonPass.waitForDeployment();
    const seasonPassAddr = await seasonPass.getAddress();
    console.log("✅  SeasonPass deployed:", seasonPassAddr);

    // ── Wire up permissions ───────────────────────────────────────────────────
    console.log("\n🔗 Wiring permissions...");

    // CardNFT: grant minter roles to CraftingSystem and PremiumPacks
    await (await cardNFT.addMinter(craftingAddr)).wait();
    console.log("   CardNFT → minter: CraftingSystem");
    await (await cardNFT.addMinter(packsAddr)).wait();
    console.log("   CardNFT → minter: PremiumPacks");

    // SeasonPass needs minter role for milestone card rewards
    await (await cardNFT.addMinter(seasonPassAddr)).wait();
    console.log("   CardNFT → minter: SeasonPass");

    // TreasuryVault: authorize PremiumPacks and SeasonPass as revenue sources
    await (await treasury.authorizeSource(packsAddr)).wait();
    console.log("   TreasuryVault → authorized: PremiumPacks");
    await (await treasury.authorizeSource(seasonPassAddr)).wait();
    console.log("   TreasuryVault → authorized: SeasonPass");

    // SeasonPass: link CardNFT for milestone minting
    await (await seasonPass.setCardNFT(cardNFTAddr)).wait();
    console.log("   SeasonPass → cardNFT linked");

    // ── Example card setup (20 card types) ───────────────────────────────────
    console.log("\n🃏 Initializing 20 card types...");
    // Element enum: 0=Fire, 1=Water, 2=Earth
    // Rarity enum: 0=Common, 1=Rare, 2=Epic, 3=Legendary
    const cardConfigs = [
        // [tokenId, attack, defense, element, rarity]
        [1, 3, 2, 0, 0], [2, 2, 4, 1, 0], [3, 4, 1, 2, 0], [4, 3, 3, 0, 0],
        [5, 2, 3, 1, 0], // 5 Commons (ATK 1-4, DEF 1-4)
        [6, 5, 4, 2, 1], [7, 6, 5, 0, 1], [8, 4, 7, 1, 1], [9, 5, 6, 2, 1],
        [10, 6, 4, 0, 1], // 5 Rares (ATK 5-8, DEF 4-7)
        [11, 7, 6, 1, 2], [12, 8, 7, 2, 2], [13, 9, 6, 0, 2], [14, 7, 8, 1, 2],
        [15, 8, 7, 2, 2], // 5 Epics (ATK 7-9, DEF 6-8)
        [16, 9, 8, 0, 3], [17, 10, 9, 1, 3], [18, 9, 10, 2, 3],
        [19, 10, 8, 0, 3], [20, 10, 10, 1, 3], // 5 Legendaries (ATK 9-10, DEF 8-10)
    ];

    // Supply caps per rarity: Common=unlimited(0), Rare=5000, Epic=2000, Legendary=500
    const supplyCaps: Record<number, number> = { 0: 0, 1: 5000, 2: 2000, 3: 500 };
    for (const [id, atk, def, element, rarity] of cardConfigs) {
        await (await cardNFT.setCardStats(id, atk, def, element, rarity)).wait();
        const cap = supplyCaps[rarity] || 0;
        if (cap > 0) await (await cardNFT.setSupplyCap(id, cap)).wait();
    }
    console.log("✅  All 20 card types initialized with stats, elements, and supply caps");

    // ── Register rarity pools in CraftingSystem ───────────────────────────────
    console.log("\n🔨 Registering rarity pools in CraftingSystem...");
    for (let id = 1; id <= 5; id++)  await (await crafting.addRarityToken(0, id)).wait(); // Common
    for (let id = 6; id <= 10; id++) await (await crafting.addRarityToken(1, id)).wait(); // Rare
    for (let id = 11; id <= 15; id++) await (await crafting.addRarityToken(2, id)).wait(); // Epic
    for (let id = 16; id <= 20; id++) await (await crafting.addRarityToken(3, id)).wait(); // Legendary
    console.log("✅  Rarity pools registered");

    // ── Register drop pools in PremiumPacks ──────────────────────────────────
    console.log("\n📦 Configuring pack drop pools...");
    const silverPool = [1, 2, 3, 4, 5, 6, 7];           // Commons + some Rares
    const goldPool = [4, 5, 6, 7, 8, 9, 10, 11, 12];   // Rares + some Epics
    const diamondPool = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]; // Epics + Legendaries
    await (await packs.setTierTokenIds(0, silverPool)).wait();
    await (await packs.setTierTokenIds(1, goldPool)).wait();
    await (await packs.setTierTokenIds(2, diamondPool)).wait();
    console.log("✅  Pack pools configured");

    // ── Example milestone setup in SeasonPass ────────────────────────────────
    console.log("\n🏆 Configuring SeasonPass milestones...");
    await (await seasonPass.setMilestone(10, 6)).wait();  // Level 10 → Rare card #6
    await (await seasonPass.setMilestone(25, 11)).wait(); // Level 25 → Epic card #11
    await (await seasonPass.setMilestone(50, 16)).wait(); // Level 50 → Legendary card #16
    await (await seasonPass.setMilestone(75, 17)).wait(); // Level 75 → Legendary card #17
    await (await seasonPass.setMilestone(100, 20)).wait();// Level 100 → Legendary card #20
    console.log("✅  Milestones configured");

    // ── Save deployed addresses ───────────────────────────────────────────────
    const addresses = {
        CardNFT: cardNFTAddr,
        CraftingSystem: craftingAddr,
        TreasuryVault: treasuryAddr,
        PremiumPacks: packsAddr,
        SeasonPass: seasonPassAddr,
    };

    // Merge with existing addresses (from Dev 2 if they deploy first)
    let existing: Record<string, string> = {};
    const addrFile = path.join(__dirname, "../deployedAddresses.json");
    if (fs.existsSync(addrFile)) {
        existing = JSON.parse(fs.readFileSync(addrFile, "utf-8"));
    }
    const merged = { ...existing, ...addresses };
    fs.writeFileSync(addrFile, JSON.stringify(merged, null, 2));

    console.log("\n✅ deployedAddresses.json written:");
    console.log(JSON.stringify(merged, null, 2));
    console.log("\n🎉 Dev 1 deployment complete!");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
