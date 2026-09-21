/** A push-pin: outlined, or filled when `filled` (the player is pinned). Takes its colour from the text around it. */
export default function PinIcon({ filled = false, size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z" />
    </svg>
  );
}
