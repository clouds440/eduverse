'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useGlobal } from './GlobalContext';
import { ThemeMode } from '@/types';
import {
    DEFAULT_PRIMARY,
    DEFAULT_SECONDARY,
    DARK_THEME_SURFACES,
    LIGHT_THEME_SURFACES,
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
        const surfaces = isDark ? DARK_THEME_SURFACES : LIGHT_THEME_SURFACES;
        const surfaceRgb = hexToRgb(surfaces.background);
        const foregroundRgb = hexToRgb(surfaces.foreground);

        root.style.setProperty('--background', surfaces.background);
        root.style.setProperty('--background-rgb', `${surfaceRgb?.r || 226}, ${surfaceRgb?.g || 232}, ${surfaceRgb?.b || 240}`);
        root.style.setProperty('--foreground', surfaces.foreground);
        root.style.setProperty('--foreground-rgb', `${foregroundRgb?.r || 11}, ${foregroundRgb?.g || 18}, ${foregroundRgb?.b || 32}`);
        root.style.setProperty('--card-bg', surfaces.cardBg);
        root.style.setProperty('--card-text', surfaces.cardText);
        root.style.setProperty('--muted-bg', surfaces.mutedBg);
        root.style.setProperty('--muted-text', surfaces.mutedText);
        root.style.setProperty('--accent-bg', surfaces.accentBg);
        root.style.setProperty('--accent-text', surfaces.accentText);
        root.style.setProperty('--border-color', surfaces.borderColor);
        root.style.setProperty('--input-bg', surfaces.inputBg);
        root.style.setProperty('--text-primary', isDark ? '#F1F5F9' : '#0F172A');
        root.style.setProperty('--text-secondary', surfaces.mutedText);
        root.style.setProperty('--app-surface-overlay', surfaces.overlay);

        root.style.setProperty('--primary-text', primaryText);
        root.style.setProperty('--secondary-text', secondaryText);
        root.style.setProperty('--chat-bubble', chatBubbleBg);
        root.style.setProperty('--chat-tick', chatTickColor);

        // Tints & Atmospherics
        root.style.setProperty('--chat-doodle', "url('/assets/chat-doodle.svg')");
        root.style.setProperty('--theme-bg', surfaces.themeBg);

        // Navbar defaults
        root.style.setProperty('--navbar-bg', surfaces.navbarBg);
        root.style.setProperty('--navbar-text', surfaces.navbarText);

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
        } else if (!state.auth.user?.organizationId && !state.auth.user?.orgId) {
            setThemeColors(DEFAULT_PRIMARY, DEFAULT_SECONDARY);
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(THEME_PRIMARY_STORAGE_KEY);
            }
        }
    }, [setThemeColors, themeMode, state.auth.user?.organizationId, state.auth.user?.orgId, state.stats.orgData]);

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


