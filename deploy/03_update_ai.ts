import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const ADDRESSES_FILE = path.join(__dirname, "../deployedAddresses.json");
  const existing = fs.existsSync(ADDRESSES_FILE) ? JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8")) : {};
  
  const HLUSD_ADDRESS = process.env.HLUSD_ADDRESS || existing.HLUSDToken;
  const rankSystemAddress = existing.RankSystem;
  
  console.log("Deploying new AIBattleAgent...");
  const AIBattleAgent = await ethers.getContractFactory("AIBattleAgent");
  
  // Use explicit gas limits to bypass HeLa estimateGas issues
  const aiBattleAgent = await AIBattleAgent.deploy(HLUSD_ADDRESS, rankSystemAddress, { gasLimit: 8_000_000, gasPrice: 100n * 10n**9n });
  await aiBattleAgent.waitForDeployment();
  const aiAddr = await aiBattleAgent.getAddress();
  
  console.log(`✅ AIBattleAgent deployed to: ${aiAddr}`);
  
  existing.AIBattleAgent = aiAddr;
  fs.writeFileSync(ADDRESSES_FILE, JSON.stringify(existing, null, 2));

  // Export ABI to frontend
  const name = "AIBattleAgent";
  const abiDir = path.join(__dirname, "../frontend/src/abis");
  const artifactPath = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  fs.writeFileSync(path.join(abiDir, `${name}.json`), JSON.stringify(artifact.abi, null, 2));
  console.log(`📄 ABI exported: ${name}.json`);
  
  // Also update .env.local
  const envPath = path.join(__dirname, "../frontend/.env.local");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");
    envContent = envContent.replace(/NEXT_PUBLIC_AI_AGENT_ADDRESS=.*/, `NEXT_PUBLIC_AI_AGENT_ADDRESS=${aiAddr}`);
    fs.writeFileSync(envPath, envContent);
    console.log(`📄 Updated NEXT_PUBLIC_AI_AGENT_ADDRESS in .env.local`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
