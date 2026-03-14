# ⚔️ DeckWars — Fully Onchain TCG on HeLa

> Battle. Craft. Conquer. Built on **HeLa** with **HLUSD**.

DeckWars is a fully onchain Trading Card Game where every card, battle, quest, and season lives on the **HeLa blockchain**. It uses **HLUSD** (HeLa’s native stablecoin) for packs, season pass, and rewards — aligned with [HeLa Labs](https://helalabs.com) Payments and ecosystem focus.

---

## HeLa Blockchain

| Network   | Chain ID | RPC | Explorer |
|----------|----------|-----|----------|
| HeLa Testnet | 666888 | https://testnet-rpc.helachain.com | https://testnet-blockexplorer.helachain.com |
| HeLa Mainnet | 8668   | https://mainnet-rpc.helachain.com | https://helascan.io |

- **Website:** [helalabs.com](https://helalabs.com)  
- **Docs:** [docs.helalabs.com](https://docs.helalabs.com)  
- **Discord:** [discord.gg/NEBtTztJCj](https://discord.gg/NEBtTztJCj)  
- **Free API keys:** [Developer Portal](https://helalabs.com) → Developer Settings → API Keys  

---

## What is DeckWars?

- **Fully onchain:** Cards, decks, battles, quests, seasons, and rewards are on HeLa. No backend, no database.
- **HLUSD-native:** Packs, season pass, and rank rewards use HLUSD (game deploys its own HLUSD for testing; on mainnet you can integrate native HLUSD).
- **DAO touch:** Quest voting for featured cards; community-driven drops.
- **Payments focus:** Aligns with HeLa Labs “Payments” focus — consumer-facing HLUSD for packs and rewards.

---

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Smart Contracts | Solidity 0.8.20 + Hardhat |
| NFT Standard | ERC-1155 (cards) |
| Frontend | React 18 + Vite + wagmi v2 + Tailwind |
| Blockchain | **HeLa Testnet** (666888) / **HeLa Mainnet** (8668) |
| Game Token | **HLUSD** (HeLa stablecoin) |

---

## Quick Start

```bash
# Install contract dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Copy env and add your wallet private key
cp .env.example .env

# Compile contracts
npm run compile
npm run copy-abis

# Deploy to HeLa Testnet
npm run deploy

# Deploy to HeLa Mainnet (when ready)
npm run deploy:mainnet

# Run frontend
cd frontend && npm run dev
```

Open **http://localhost:5173**, connect a wallet on **HeLa Testnet**, and play.

---

## Contract Architecture

1. **HLUSD** — ERC-20 (faucet for testnet; on mainnet can wrap native HLUSD)
2. **DeckWarsCard** — ERC-1155 NFT cards (20 cards, 5 rarities)
3. **DeckWarsDeck** — Onchain deck storage
4. **DeckWarsBattle** — Battle engine (turns, elements, timeouts)
5. **DeckWarsCraft** — Burn 3 → mint 1 of next rarity
6. **DeckWarsQuest** — Quests + DAO voting
7. **DeckWarsSeason** — Season lifecycle
8. **DeckWarsRank** — RP and leaderboard
9. **DeckWarsRewards** — Season reward distribution
10. **DeckWarsTreasury** — Revenue split (85% dev / 15% prize)
11. **DeckWarsSeasonPass** — Season pass + milestones
12. **DeckWarsPacks** — Silver / Gold / Diamond packs (HLUSD)

---

## Game Mechanics

- **Cards:** 20 cards, 3 elements (Fire/Water/Earth), 5 rarities. Element advantage: +3 damage.
- **Battles:** 100 HP, 3 moves (Attack / Defend / Special), 5-minute turn timer.
- **Crafting:** 3 same-rarity cards → 1 random card of next rarity.
- **Quests:** 5 per season; claim reward cards; DAO vote for featured card.
- **Packs:** Silver (5 HLUSD), Gold (15 HLUSD), Diamond (50 HLUSD); pity system.
- **Season Pass:** 10 HLUSD; 100 levels; 2× HLUSD on quest rewards.

---

## HeLa Labs Builder Guidelines

DeckWars is built in line with [HeLa Labs Builder Guidelines](https://helalabs.com):

- **Ecosystem alignment:** Uses HeLa and HLUSD for payments and rewards.
- **Payments focus:** Consumer HLUSD flows (packs, season pass, rank/leaderboard rewards).
- **DAO tooling:** Quest voting for featured cards.
- **Education:** Onchain TCG as an entry point to crypto and HeLa.
- **Build in public:** Open-source; progress shareable in [Discord](https://discord.gg/NEBtTztJCj).
- **Documentation:** This README and in-app copy document the project.

**Support:**  
- Email: shivam.devrel@helalabs.com  
- Discord: https://discord.com/invite/helalabs  

---

## Deployed Contracts

After `npm run deploy` or `npm run deploy:mainnet`, addresses are written to  
`frontend/src/contracts/addresses.js`.

---

## License

MIT.

**HeLa Labs** · [helalabs.com](https://helalabs.com) · Version 1.0
