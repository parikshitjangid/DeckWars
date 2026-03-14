import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * deploy/deploy_hlusd.ts
 * Deploys a Mock HLUSD token and updates all dependencies.
 */

const GAS = { gasLimit: 8_000_000 };

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🚀 Deploying Mock HLUSD with:", deployer.address);

    const Factory = await ethers.getContractFactory("ERC20Mock");
    const hlusd = await Factory.deploy("Mock HLUSD", "HLUSD", GAS);
    await hlusd.waitForDeployment();
    const hlusdAddr = await hlusd.getAddress();
    console.log("✅ Mock HLUSD deployed at:", hlusdAddr);

    // Update deployedAddresses.json
    const ADDR_FILE = path.join(__dirname, "../deployedAddresses.json");
    const existing = JSON.parse(fs.readFileSync(ADDR_FILE, "utf8"));
    existing.HLUSDToken = hlusdAddr;
    fs.writeFileSync(ADDR_FILE, JSON.stringify(existing, null, 2));
    console.log("📄 Updated deployedAddresses.json");

    // Mint some to deployer
    await (await hlusd.mint(deployer.address, ethers.parseUnits("1000", 18), GAS)).wait();
    console.log("💰 Minted 1000 HLUSD to deployer");

    // Update AIBattleAgent
    if (existing.AIBattleAgent) {
        console.log("🔗 Updating AIBattleAgent HLUSD...");
        const agent = await ethers.getContractAt("AIBattleAgent", existing.AIBattleAgent);
        await (await agent.setHLUSD(hlusdAddr, GAS)).wait();
        
        console.log("💸 Funding AI Reward Pool...");
        await (await hlusd.approve(existing.AIBattleAgent, ethers.parseUnits("100", 18), GAS)).wait();
        await (await agent.fundRewardPool(ethers.parseUnits("100", 18), GAS)).wait();
        console.log("✅ Funded AI Pool with 100 HLUSD");
    }

    // Update frontend .env.local
    const ENV_PATH = path.join(__dirname, "../frontend/.env.local");
    if (fs.existsSync(ENV_PATH)) {
        let content = fs.readFileSync(ENV_PATH, "utf8");
        content = content.replace(/NEXT_PUBLIC_HLUSD=.*/, `NEXT_PUBLIC_HLUSD=${hlusdAddr}`);
        fs.writeFileSync(ENV_PATH, content);
        console.log("📄 Updated NEXT_PUBLIC_HLUSD in .env.local");
    }

    // Update root .env
    const ROOT_ENV = path.join(__dirname, "../.env");
    if (fs.existsSync(ROOT_ENV)) {
        let content = fs.readFileSync(ROOT_ENV, "utf8");
        content = content.replace(/HLUSD_ADDRESS=.*/, `HLUSD_ADDRESS=${hlusdAddr}`);
        fs.writeFileSync(ROOT_ENV, content);
        console.log("📄 Updated HLUSD_ADDRESS in root .env");
    }
}

main().catch(console.error);
