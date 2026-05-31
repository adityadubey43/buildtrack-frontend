// Helpers for formatting times in IST (Asia/Kolkata)
export function formatTimeToIST(value?: string | null): string {
  if (!value) return "—";
  // If value looks like an ISO timestamp, parse and format to IST
  try {
    const looksLikeISO = /T/.test(value) || /Z$/.test(value) || /\+\d{2}:?\d{2}$/.test(value);
    if (looksLikeISO) {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
    }
    // If it's already a simple HH:MM string, return as-is
    return value;
  } catch {
    return value;
  }
}
