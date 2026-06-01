'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useGlobal } from './GlobalContext';
import { ThemeMode } from '@/types';
import {
    DEFAULT_PRIMARY,
    DEFAULT_SECONDARY,
    THEME_PRIMARY_STORAGE_KEY,
    adjustBrightness,
    getContrastColor,
    getDerivedSecondaryColor,
    getPrimaryHoverColor,
    getSafePrimaryColor,
    hexToRgb,
    isBlueShade,
    isColorTooBright,
    isPrimaryColorAllowed,
} from '@/lib/themeColor';

interface ThemeContextType {
    primaryColor: string;
    secondaryColor: string;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    setPrimaryColor: (primary: string) => void;
    setThemeColors: (primary: string, secondary: string) => void;
    refreshTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { state } = useGlobal();
    const [primaryColor, setPrimaryColorState] = useState(() => {
        if (typeof window === 'undefined') return DEFAULT_PRIMARY;
        return getSafePrimaryColor(window.localStorage.getItem(THEME_PRIMARY_STORAGE_KEY));
    });
    const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY);
    const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('themeMode');
            if (saved === ThemeMode.DARK || saved === ThemeMode.LIGHT || saved === ThemeMode.SYSTEM) {
                return saved as ThemeMode;
            }
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            return prefersDark ? ThemeMode.DARK : ThemeMode.LIGHT;
        }
        return ThemeMode.SYSTEM;
    });

    const applyTheme = useCallback((primary: string, secondary: string, mode?: ThemeMode) => {
        const root = document.documentElement;
        const safePrimary = getSafePrimaryColor(primary);
        const safeSecondary = secondary || getDerivedSecondaryColor(safePrimary, mode || ThemeMode.LIGHT);

        // Base Colors
        root.style.setProperty('--primary', safePrimary);
        root.style.setProperty('--primary-hover', getPrimaryHoverColor(safePrimary));
        root.style.setProperty('--secondary', safeSecondary);
        root.style.setProperty('--neutral', '#8A919E'); // Neutral
        root.style.setProperty('--success', '#019256'); // Success
        root.style.setProperty('--warning', '#d89436'); // Warning
        root.style.setProperty('--danger', '#c71c27'); // Danger
        root.style.setProperty('--info', '#1e4dc5'); // Info

        // RGB for opacity support (used for shadow)
        const primaryRgb = hexToRgb(safePrimary);
        root.style.setProperty('--primary-rgb', `${primaryRgb?.r || 79}, ${primaryRgb?.g || 70}, ${primaryRgb?.b || 229}`);

        // Text Contrast (Automatic black/white text based on background)
        const primaryText = getContrastColor(safePrimary);
        const secondaryText = getContrastColor(safeSecondary);

        // Chat tick color (white if primary is blue shade, else blue)
        const chatTickColor = isBlueShade(safePrimary) ? '#ffffff' : '#0952C8';

        // Global foreground (text) color depends on mode
        // Global foreground (text) color depends on mode
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const effectiveMode = mode === ThemeMode.SYSTEM ? (prefersDark ? ThemeMode.DARK : ThemeMode.LIGHT) : mode;

        // --- Semantic Variable Injection ---
        const isDark = effectiveMode === ThemeMode.DARK;


        // Chat bubble background (dimmer version of primary if too bright)
        const chatBubbleBg = isColorTooBright(safePrimary) ? adjustBrightness(safePrimary, isDark ? -60 : -25) : safePrimary;

        // 1. Core Backgrounds & Foregrounds - Crypto Blue Design System
        if (isDark) {
            root.style.setProperty('--background', '#0B0F19'); // slightly richer than pure black
            root.style.setProperty('--background-rgb', '11, 15, 25');
            root.style.setProperty('--foreground', '#E6EAF2');
            root.style.setProperty('--foreground-rgb', '230, 234, 242');

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
            root.style.setProperty('--app-surface-overlay', 'rgba(2, 6, 23, 0.72)');
        }
        else {
            root.style.setProperty('--background', '#e2e8f0'); // slate-200
            root.style.setProperty('--background-rgb', '226, 232, 240');
            root.style.setProperty('--foreground', '#0B1220');
            root.style.setProperty('--foreground-rgb', '11, 18, 32');

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
            root.style.setProperty('--app-surface-overlay', 'rgba(15, 23, 42, 0.62)');
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
        const safePrimary = getSafePrimaryColor(primary);
        setPrimaryColorState(safePrimary);
        setSecondaryColor(secondary);
    }, []);

    // Save primary only; secondary is computed
    const setPrimaryColor = useCallback((primary: string) => {
        const mode = themeMode;
        const safePrimary = getSafePrimaryColor(primary);
        // Compute secondary based on mode
        const computedSecondary = getDerivedSecondaryColor(safePrimary, mode);
        setPrimaryColorState(safePrimary);
        setSecondaryColor(computedSecondary);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(THEME_PRIMARY_STORAGE_KEY, safePrimary);
        }
    }, [themeMode]);

    // Preview-only: set theme mode locally (no DB persistence). Settings form will persist on save.
    const setThemeMode = useCallback((mode: ThemeMode) => {
        setThemeModeState(mode);
        if (typeof window !== 'undefined') {
            localStorage.setItem('themeMode', mode);
        }
        // recompute secondary from current primary
        const computedSecondary = getDerivedSecondaryColor(primaryColor, mode);
        setSecondaryColor(computedSecondary);
    }, [primaryColor]);

    const refreshTheme = useCallback(() => {
        // Read org data from GlobalContext
        const orgData = state.stats.orgData;
        if (orgData?.accentColor?.primary) {
            const primary = getSafePrimaryColor(orgData.accentColor.primary);
            const mode = themeMode ?? ThemeMode.SYSTEM;
            const secondary = orgData.accentColor.secondary || getDerivedSecondaryColor(primary, mode);
            setPrimaryColorState(primary);
            setSecondaryColor(secondary);
            if (typeof window !== 'undefined' && isPrimaryColorAllowed(primary)) {
                window.localStorage.setItem(THEME_PRIMARY_STORAGE_KEY, primary);
            }
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


