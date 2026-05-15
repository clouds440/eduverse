'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useGlobal } from './GlobalContext';
import { ThemeMode } from '@/types';

interface ThemeContextType {
    primaryColor: string;
    secondaryColor: string;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    setPrimaryColor: (primary: string) => void;
    setThemeColors: (primary: string, secondary: string) => void;
    refreshTheme: () => void;
}

const DEFAULT_PRIMARY = '#0052FF'; // Crypto Blue - From theme
const DEFAULT_SECONDARY = '#5B616E'; // Cool Slate

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { state } = useGlobal();
    const [primaryColor, setPrimaryColorState] = useState(DEFAULT_PRIMARY);
    const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY);
    const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('themeMode');
            if (saved === ThemeMode.DARK || saved === ThemeMode.LIGHT || saved === ThemeMode.SYSTEM) {
                return saved as ThemeMode;
            }
        }
        // Default to system preference if no saved value exists
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? ThemeMode.DARK : ThemeMode.LIGHT;
    });

    const applyTheme = useCallback((primary: string, secondary: string, mode?: ThemeMode) => {
        const root = document.documentElement;

        // Base Colors
        root.style.setProperty('--primary', primary);
        root.style.setProperty('--primary-hover', '#003ECB'); // Primary Hover
        root.style.setProperty('--secondary', secondary);
        root.style.setProperty('--neutral', '#8A919E'); // Neutral
        root.style.setProperty('--success', '#019256'); // Success
        root.style.setProperty('--warning', '#d89436'); // Warning
        root.style.setProperty('--danger', '#c71c27'); // Danger
        root.style.setProperty('--info', '#1e4dc5'); // Info

        // RGB for opacity support (used for shadow)
        const primaryRgb = hexToRgb(primary);

        // Text Contrast (Automatic black/white text based on background)
        const primaryText = getContrastColor(primary);
        const secondaryText = getContrastColor(secondary);

        // Chat tick color (white if primary is blue shade, else blue)
        const chatTickColor = isBlueShade(primary) ? '#ffffff' : '#0952C8';

        // Global foreground (text) color depends on mode
        // Global foreground (text) color depends on mode
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const effectiveMode = mode === ThemeMode.SYSTEM ? (prefersDark ? ThemeMode.DARK : ThemeMode.LIGHT) : mode;

        // --- Semantic Variable Injection ---
        const isDark = effectiveMode === ThemeMode.DARK;


        // Chat bubble background (dimmer version of primary if too bright)
        const chatBubbleBg = isColorTooBright(primary) ? adjustBrightness(primary, isDark ? -60 : -25) : primary;

        // 1. Core Backgrounds & Foregrounds - Crypto Blue Design System
        if (isDark) {
            root.style.setProperty('--background', '#0B0F19'); // slightly richer than pure black
            root.style.setProperty('--foreground', '#E6EAF2');

            root.style.setProperty('--card-bg', '#121826'); // lifted surface
            root.style.setProperty('--card-text', '#E6EAF2');

            root.style.setProperty('--muted-bg', '#1A2233'); // subtle separation
            root.style.setProperty('--muted-text', '#94A3B8');

            root.style.setProperty('--accent-bg', '#1E293B'); // cooler tone
            root.style.setProperty('--accent-text', '#E2E8F0');

            root.style.setProperty('--border-color', 'rgba(148, 163, 184, 0.2)');
            root.style.setProperty('--input-bg', '#0F172A');

            root.style.setProperty('--text-primary', '#F1F5F9');
            root.style.setProperty('--text-secondary', '#94A3B8');
        }
        else {
            root.style.setProperty('--background', '#e2e8f0'); // slate-200
            root.style.setProperty('--foreground', '#0B1220');

            root.style.setProperty('--card-bg', '#f1f5f9'); // slate-100
            root.style.setProperty('--card-text', '#0B1220');

            root.style.setProperty('--muted-bg', '#cbd5e1'); // slate-300
            root.style.setProperty('--muted-text', '#64748B');

            root.style.setProperty('--accent-bg', '#94a3b8'); // slate-400
            root.style.setProperty('--accent-text', '#0F172A');

            root.style.setProperty('--border-color', '#cbd5e1');
            root.style.setProperty('--input-bg', '#f8fafc'); // slightly lighter for inputs

            root.style.setProperty('--text-primary', '#0F172A');
            root.style.setProperty('--text-secondary', '#64748B');
        }

        root.style.setProperty('--primary-text', primaryText);
        root.style.setProperty('--secondary-text', secondaryText);
        root.style.setProperty('--chat-bubble', chatBubbleBg);
        root.style.setProperty('--chat-tick', chatTickColor);

        // Tints & Atmospherics
        root.style.setProperty('--chat-doodle', "url('/assets/chat-doodle.svg')");
        root.style.setProperty('--theme-bg', isDark ? '#0A0E1A' : '#e2e8f0');

        // Navbar defaults
        root.style.setProperty('--navbar-bg', isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)');
        root.style.setProperty('--navbar-text', isDark ? '#F9FAFB' : '#050F1A');

        // Shadows
        root.style.setProperty('--shadow-color', isDark ? 'rgba(0,0,0,0.5)' : `rgba(${primaryRgb?.r || 0}, ${primaryRgb?.g || 0}, ${primaryRgb?.b || 0}, 0.15)`);
    }, []);

    const setThemeColors = useCallback((primary: string, secondary: string) => {
        setPrimaryColorState(primary);
        setSecondaryColor(secondary);
    }, []);

    // Save primary only; secondary is computed
    const setPrimaryColor = useCallback((primary: string) => {
        const mode = themeMode;
        // Compute secondary based on mode
        const computedSecondary = mode === ThemeMode.DARK ? adjustBrightness(primary, -85) : adjustBrightness(primary, 90);
        setPrimaryColorState(primary);
        setSecondaryColor(computedSecondary);
    }, [themeMode]);

    // Preview-only: set theme mode locally (no DB persistence). Settings form will persist on save.
    const setThemeMode = useCallback((mode: ThemeMode) => {
        setThemeModeState(mode);
        if (typeof window !== 'undefined') {
            localStorage.setItem('themeMode', mode);
        }
        // recompute secondary from current primary
        const computedSecondary = mode === ThemeMode.DARK ? adjustBrightness(primaryColor, -85) : adjustBrightness(primaryColor, 90);
        setSecondaryColor(computedSecondary);
    }, [primaryColor]);

    const refreshTheme = useCallback(() => {
        // Read org data from GlobalContext
        const orgData = state.stats.orgData;
        if (orgData?.accentColor?.primary) {
            const primary = orgData.accentColor.primary;
            const mode = themeMode ?? ThemeMode.SYSTEM;
            const secondary = orgData.accentColor.secondary || (mode === ThemeMode.DARK ? adjustBrightness(primary, -85) : adjustBrightness(primary, 90));
            setPrimaryColorState(primary);
            setSecondaryColor(secondary);
        } else {
            // Fallback to defaults if no org data or no primary color
            setThemeColors(DEFAULT_PRIMARY, DEFAULT_SECONDARY);
        }
    }, [setThemeColors, themeMode, state.stats.orgData]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        refreshTheme();
    }, [refreshTheme]);

    // Centralized theme application
    useEffect(() => {
        applyTheme(primaryColor, secondaryColor, themeMode);
    }, [primaryColor, secondaryColor, themeMode, applyTheme]);

    // Centralized theme class management
    useEffect(() => {
        const root = document.documentElement;

        const updateClass = (isDark: boolean) => {
            if (isDark) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        };

        if (themeMode === ThemeMode.DARK) {
            updateClass(true);
        } else if (themeMode === ThemeMode.LIGHT) {
            updateClass(false);
        } else {
            // SYSTEM
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

            const handleSystemChange = () => {
                const isDark = mediaQuery.matches;
                updateClass(isDark);
            };

            handleSystemChange(); // Initial set

            mediaQuery.addEventListener('change', handleSystemChange);
            return () => mediaQuery.removeEventListener('change', handleSystemChange);
        }
    }, [themeMode]);


    return (
        <ThemeContext.Provider value={{
            primaryColor,
            secondaryColor,
            themeMode,
            setThemeMode,
            setPrimaryColor,
            setThemeColors,
            refreshTheme
        }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

// --- Utilities ---

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function getBrightness(hex: string) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}

function getContrastColor(hex: string) {
    const yiq = getBrightness(hex);
    return (yiq >= 128) ? '#111827' : '#ffffff';
}

function isColorTooBright(hex: string, threshold: number = 100): boolean {
    return getBrightness(hex) > threshold;
}

function isBlueShade(hex: string): boolean {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    // Check if blue is the dominant color
    return rgb.b > rgb.r && rgb.b > rgb.g;
}

// Utility to darken/lighten hex colors
function adjustBrightness(hex: string, percent: number) {
    if (!hex || hex[0] !== '#') return hex;

    // Normalize 3-digit hex to 6-digit
    let processedHex = hex.slice(1);
    if (processedHex.length === 3) {
        processedHex = processedHex.split('').map(c => c + c).join('');
    }

    let r = parseInt(processedHex.slice(0, 2), 16);
    let g = parseInt(processedHex.slice(2, 4), 16);
    let b = parseInt(processedHex.slice(4, 6), 16);

    const amount = Math.floor(255 * (percent / 100));

    r = Math.min(255, Math.max(0, r + amount));
    g = Math.min(255, Math.max(0, g + amount));
    b = Math.min(255, Math.max(0, b + amount));

    const rr = r.toString(16).padStart(2, '0');
    const gg = g.toString(16).padStart(2, '0');
    const bb = b.toString(16).padStart(2, '0');

    return `#${rr}${gg}${bb}`;
}


