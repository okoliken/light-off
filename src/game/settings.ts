// Graphics quality. Laptops get hot when a game renders as fast as it can, so every preset caps the
// frame rate, and Medium (the default) trims the most expensive work: resolution, shadow detail,
// the number of real lights and people.
const KEY = 'light-off-settings';

export const PRESETS = {
  low:    { label: 'Low · coolest, longest battery', pixelRatio: 0.75, shadows: false, shadowSize: 512, bloom: false, fps: 30, crowd: 70, lights: 4 }, // Low targets integrated graphics: a thin crowd
  medium: { label: 'Medium · recommended for laptops', pixelRatio: 1, shadows: true, shadowSize: 1024, bloom: true, fps: 45, crowd: 280, lights: 6 },
  high:   { label: 'High · best looking, runs hot', pixelRatio: 1.5, shadows: true, shadowSize: 2048, bloom: true, fps: 60, crowd: 380, lights: 10 },
};

export function loadSettings() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && PRESETS[s.quality]) return { sound: true, ...s }; } catch { /* no storage */ }
  return { quality: 'medium', sound: true };
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* no storage */ } }
export const preset = (s) => ({ ...PRESETS[s.quality], pixelRatio: Math.min(devicePixelRatio || 1, PRESETS[s.quality].pixelRatio) });
