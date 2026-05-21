import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY_COMPLETED = 'aceplace_tour_completed';
const STORAGE_KEY_STEP = 'aceplace_tour_step';

export function useProductTour() {
    const [isCompleted, setIsCompleted] = useState<boolean>(true);
    const [currentStep, setCurrentStep] = useState<number>(0);

    const refreshState = useCallback(() => {
        const completed = localStorage.getItem(STORAGE_KEY_COMPLETED) === 'true';
        const step = parseInt(localStorage.getItem(STORAGE_KEY_STEP) || '0', 10);
        
        setIsCompleted(completed);
        setCurrentStep(step);
    }, []);

    useEffect(() => {
        refreshState();

        // Sync if another tab/instance changes it
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY_COMPLETED || e.key === STORAGE_KEY_STEP) {
                refreshState();
            }
        };

        // Custom event for immediate sync in same tab
        const handleCustomSync = () => {
            refreshState();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('aceplace:tour-sync', handleCustomSync);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('aceplace:tour-sync', handleCustomSync);
        };
    }, [refreshState]);

    const markAsCompleted = useCallback(() => {
        localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
        localStorage.removeItem(STORAGE_KEY_STEP);
        setIsCompleted(true);
        window.dispatchEvent(new CustomEvent('aceplace:tour-sync'));
    }, []);

    const setStepProgress = useCallback((step: number) => {
        localStorage.setItem(STORAGE_KEY_STEP, step.toString());
        setCurrentStep(step);
        window.dispatchEvent(new CustomEvent('aceplace:tour-sync'));
    }, []);

    const restartTour = useCallback(() => {
        localStorage.setItem(STORAGE_KEY_COMPLETED, 'false');
        localStorage.setItem(STORAGE_KEY_STEP, '0');
        setIsCompleted(false);
        setCurrentStep(0);
        
        // Notify other instances and the tour engine
        window.dispatchEvent(new CustomEvent('aceplace:tour-sync'));
        window.dispatchEvent(new CustomEvent('aceplace:start-tour'));
    }, []);

    return {
        isCompleted,
        currentStep,
        markAsCompleted,
        setStepProgress,
        restartTour
    };
}
