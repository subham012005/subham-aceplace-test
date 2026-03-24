"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type CursorStyle = 'targeting' | 'normal';

interface Settings {
    cursorStyle: CursorStyle;
}

interface SettingsContextType {
    settings: Settings;
    updateCursorStyle: (style: CursorStyle) => void;
}

const defaultSettings: Settings = {
    cursorStyle: 'targeting'
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<Settings>(defaultSettings);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('nxq_settings');
        if (saved) {
            try {
                // Ensure legacy settings don't break the app by picking only what we need
                const parsed = JSON.parse(saved);
                setSettings({ cursorStyle: parsed.cursorStyle || 'targeting' });
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
        setIsInitialized(true);
    }, []);

    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem('nxq_settings', JSON.stringify(settings));
        }
    }, [settings, isInitialized]);

    const updateCursorStyle = (style: CursorStyle) => {
        setSettings(prev => ({ ...prev, cursorStyle: style }));
    };

    return (
        <SettingsContext.Provider value={{ settings, updateCursorStyle }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
