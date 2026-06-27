// A curated pack of rich brand gradients. Each client is assigned one
// deterministically (by id/name hash) and shows its initials on top —
// a designed monogram avatar, offline, no external image requests.
const GRADIENTS = [
  "linear-gradient(135deg,#6366f1,#8b5cf6)",
  "linear-gradient(135deg,#8b5cf6,#c13fe0)",
  "linear-gradient(135deg,#0ea5e9,#6366f1)",
  "linear-gradient(135deg,#f43f5e,#fb7185)",
  "linear-gradient(135deg,#10b981,#06b6d4)",
  "linear-gradient(135deg,#f59e0b,#f43f5e)",
  "linear-gradient(135deg,#ec4899,#8b5cf6)",
  "linear-gradient(135deg,#14b8a6,#3b82f6)",
  "linear-gradient(135deg,#6d5df6,#c13fe0)",
  "linear-gradient(135deg,#f97316,#ec4899)",
  "linear-gradient(135deg,#22d3ee,#818cf8)",
  "linear-gradient(135deg,#a78bfa,#6366f1)",
];

const STOP = new Set([
  "google", "ads", "account", "the", "llc", "inc", "co", "ltd", "international",
  "new", "amsterdam", "official", "store", "shop", "brand",
]);

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 1–2 letter monogram from the meaningful words of a client name. */
export function clientInitials(name: string): string {
  const words = (name || "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (name || "?").replace(/[^a-zA-Z0-9]/g, "").slice(0, 1).toUpperCase() || "?";
}

export function ClientAvatar({
  name,
  seed,
  size = 36,
  className,
}: {
  name: string;
  /** Stable key for gradient selection (e.g. customerId). Falls back to name. */
  seed?: string;
  size?: number;
  className?: string;
}) {
  const gradient = GRADIENTS[hash(seed || name || "") % GRADIENTS.length];
  return (
    <div
      className={className}
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(6, Math.round(size * 0.28)),
        background: gradient,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: 700,
        fontSize: Math.round(size * 0.4),
        letterSpacing: "-0.02em",
        flexShrink: 0,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      {clientInitials(name)}
    </div>
  );
}
