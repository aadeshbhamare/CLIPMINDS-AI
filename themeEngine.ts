/* ================================
   THEME TYPES
================================ */
export type Theme =
  | "default"
  | "weekend"
  | "monday"
  | "makarSankranti"
  | "christmas";

/* ================================
   CORE DATE-BASED LOGIC
================================ */
export function getThemeByDate(date: Date = new Date()): Theme {
  const day = date.getDay();       // 0 = Sunday
  const month = date.getMonth() + 1;
  const dateNum = date.getDate();

  // 🎉 Festival Themes
  if (month === 1 && dateNum === 14) return "makarSankranti";
  if (month === 12 && dateNum === 25) return "christmas";

  // 📆 Day-based Themes
  if (day === 0 || day === 6) return "weekend";
  if (day === 1) return "monday";

  return "default";
}

/* ================================
   AI THEME SELECTOR (SAFE)
================================ */
export function aiThemeSelector({
  date = new Date(),
  isHoliday = false,
  userMood = "happy",
}: {
  date?: Date;
  isHoliday?: boolean;
  userMood?: "happy" | "focus" | "relax";
}): Theme {
  if (isHoliday) return getThemeByDate(date);
  if (userMood === "focus") return "default";
  return getThemeByDate(date);
}

/* ================================
   APPLY THEME TO DOCUMENT
================================ */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("activeTheme", theme);
  console.log(`[Theme Engine] Applied: ${theme}`);
}

/* ================================
   AUTO MIDNIGHT REFRESH
================================ */
function scheduleMidnightRefresh() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);

  const msUntilMidnight = midnight.getTime() - now.getTime();

  setTimeout(() => {
    initThemeEngine();
    scheduleMidnightRefresh();
  }, msUntilMidnight);
}

/* ================================
   INITIALIZER
================================ */
export function initThemeEngine() {
  // 🔒 Manual override support
  const lockedTheme = localStorage.getItem("lockedTheme") as Theme | null;

  if (lockedTheme) {
    applyTheme(lockedTheme);
    return;
  }

  const theme = aiThemeSelector({
    date: new Date(),
    isHoliday: false,
    userMood: "happy",
  });

  applyTheme(theme);
  scheduleMidnightRefresh();
}

/* ================================
   OPTIONAL: MANUAL OVERRIDE API
================================ */
export function lockTheme(theme: Theme) {
  localStorage.setItem("lockedTheme", theme);
  applyTheme(theme);
}

export function unlockTheme() {
  localStorage.removeItem("lockedTheme");
  initThemeEngine();
}
