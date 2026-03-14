import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Collection from "./pages/Collection";
import DeckBuilder from "./pages/DeckBuilder";
import BattleArena from "./pages/BattleArena";
import CraftingPage from "./pages/CraftingPage";
import QuestsPage from "./pages/QuestsPage";
import SeasonPage from "./pages/SeasonPage";
import PackShop from "./pages/PackShop";
import SeasonPassPage from "./pages/SeasonPassPage";
import ProfilePage from "./pages/ProfilePage";
import WalletButton from "./components/WalletButton";

function RequireWallet({ children }) {
  const { isConnected } = useAccount();
  const location = useLocation();

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-center flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <h2 className="text-2xl font-semibold mb-4">
            Connect your wallet to play DeckWars
          </h2>
          <WalletButton />
          <p className="mt-4 text-sm text-[var(--text-secondary)] break-all">
            You tried to visit <span className="font-mono">{location.pathname}</span>
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navbar />
      <main className="pt-16 pb-6 px-3 sm:px-6 max-w-6xl mx-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/collection"
            element={
              <RequireWallet>
                <Collection />
              </RequireWallet>
            }
          />
          <Route
            path="/deck"
            element={
              <RequireWallet>
                <DeckBuilder />
              </RequireWallet>
            }
          />
          <Route
            path="/battle"
            element={
              <RequireWallet>
                <BattleArena />
              </RequireWallet>
            }
          />
          <Route
            path="/craft"
            element={
              <RequireWallet>
                <CraftingPage />
              </RequireWallet>
            }
          />
          <Route
            path="/quests"
            element={
              <RequireWallet>
                <QuestsPage />
              </RequireWallet>
            }
          />
          <Route
            path="/season"
            element={
              <RequireWallet>
                <SeasonPage />
              </RequireWallet>
            }
          />
          <Route
            path="/shop"
            element={
              <RequireWallet>
                <PackShop />
              </RequireWallet>
            }
          />
          <Route
            path="/pass"
            element={
              <RequireWallet>
                <SeasonPassPage />
              </RequireWallet>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireWallet>
                <ProfilePage />
              </RequireWallet>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

