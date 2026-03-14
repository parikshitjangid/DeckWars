import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
    const addresses = JSON.parse(fs.readFileSync("./deployedAddresses.json", "utf8"));
    const aiAgentAddr = ethers.getAddress(addresses.AIBattleAgent.toLowerCase());
    
    console.log("--- FINAL VERIFICATION ---");
    
    const tokenABI = [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function balanceOf(address) view returns (uint256)"
    ];

    const agent = await ethers.getContractAt("AIBattleAgent", aiAgentAddr);
    const hlUSDInAgent = await agent.hlUSD();
    const activeBattleForAgent = await agent.activeBattle((await ethers.getSigners())[0].address);

    const candidates = [
        hlUSDInAgent,
        "0xBE75FDe9DeDe700635E3dDBe7e29b5db1A76C125",
        "0xfE1d3bCc0E13bF78da55C418f4F90fdeE5f6D2B2"
    ];

    for (const addrRaw of candidates) {
        const addr = ethers.getAddress(addrRaw.toLowerCase());
        console.log(`\nAddress: ${addr}`);
        try {
            const token = await ethers.getContractAt(tokenABI, addr);
            const name = await token.name();
            const symbol = await token.symbol();
            const decimals = await token.decimals();
            const agentBalance = await token.balanceOf(aiAgentAddr);
            const deployerBalance = await token.balanceOf((await ethers.getSigners())[0].address);
            console.log(`  Name: ${name}`);
            console.log(`  Symbol: ${symbol}`);
            console.log(`  Decimals: ${decimals}`);
            console.log(`  Agent Reward Pool: ${ethers.formatUnits(agentBalance, decimals)} ${symbol}`);
            console.log(`  Deployer Balance: ${ethers.formatUnits(deployerBalance, decimals)} ${symbol}`);
        } catch (e: any) {
            console.log(`  Error: ${e.message.split('\n')[0]}`);
        }
    }

    console.log("\nAIBattleAgent Stats:");
    console.log("  Configured HLUSD:", hlUSDInAgent);
    console.log("  Active Battle ID for Deployer:", activeBattleForAgent.toString());
}

main().catch(console.error);
