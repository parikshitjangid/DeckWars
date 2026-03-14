import React from "react";

export default function HPBar({ current, max = 100 }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  let color = "bg-green-500";
  if (pct <= 25) color = "bg-red-500";
  else if (pct <= 50) color = "bg-yellow-400";

  return (
    <div className="w-full bg-[#1a1a2e] rounded-full h-5 overflow-hidden text-xs">
      <div
        className={`${color} h-5 transition-all duration-500 flex items-center justify-center`}
        style={{ width: `${pct}%` }}
      >
        <span className="px-2 font-semibold">
          {current} / {max} HP
        </span>
      </div>
    </div>
  );
}

