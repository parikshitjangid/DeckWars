import { ethers, artifacts } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * scripts/export-abis.ts
 * Copies compiled ABIs for Dev 1's contracts to frontend/src/abis/
 *
 * Run: npx hardhat run scripts/export-abis.ts
 */

const CONTRACTS = [
    "CardNFT",
    "CraftingSystem",
    "TreasuryVault",
    "PremiumPacks",
    "SeasonPass",
];

async function main() {
    const outDir = path.join(__dirname, "../frontend/src/abis");
    fs.mkdirSync(outDir, { recursive: true });

    for (const name of CONTRACTS) {
        const artifact = await artifacts.readArtifact(name);
        const outPath = path.join(outDir, `${name}.json`);
        fs.writeFileSync(outPath, JSON.stringify(artifact.abi, null, 2));
        console.log(`✅ Exported ${name}.json → frontend/src/abis/`);
    }

    console.log("\n🎉 All ABIs exported. Dev 3 can now import them in their hooks.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
