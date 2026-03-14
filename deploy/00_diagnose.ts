// Test raw deploy with manual gasLimit to bypass hardhat's estimateGas
import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const Factory = await ethers.getContractFactory("CardNFT");
    const uri = "https://api.deckwars.io/metadata/{id}.json";

    // Build deploy tx
    const deployTx = await Factory.getDeployTransaction(uri);

    console.log("Bytecode size:", (deployTx.data!.length - 2) / 2, "bytes");
    console.log("Sending raw deploy with explicit gasLimit: 8000000...");

    const tx = await deployer.sendTransaction({
        data: deployTx.data,
        gasLimit: 8000000n,
    });

    console.log("Tx hash:", tx.hash);
    console.log("Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("✅ Deployed at:", receipt?.contractAddress);
    console.log("   Gas used:", receipt?.gasUsed.toString());
}

main().catch((e) => {
    console.error("FAILED:", e.message);
    if (e.error) console.error("Inner:", e.error.message);
});
