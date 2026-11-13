/** The game's name and the team's, with a small orbit mark. */
export function Brand() {
  return (
    <div className="st-brand">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
        <circle cx="16" cy="16" r="15" fill="#0a0f26" stroke="rgba(255,255,255,0.25)" />
        <circle cx="16" cy="16" r="5" fill="#60bee8" />
        <ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="#3792c2" strokeWidth="1.6" transform="rotate(-28 16 16)" />
        <circle cx="27" cy="10.5" r="1.6" fill="#fff" />
      </svg>
      <span>
        <b>RIWA Space Journey</b>
        <i>by team Space Underdogs</i>
      </span>
    </div>
  );
}
