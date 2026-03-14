import React, { useState, useEffect } from "react";

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

export default function SeasonCountdown({ timeRemainingSeconds }) {
  const [left, setLeft] = useState(timeRemainingSeconds ?? 0);

  useEffect(() => {
    if (timeRemainingSeconds == null) return;
    setLeft(timeRemainingSeconds);
    const t = setInterval(() => {
      setLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [timeRemainingSeconds]);

  return (
    <span className="font-mono text-lg text-[var(--accent-gold)]">
      {formatDuration(left)}
    </span>
  );
}
