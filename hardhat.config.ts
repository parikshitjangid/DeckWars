import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.28",
        settings: {
            optimizer: { enabled: true, runs: 200 },
            evmVersion: "cancun",
        },
    },
    networks: {
        // Local Hardhat network (default for tests)
        hardhat: {},
        // HeLa L1 Testnet — confirm chain ID at https://docs.helachain.com
        hela_testnet: {
            url: process.env.HELA_RPC_URL || "https://testnet-rpc.helachain.com",
            accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY}`] : [],
            chainId: 666301, // ← verify this with HeLa docs
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
    typechain: {
        outDir: "typechain-types",
        target: "ethers-v6",
    },
};

export default config;
