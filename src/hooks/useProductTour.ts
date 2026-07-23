import { useState, useCallback, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

const STORAGE_KEY_COMPLETED = 'aceplace_tour_completed';
const STORAGE_KEY_STEP = 'aceplace_tour_step';

export function useProductTour() {
    const { user } = useAuth();
    const [isCompleted, setIsCompleted] = useState<boolean>(true);
    const [currentStep, setCurrentStep] = useState<number>(0);
    
    const userUid = user?.uid;

    const refreshState = useCallback(async () => {
        // Fallback to local storage
        let completed = localStorage.getItem(STORAGE_KEY_COMPLETED) === 'true';
        let step = parseInt(localStorage.getItem(STORAGE_KEY_STEP) || '0', 10);

        // If user is logged in, fetch from Firestore
        if (userUid) {
            try {
                const tourRef = doc(db, 'users', userUid, 'preferences', 'tour');
                const tourDoc = await getDoc(tourRef);
                
                if (tourDoc.exists()) {
                    const data = tourDoc.data();
                    completed = data.isCompleted ?? completed;
                    step = data.currentStep ?? step;

                    // Sync local storage to match DB
                    localStorage.setItem(STORAGE_KEY_COMPLETED, completed.toString());
                    localStorage.setItem(STORAGE_KEY_STEP, step.toString());
                } else {
                    // Initialize the document if it doesn't exist
                    await setDoc(tourRef, { isCompleted: completed, currentStep: step }, { merge: true });
                }
            } catch (error) {
                console.error("Error fetching product tour state from Firestore:", error);
            }
        }
        
        setIsCompleted(completed);
        setCurrentStep(step);
    }, [userUid]);

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

    const markAsCompleted = useCallback(async () => {
        localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
        localStorage.removeItem(STORAGE_KEY_STEP);
        setIsCompleted(true);
        window.dispatchEvent(new CustomEvent('aceplace:tour-sync'));

        if (userUid) {
            try {
                const tourRef = doc(db, 'users', userUid, 'preferences', 'tour');
                await setDoc(tourRef, { isCompleted: true }, { merge: true });
            } catch (error) {
                console.error("Error saving product tour completion to Firestore:", error);
            }
        }
    }, [userUid]);

    const setStepProgress = useCallback(async (step: number) => {
        localStorage.setItem(STORAGE_KEY_STEP, step.toString());
        setCurrentStep(step);
        window.dispatchEvent(new CustomEvent('aceplace:tour-sync'));

        if (userUid) {
            try {
                const tourRef = doc(db, 'users', userUid, 'preferences', 'tour');
                await setDoc(tourRef, { currentStep: step }, { merge: true });
            } catch (error) {
                console.error("Error saving product tour step to Firestore:", error);
            }
        }
    }, [userUid]);

    const restartTour = useCallback(async () => {
        localStorage.setItem(STORAGE_KEY_COMPLETED, 'false');
        localStorage.setItem(STORAGE_KEY_STEP, '0');
        setIsCompleted(false);
        setCurrentStep(0);
        
        if (userUid) {
            try {
                const tourRef = doc(db, 'users', userUid, 'preferences', 'tour');
                await setDoc(tourRef, { isCompleted: false, currentStep: 0 }, { merge: true });
            } catch (error) {
                console.error("Error restarting product tour in Firestore:", error);
            }
        }

        // Notify other instances and the tour engine
        window.dispatchEvent(new CustomEvent('aceplace:tour-sync'));
        window.dispatchEvent(new CustomEvent('aceplace:start-tour'));
    }, [userUid]);

    return {
        isCompleted,
        currentStep,
        markAsCompleted,
        setStepProgress,
        restartTour
    };
}
