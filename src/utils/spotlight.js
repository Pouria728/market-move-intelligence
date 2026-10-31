// A soft light that follows the cursor across a card - the single most
// "premium" cue in this file, and cheap: two CSS variables, no re-render.
export function handleSpotlightMove(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  event.currentTarget.style.setProperty("--spot-x", `${x}%`);
  event.currentTarget.style.setProperty("--spot-y", `${y}%`);
}
