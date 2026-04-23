"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

interface Settings {
    // Other settings can go here in the future
    isInitialized: boolean;
}

interface SettingsContextType {
    settings: Settings;
    isSettingsOpen: boolean;
    setIsSettingsOpen: (open: boolean) => void;
}

const defaultSettings: Settings = {
    isInitialized: false
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<Settings>(defaultSettings);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        setIsInitialized(true);
    }, []);

    return (
        <SettingsContext.Provider value={{ 
            settings: { ...settings, isInitialized },
            isSettingsOpen,
            setIsSettingsOpen
        }}>
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

