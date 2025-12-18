const el = document.getElementById("combo")!
let hideTimer: NodeJS.Timeout | null = null

window.api.onCombo((_, combo) => {
  el.textContent = combo
  el.classList.add("show")
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => el.classList.remove("show"), 3000)
})
