const el = document.getElementById("combo")!
let hideTimer: NodeJS.Timeout | null = null
let keyModeEnabled = true; // Click ripple enabled by default
window.api?.onDrawingToggle((_, enabled: boolean) => {
  keyModeEnabled = !enabled;
  console.log('keyModeEnabled', keyModeEnabled);
  console.log('keyModeEnabled mode', keyModeEnabled ? 'enabled' : 'disabled');
});
window.api.onCombo((_, combo) => {
  if (!keyModeEnabled) return;
  el.textContent = combo
  el.classList.add("show")
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => el.classList.remove("show"), 3000)
})
