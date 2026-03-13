# DeckWars — Dev 2: Smart Contracts (Game Logic)

**Chain**: HeLa L1 · **Token**: HLUSD · **Branch**: `feat/contracts-game`

---

## 📁 Contracts (this branch)

| File | Description |
|---|---|
| `DeckManager.sol` | Deck registration (20-card validation), lock/unlock, `IBattleEngine` placeholder |
| `QuestSystem.sol` | 5 quests/season, progress tracking, DAO card voting (1 wallet = 1 vote) |
| `SeasonEngine.sol` | 30-day season lifecycle, finalization, permanent historical archive |
| `RankSystem.sol` | `PlayerStats`, RP math, 6 rank tiers (Bronze→Legend), on-chain top-100 leaderboard |
| `SeasonRewards.sol` | 3 reward tracks (rank HLUSD, leaderboard cards, milestones), 90-day expiry |
| `AIBattleAgent.sol` | Deterministic AI opponents, `AgentMove` event, HLUSD reward pool |
| `mocks/ERC20Mock.sol` | Test-only ERC20 mock for HLUSD |

---

## 🚀 Setup

```bash
# 1. Copy and fill in your private key and RPC
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Compile contracts
npx hardhat compile
```

---

## 🧪 Tests

```bash
npx hardhat test                       # all tests
npx hardhat test test/RankSystem.test.ts    # single file
```

---

## 🌐 Deploy to HeLa Testnet

> **Prerequisite**: Ensure Dev 1's `deployedAddresses.json` is committed first
> so `02_game.ts` can read `CardNFT`, `TreasuryVault`, and `HLUSDToken` addresses.

```bash
npx hardhat run deploy/02_game.ts --network hela_testnet
```

This will:
1. Deploy all 6 contracts in dependency order
2. Wire them together (`setQuestSystem`, `setAuthorisedRecorder`, etc.)
3. Append addresses to `deployedAddresses.json`
4. Export ABIs to `frontend/src/abis/`

---

## 🔗 Contract Wiring Diagram

```
SeasonEngine
  ├── setQuestSystem(QuestSystem)
  ├── setRankSystem(RankSystem)
  └── calls: QuestSystem.setCurrentSeasonId + setSeasonQuests
              RankSystem.resetSeasonRP (on finalize)

QuestSystem
  ├── setSeasonRewards(SeasonRewards)
  └── calls: SeasonRewards.markQuestRewardClaimable

RankSystem
  └── authorisedRecorder: AIBattleAgent, SeasonEngine

AIBattleAgent
  └── calls: RankSystem.recordWin / recordLoss

SeasonRewards
  ├── setSeasonEngine(SeasonEngine)     ← for registerSeason()
  ├── reads: RankSystem.getPlayerStats
  └── reads: CardNFT (Dev 1), TreasuryVault (Dev 1)

DeckManager
  └── reads: CardNFT.balanceOf (Dev 1)
      placeholder: IBattleEngine (wired when BattleEngine.sol is ready)
```

---

## 🔄 Integration Checkpoints

| Milestone | Action |
|---|---|
| Day 1 | Deploy `SeasonEngine` + `RankSystem`, export ABIs |
| Day 2 | Deploy remaining 4 contracts, wire, full testnet test |
| Day 3 | Dev 3 wires frontend hooks to deployed addresses |

---

## 📄 Placeholder Addresses

Contracts that depend on Dev 1 accept `address(0)` at deploy time.  
Update them via setters after Dev 1 commits:

```bash
# Example: update CardNFT address in DeckManager
npx hardhat console --network hela_testnet
> const dm = await ethers.getContractAt("DeckManager", "<DeckManager address>")
> await dm.setCardNFT("<CardNFT address from deployedAddresses.json>")
```
