export const DEFAULT_START_DATE_STR = "2000-01-01T00:00:00.000Z";

/**
 * Fetches the latest saved simulated date from MongoDB via /api/readings.
 * If a previous batch exists for this DT (or overall), returns the last simulated Date.
 * If no record exists or fetch fails, returns null.
 */
export async function fetchLastSimulatedDate(dtId) {
  try {
    const res = await fetch("/api/readings");
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      // Find latest record matching dtId or overall latest
      const match =
        json.data.find(
          (doc) => doc.transformer && doc.transformer.dt_id === dtId
        ) || json.data[0];

      if (match && match.simulated_at) {
        const d = new Date(match.simulated_at);
        if (!isNaN(d.getTime())) {
          return d;
        }
      }
    }
  } catch (err) {
    console.error(`[${dtId}] Error fetching last simulated date:`, err);
  }
  return null;
}

/**
 * Advances a Date object by exactly 1 day (24 hours).
 */
export function addOneDay(date) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
