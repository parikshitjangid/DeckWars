require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import("hardhat/config").HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    helaTestnet: {
      url:
        process.env.HELA_RPC ||
        "https://testnet-rpc.helachain.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 666888,
    },
    helaMainnet: {
      url:
        process.env.HELA_RPC ||
        "https://mainnet-rpc.helachain.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8668,
    },
    hardhat: {
      chainId: 31337,
    },
  },
};
