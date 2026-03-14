import React from "react";

export default function LoadingSpinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-secondary)] py-4">
      <div className="h-4 w-4 border-2 border-[var(--accent-purple)] border-t-transparent rounded-full animate-spin" />
      <span>{label}</span>
    </div>
  );
}

