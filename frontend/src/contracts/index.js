// This file expects deploy.js to generate addresses.js and ABI JSON files.
// Until deployment, imports will fail, so ensure contracts are compiled/deployed first.
import { CONTRACT_ADDRESSES } from "./addresses";
import DeckWarsCardAbi from "./abis/DeckWarsCard.json";
import DeckWarsDeckAbi from "./abis/DeckWarsDeck.json";
import DeckWarsBattleAbi from "./abis/DeckWarsBattle.json";
import DeckWarsCraftAbi from "./abis/DeckWarsCraft.json";
import DeckWarsQuestAbi from "./abis/DeckWarsQuest.json";
import DeckWarsSeasonAbi from "./abis/DeckWarsSeason.json";
import DeckWarsRankAbi from "./abis/DeckWarsRank.json";
import DeckWarsRewardsAbi from "./abis/DeckWarsRewards.json";
import DeckWarsTreasuryAbi from "./abis/DeckWarsTreasury.json";
import DeckWarsSeasonPassAbi from "./abis/DeckWarsSeasonPass.json";
import DeckWarsPacksAbi from "./abis/DeckWarsPacks.json";
import HLUSDAbi from "./abis/HLUSD.json";

export const ABIS = {
  DeckWarsCard: DeckWarsCardAbi,
  DeckWarsDeck: DeckWarsDeckAbi,
  DeckWarsBattle: DeckWarsBattleAbi,
  DeckWarsCraft: DeckWarsCraftAbi,
  DeckWarsQuest: DeckWarsQuestAbi,
  DeckWarsSeason: DeckWarsSeasonAbi,
  DeckWarsRank: DeckWarsRankAbi,
  DeckWarsRewards: DeckWarsRewardsAbi,
  DeckWarsTreasury: DeckWarsTreasuryAbi,
  DeckWarsSeasonPass: DeckWarsSeasonPassAbi,
  DeckWarsPacks: DeckWarsPacksAbi,
  HLUSD: HLUSDAbi,
};

export { CONTRACT_ADDRESSES };

