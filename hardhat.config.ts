import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000001";
const HELA_TESTNET_RPC = process.env.HELA_TESTNET_RPC || process.env.HELA_RPC_URL || "https://testnet-rpc.helachain.com";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      viaIR: true,
    },
  },
  networks: {
    // Local Hardhat network (default for tests)
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // HeLa L1 Testnet — confirm chain ID at https://docs.helachain.com
    hela_testnet: {
      url: HELA_TESTNET_RPC,
      accounts: [`0x${PRIVATE_KEY}`],
      chainId: 666888,
      timeout: 120000,
      gas: 8000000,           // explicit gas limit (8M) — bypass estimateGas
      gasPrice: 100000000000, // 100 gwei — HeLa testnet minimum
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
