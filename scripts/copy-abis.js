const fs = require("fs");
const path = require("path");

const names = [
  "HLUSD",
  "DeckWarsCard",
  "DeckWarsDeck",
  "DeckWarsBattle",
  "DeckWarsCraft",
  "DeckWarsQuest",
  "DeckWarsSeason",
  "DeckWarsRank",
  "DeckWarsRewards",
  "DeckWarsTreasury",
  "DeckWarsSeasonPass",
  "DeckWarsPacks",
];

const frontendAbiDir = path.join(__dirname, "../frontend/src/contracts/abis");
const artifactsDir = path.join(__dirname, "../artifacts/contracts");

fs.mkdirSync(frontendAbiDir, { recursive: true });

for (const name of names) {
  const artifactPath = path.join(artifactsDir, `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(artifactPath)) {
    console.warn(`Skip ${name}: artifact not found. Run npx hardhat compile first.`);
    continue;
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  fs.writeFileSync(
    path.join(frontendAbiDir, `${name}.json`),
    JSON.stringify(artifact.abi, null, 2)
  );
  console.log(`Copied ABI: ${name}`);
}

console.log("ABIs copied to frontend/src/contracts/abis/");
