export const THEME_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    var DEFAULT_PRIMARY = '#0052FF';
    var DEFAULT_SECONDARY = '#5B616E';
    var NEAR_BLACK_MAX_CHANNEL = 48;
    var NEAR_WHITE_MIN_CHANNEL = 232;
    var PRIMARY_KEY = 'eduverse:last-valid-primary';
    var MODE_KEY = 'themeMode';
    var root = document.documentElement;

    function normalizeHex(value) {
      if (!value) return null;
      var match = /^#?([a-f\\d]{3}|[a-f\\d]{6})$/i.exec(String(value).trim());
      if (!match) return null;
      var raw = match[1];
      if (raw.length === 3) raw = raw.split('').map(function (char) { return char + char; }).join('');
      return '#' + raw.toUpperCase();
    }

    function hexToRgb(hex) {
      var normalized = normalizeHex(hex);
      if (!normalized) return null;
      return {
        r: parseInt(normalized.slice(1, 3), 16),
        g: parseInt(normalized.slice(3, 5), 16),
        b: parseInt(normalized.slice(5, 7), 16)
      };
    }

    function isAllowedPrimary(hex) {
      return !isNearBlack(hex) && !isNearWhite(hex);
    }

    function safePrimary(hex) {
      var normalized = normalizeHex(hex);
      return normalized && isAllowedPrimary(normalized) ? normalized : DEFAULT_PRIMARY;
    }

    function adjustBrightness(hex, percent) {
      var rgb = hexToRgb(hex);
      if (!rgb) return hex;
      var amount = Math.floor(255 * (percent / 100));
      var r = Math.min(255, Math.max(0, rgb.r + amount));
      var g = Math.min(255, Math.max(0, rgb.g + amount));
      var b = Math.min(255, Math.max(0, rgb.b + amount));
      return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
    }

    function brightness(hex) {
      var rgb = hexToRgb(hex);
      if (!rgb) return 0;
      return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    }

    function isNearBlack(hex) {
      var rgb = hexToRgb(hex);
      if (!rgb) return true;
      return Math.max(rgb.r, rgb.g, rgb.b) <= NEAR_BLACK_MAX_CHANNEL;
    }

    function isNearWhite(hex) {
      var rgb = hexToRgb(hex);
      if (!rgb) return true;
      return Math.min(rgb.r, rgb.g, rgb.b) >= NEAR_WHITE_MIN_CHANNEL;
    }

    function contrast(hex) {
      return brightness(hex) >= 128 ? '#111827' : '#ffffff';
    }

    function isBlue(hex) {
      var rgb = hexToRgb(hex);
      return !!rgb && rgb.b > rgb.r && rgb.b > rgb.g;
    }

    var storedMode = localStorage.getItem(MODE_KEY);
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var mode = storedMode === 'LIGHT' || storedMode === 'DARK' || storedMode === 'SYSTEM' ? storedMode : 'SYSTEM';
    var isDark = mode === 'DARK' || (mode === 'SYSTEM' && prefersDark);
    var primary = safePrimary(localStorage.getItem(PRIMARY_KEY));
    var secondary = mode === 'DARK' ? adjustBrightness(primary, -85) : adjustBrightness(primary, 90);
    var primaryRgb = hexToRgb(primary);
    var tooBright = brightness(primary) > 100;

    root.classList.toggle('dark', isDark);
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--primary-hover', '#003ECB');
    root.style.setProperty('--secondary', secondary || DEFAULT_SECONDARY);
    root.style.setProperty('--primary-text', contrast(primary));
    root.style.setProperty('--secondary-text', contrast(secondary || DEFAULT_SECONDARY));
    root.style.setProperty('--chat-bubble', tooBright ? adjustBrightness(primary, isDark ? -60 : -25) : primary);
    root.style.setProperty('--chat-tick', isBlue(primary) ? '#ffffff' : '#0952C8');
    root.style.setProperty('--theme-bg', isDark ? '#0A0E1A' : '#e2e8f0');
    root.style.setProperty('--background', isDark ? '#0B0F19' : '#e2e8f0');
    root.style.setProperty('--foreground', isDark ? '#E6EAF2' : '#0B1220');
    root.style.setProperty('--card-bg', isDark ? '#121826' : '#f1f5f9');
    root.style.setProperty('--card-text', isDark ? '#E6EAF2' : '#0B1220');
    root.style.setProperty('--muted-bg', isDark ? '#1A2233' : '#cbd5e1');
    root.style.setProperty('--muted-text', isDark ? '#94A3B8' : '#64748B');
    root.style.setProperty('--accent-bg', isDark ? '#1E293B' : '#94a3b8');
    root.style.setProperty('--accent-text', isDark ? '#E2E8F0' : '#0F172A');
    root.style.setProperty('--border-color', isDark ? 'rgba(148, 163, 184, 0.2)' : '#cbd5e1');
    root.style.setProperty('--input-bg', isDark ? '#0F172A' : '#f8fafc');
    root.style.setProperty('--navbar-bg', isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)');
    root.style.setProperty('--navbar-text', isDark ? '#F9FAFB' : '#050F1A');
    root.style.setProperty('--shadow-color', isDark ? 'rgba(0,0,0,0.5)' : 'rgba(' + (primaryRgb ? primaryRgb.r : 0) + ', ' + (primaryRgb ? primaryRgb.g : 82) + ', ' + (primaryRgb ? primaryRgb.b : 255) + ', 0.15)');
  } catch (error) {
    document.documentElement.classList.toggle('dark', window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
})();
`;
