import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import WalletButton from "./WalletButton";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/collection", label: "Cards" },
  { to: "/deck", label: "Deck" },
  { to: "/battle", label: "Battle" },
  { to: "/craft", label: "Craft" },
  { to: "/quests", label: "Quests" },
  { to: "/shop", label: "Shop" },
  { to: "/pass", label: "Pass" },
  { to: "/profile", label: "Profile" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
      isActive
        ? "text-[var(--accent-purple)]"
        : "text-[var(--text-secondary)] hover:text-white"
    }`;

  return (
    <header className="fixed top-0 inset-x-0 z-40 navbar-backdrop border-b border-[#2a2a3a]">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-3 sm:px-6 py-2.5">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-[var(--accent-purple)]">
              ⚔️ DeckWars
            </span>
          </Link>
        </div>
        <nav className="hidden md:flex items-center gap-2">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass} end={item.to === "/"}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block">
          <WalletButton />
        </div>
        <button
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-[var(--text-secondary)] hover:text-white hover:bg-[#1a1a2e]"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="sr-only">Toggle navigation</span>
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {open ? (
              <path d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-[#2a2a3a] bg-[#0a0a10]">
          <nav className="flex flex-col px-3 pb-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={linkClass}
                end={item.to === "/"}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="pt-2">
              <WalletButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

