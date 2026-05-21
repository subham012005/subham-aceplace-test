"use client";

import React, { useEffect, useRef } from 'react';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { productTourSteps } from './productTourSteps';
import { useProductTour } from '@/hooks/useProductTour';
import { usePathname, useRouter } from 'next/navigation';

export default function ProductTour() {
    const { isCompleted, currentStep, setStepProgress, markAsCompleted } = useProductTour();
    const driverObj = useRef<any>(null);
    const pathname = usePathname();
    const router = useRouter();

    // Initialize driver once
    useEffect(() => {
        driverObj.current = driver({
            showProgress: true,
            steps: productTourSteps as any,
            overlayColor: 'rgba(0, 0, 0, 0.85)',
            onHighlightStarted: (element, step) => {
                const stepIndex = productTourSteps.indexOf(step as any);
                if (stepIndex !== -1) {
                    setStepProgress(stepIndex);
                }
                
                // Handle pulsating for click actions
                const currentStepConfig = productTourSteps[stepIndex];
                if (currentStepConfig?.action === 'click' && element) {
                    element.classList.add('tour-pulsating');
                }
            },
            onDeselected: (element, step) => {
                if (element) {
                    element.classList.remove('tour-pulsating');
                }
            },
            onDestroyed: () => {
                const currentIndex = driverObj.current?.getActiveIndex();
                if (currentIndex !== undefined && currentIndex >= productTourSteps.length - 1) {
                    markAsCompleted();
                }
            },
            nextBtnText: 'Next Phase →',
            prevBtnText: '← Back',
            doneBtnText: 'Finish Mission',
        });

        return () => {
            if (driverObj.current) {
                driverObj.current.destroy();
            }
        };
    }, [markAsCompleted, setStepProgress]);

    // Handle auto-starting and resumption when route or state changes
    useEffect(() => {
        if (isCompleted) return;

        const step = productTourSteps[currentStep];
        if (!step) return;

        // Only auto-start/resume if we are on the correct route
        if (step.route && pathname !== step.route) return;

        const timer = setTimeout(() => {
            const element = document.querySelector(step.element as string);
            if (element && driverObj.current) {
                // If already driving the correct step, don't restart
                const activeIndex = driverObj.current.getActiveIndex();
                if (activeIndex !== currentStep) {
                    driverObj.current.drive(currentStep);
                }
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [isCompleted, currentStep, pathname]);

    // Listen for manual restart event
    useEffect(() => {
        const handleStartTour = () => {
            if (pathname !== '/dashboard') {
                router.push('/dashboard');
                // The auto-resume useEffect above will handle starting the tour
                // once the route changes and currentStep is reset to 0.
            } else {
                if (driverObj.current) {
                    driverObj.current.drive(0);
                }
            }
        };

        window.addEventListener('aceplace:start-tour', handleStartTour);
        return () => window.removeEventListener('aceplace:start-tour', handleStartTour);
    }, [pathname, router]);

    // This effect handles the "Click to next page" logic
    useEffect(() => {
        if (isCompleted || !driverObj.current) return;

        const handleGlobalClick = (e: MouseEvent) => {
            const activeIndex = driverObj.current.getActiveIndex();
            if (activeIndex === -1) return;

            const currentStepConfig = productTourSteps[activeIndex];
            
            // If the step expected a click and user clicked the target element
            if (currentStepConfig && currentStepConfig.action === 'click') {
                const target = document.querySelector(currentStepConfig.element as string);
                if (target && target.contains(e.target as Node)) {
                    // Close current driver so it doesn't conflict with navigation
                    driverObj.current.destroy();
                    // Progress will be saved by onHighlightStarted or we can set it here
                    setStepProgress(activeIndex + 1);
                }
            }
        };

        window.addEventListener('click', handleGlobalClick, true);
        return () => window.removeEventListener('click', handleGlobalClick, true);
    }, [isCompleted, setStepProgress]);

    return (
        <style jsx global>{`
            /* Custom Driver.js Styling to match ACEPLACE sci-fi aesthetic */
            .driver-popover {
                background: rgba(2, 6, 23, 0.9) !important;
                backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(6, 182, 212, 0.3) !important;
                color: #e2e8f0 !important;
                border-radius: 0 !important;
                box-shadow: 0 0 30px rgba(6, 182, 212, 0.1) !important;
                max-width: 320px !important;
                font-family: var(--font-sans, sans-serif) !important;
                padding: 20px !important;
                z-index: 100000 !important;
            }

            .driver-popover-title {
                font-size: 14px !important;
                font-weight: 900 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.1em !important;
                color: #06b6d4 !important;
                margin-bottom: 8px !important;
                font-style: italic !important;
            }

            .driver-popover-description {
                font-size: 12px !important;
                line-height: 1.6 !important;
                color: #94a3b8 !important;
                margin-bottom: 20px !important;
            }

            /* Highlight the "Action: ..." title differently */
            .driver-popover-title {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
            }

            .driver-popover-title:contains("Action:") {
                color: #fbbf24 !important; /* Amber for actions */
            }

            .driver-popover-progress-text {
                font-size: 10px !important;
                font-family: monospace !important;
                color: rgba(6, 182, 212, 0.5) !important;
                font-weight: bold !important;
            }

            .driver-popover-footer {
                margin-top: 15px !important;
                display: flex !important;
                gap: 8px !important;
            }

            .driver-popover-btn {
                background: rgba(255, 255, 255, 0.05) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                border-radius: 0 !important;
                color: #fff !important;
                font-size: 10px !important;
                font-weight: 800 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.05em !important;
                padding: 8px 12px !important;
                text-shadow: none !important;
                transition: all 0.2s ease !important;
            }

            .driver-popover-btn:hover {
                background: rgba(6, 182, 212, 0.1) !important;
                border: 1px solid rgba(6, 182, 212, 0.5) !important;
                color: #06b6d4 !important;
            }

            .driver-popover-next-btn {
                background: rgba(6, 182, 212, 0.1) !important;
                border: 1px solid rgba(6, 182, 212, 0.4) !important;
                color: #06b6d4 !important;
            }

            /* Show pulsar on elements requiring action */
            .driver-active-element {
                box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.3), 0 0 30px rgba(6, 182, 212, 0.4) !important;
                background: transparent !important;
                transition: box-shadow 0.5s ease !important;
            }
            
            /* Class applied by our custom logic when action === 'click' */
            .tour-pulsating {
                animation: tour-pulsar 1.5s infinite !important;
            }

            @keyframes tour-pulsar {
                0% { box-shadow: 0 0 0 0px rgba(6, 182, 212, 0.6); }
                50% { box-shadow: 0 0 0 15px rgba(6, 182, 212, 0.2); }
                100% { box-shadow: 0 0 0 30px rgba(6, 182, 212, 0); }
            }
        `}</style>
    );
}
