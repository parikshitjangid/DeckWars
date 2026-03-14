import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Granting Minter Role on CardNFT to: ${deployer.address}`);

  const ADDRESSES_FILE = path.join(__dirname, "../deployedAddresses.json");
  const existing = fs.existsSync(ADDRESSES_FILE) ? JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8")) : {};
  const cAddr = existing.CardNFT;

  if (!cAddr) {
      console.error("CardNFT address not found in deployedAddresses.json");
      process.exit(1);
  }

  const CardNFT = await ethers.getContractAt("CardNFT", cAddr);
  
  const tx = await CardNFT.addMinter(deployer.address, { gasLimit: 2_000_000 });
  await tx.wait();
  
  console.log("✅ Successfully granted Minter role to backend Deployer wallet.");
}

main().catch((e) => { console.error(e); process.exit(1); });
