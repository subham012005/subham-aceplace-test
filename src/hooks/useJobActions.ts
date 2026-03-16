import { useState, useCallback } from "react";
import { nxqApi } from "@/lib/api-client";
import { incrementUserRequestCount } from "@/lib/user-stats";
import { auth } from "@/lib/firebase";

export function useJobActions() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const approveJob = useCallback(async (jobId: string, onOptimistic?: () => void) => {
        setIsProcessing(true);
        setError(null);
        if (onOptimistic) onOptimistic();
        try {
            await nxqApi.approveJob(jobId);
            const userId = auth.currentUser?.uid;
            if (userId) await incrementUserRequestCount(userId);
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const rejectJob = useCallback(async (jobId: string, reason: string, onOptimistic?: () => void) => {
        setIsProcessing(true);
        setError(null);
        if (onOptimistic) onOptimistic();
        try {
            await nxqApi.rejectJob(jobId, reason);
            const userId = auth.currentUser?.uid;
            if (userId) await incrementUserRequestCount(userId);
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const resurrectJob = useCallback(async (jobId: string, reason: string, onOptimistic?: () => void) => {
        setIsProcessing(true);
        setError(null);
        if (onOptimistic) onOptimistic();
        try {
            await nxqApi.resurrectJob(jobId, reason);
            const userId = auth.currentUser?.uid;
            if (userId) await incrementUserRequestCount(userId);
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const simulateFork = useCallback(async (data: { job_id: string, identity_id: string, attempted_by: string, reason: string }) => {
        setIsProcessing(true);
        setError(null);
        try {
            await nxqApi.simulateFork(data);
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return {
        approveJob,
        rejectJob,
        resurrectJob,
        simulateFork,
        isProcessing,
        error,
        clearError
    };
}
