import { colorFromString } from "../utils/format";

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  const dims = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";

  return (
    <div
      className={`flex ${dims} shrink-0 items-center justify-center rounded-full font-display font-semibold text-white ${colorFromString(name)}`}
    >
      {initial}
    </div>
  );
}
