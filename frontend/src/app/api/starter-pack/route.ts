import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import CardNFTAbi from '@/abis/CardNFT.json';
import { CONTRACTS } from '@/config/wagmi';

// Proper 4-tier rarity system matching wagmi.ts and the smart contract
// To protect the game economy, Starter Packs will NOT drop Legendaries.
const DROP_RATES = {
  Common: 80,  // 80% Common
  Rare: 18,    // 18% Rare
  Epic: 2,     // 2% Epic
  Legendary: 0 // 0% Legendary (no free legendaries)
};

// Map rarity to actual Token IDs from ALL_CARDS
const RARITY_POOLS = {
  Common: [1, 2, 3, 4, 5],
  Rare: [6, 7, 8, 9, 10],
  Epic: [11, 12, 13, 14, 15],
  Legendary: [16, 17, 18, 19, 20]
};

function getRandomTokenId(): number {
  const roll = Math.random() * 100;
  
  let selectedPool = RARITY_POOLS.Common;
  
  if (roll >= 98) {
    selectedPool = RARITY_POOLS.Epic; // 2% chance
  } else if (roll >= 80) {
    selectedPool = RARITY_POOLS.Rare; // 18% chance
  } else {
    selectedPool = RARITY_POOLS.Common; // 80% chance
  }

  // Return a random card from the selected pool
  return selectedPool[Math.floor(Math.random() * selectedPool.length)];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playerAddress } = body;

    if (!playerAddress || !playerAddress.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid player address' }, { status: 400 });
    }

    if (!process.env.DEPLOYER_PRIVATE_KEY) {
      console.error('Missing DEPLOYER_PRIVATE_KEY in .env.local');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    // Prepare 20 random cards
    const tokenCounts: Record<number, number> = {};
    for (let i = 0; i < 20; i++) {
        const id = getRandomTokenId();
        tokenCounts[id] = (tokenCounts[id] || 0) + 1;
    }

    const tokenIds = Object.keys(tokenCounts).map(id => BigInt(id));
    const amounts = Object.values(tokenCounts).map(amount => BigInt(amount));

    const rpcUrl = process.env.HELA_TESTNET_RPC || 'https://testnet-rpc.helachain.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl, { chainId: 666888, name: 'helaTestnet' }, { staticNetwork: true });
    
    // Prepend 0x if missing
    const pkRaw = process.env.DEPLOYER_PRIVATE_KEY.startsWith('0x') 
        ? process.env.DEPLOYER_PRIVATE_KEY 
        : `0x${process.env.DEPLOYER_PRIVATE_KEY}`;
        
    const wallet = new ethers.Wallet(pkRaw, provider);

    const cardNftAddress = process.env.NEXT_PUBLIC_CARD_NFT;
    if (!cardNftAddress || !cardNftAddress.startsWith('0x')) {
      console.error('Missing NEXT_PUBLIC_CARD_NFT in .env.local');
      return NextResponse.json({ error: 'Server misconfiguration: CardNFT address missing' }, { status: 500 });
    }

    const cardNFT = new ethers.Contract(cardNftAddress, CardNFTAbi, wallet);

    // Send the batch mint tx directly with hardcoded gas to bypass HeLa testnet estimation issues
    const tx = await cardNFT.mintBatch(
      playerAddress, 
      tokenIds, 
      amounts, 
      { gasLimit: 2000000 }
    );
    
    await tx.wait();

    return NextResponse.json({ success: true, hash: tx.hash, drop: tokenCounts });

  } catch (error: any) {
    console.error('Starter pack mint error:', error);
    return NextResponse.json({ error: error.message || 'Mint failed' }, { status: 500 });
  }
}
