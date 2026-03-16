"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { gsap } from 'gsap';
import { useSettings } from '@/context/SettingsContext';
import './TargetCursor.css';

interface TargetCursorProps {
    targetSelector?: string;
    spinDuration?: number;
    hideDefaultCursor?: boolean;
    hoverDuration?: number;
    parallaxOn?: boolean;
}

const TargetCursor = ({
    targetSelector = '.cursor-target, button, a, [role="button"], [role="tab"], input, select, textarea, .cursor-pointer, label',
    spinDuration = 2,
    hideDefaultCursor = true,
    hoverDuration = 0.2,
    parallaxOn = true
}: TargetCursorProps) => {
    const { settings } = useSettings();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isTargeting = settings.cursorStyle === 'targeting';
    const cursorRef = useRef<HTMLDivElement>(null);
    const cornersRef = useRef<NodeListOf<HTMLElement> | null>(null);
    const spinTl = useRef<gsap.core.Timeline | null>(null);
    const dotRef = useRef<HTMLDivElement>(null);

    const isActiveRef = useRef(false);
    const targetCornerPositionsRef = useRef<{ x: number; y: number }[] | null>(null);
    const tickerFnRef = useRef<(() => void) | null>(null);
    const activeStrengthRef = useRef(0);

    const isMobile = useMemo(() => {
        if (typeof window === 'undefined') return false;
        const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth <= 768;
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
        const isMobileUserAgent = mobileRegex.test(userAgent.toLowerCase());
        return (hasTouchScreen && isSmallScreen) || isMobileUserAgent;
    }, []);

    const constants = useMemo(
        () => ({
            borderWidth: 3,
            cornerSize: 12
        }),
        []
    );

    const moveCursor = useCallback((x: number, y: number) => {
        if (!cursorRef.current) return;
        gsap.to(cursorRef.current, {
            x,
            y,
            duration: 0.1,
            ease: 'power3.out'
        });
    }, []);

    useEffect(() => {
        if (isMobile || !cursorRef.current) return;

        const originalCursor = document.body.style.cursor;
        if (hideDefaultCursor && isTargeting) {
            document.documentElement.classList.add('hide-cursor-global');
            document.body.style.cursor = 'none';
        } else {
            document.documentElement.classList.remove('hide-cursor-global');
            document.body.style.cursor = 'default';
        }

        const cursor = cursorRef.current;
        cornersRef.current = cursor.querySelectorAll('.target-cursor-corner');

        let activeTarget: HTMLElement | null = null;
        let currentLeaveHandler: (() => void) | null = null;
        let resumeTimeout: NodeJS.Timeout | null = null;

        const cleanupTarget = (target: HTMLElement) => {
            if (currentLeaveHandler) {
                target.removeEventListener('mouseleave', currentLeaveHandler);
            }
            currentLeaveHandler = null;
        };

        gsap.set(cursor, {
            xPercent: -50,
            yPercent: -50,
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
        });

        const createSpinTimeline = () => {
            if (spinTl.current) {
                spinTl.current.kill();
            }
            spinTl.current = gsap
                .timeline({ repeat: -1 })
                .to(cursor, { rotation: '+=360', duration: spinDuration, ease: 'none' });
        };

        createSpinTimeline();

        const tickerFn = () => {
            if (!activeTarget || !cursorRef.current || !cornersRef.current) {
                return;
            }

            // Safety check: if the target is no longer in the DOM, release the cursor
            if (!activeTarget.isConnected) {
                if (currentLeaveHandler) {
                    currentLeaveHandler();
                }
                return;
            }

            const strength = activeStrengthRef.current;
            if (strength === 0) return;

            const cursorX = gsap.getProperty(cursorRef.current, 'x') as number;
            const cursorY = gsap.getProperty(cursorRef.current, 'y') as number;

            const rect = activeTarget.getBoundingClientRect();
            const { borderWidth, cornerSize } = constants;
            const targetCorners = [
                { x: rect.left - borderWidth, y: rect.top - borderWidth },
                { x: rect.right + borderWidth - cornerSize, y: rect.top - borderWidth },
                { x: rect.right + borderWidth - cornerSize, y: rect.bottom + borderWidth - cornerSize },
                { x: rect.left - borderWidth, y: rect.bottom + borderWidth - cornerSize }
            ];

            const corners = Array.from(cornersRef.current);
            corners.forEach((corner, i) => {
                const currentX = gsap.getProperty(corner, 'x') as number;
                const currentY = gsap.getProperty(corner, 'y') as number;

                const targetX = targetCorners[i].x - cursorX;
                const targetY = targetCorners[i].y - cursorY;

                const finalX = currentX + (targetX - currentX) * strength;
                const finalY = currentY + (targetY - currentY) * strength;

                gsap.set(corner, {
                    x: finalX,
                    y: finalY
                });
            });
        };

        tickerFnRef.current = tickerFn;

        const moveHandler = (e: MouseEvent) => moveCursor(e.clientX, e.clientY);
        window.addEventListener('mousemove', moveHandler);

        const scrollHandler = () => {
            if (!activeTarget || !cursorRef.current) return;
            const mouseX = gsap.getProperty(cursorRef.current, 'x') as number;
            const mouseY = gsap.getProperty(cursorRef.current, 'y') as number;
            const elementUnderMouse = document.elementFromPoint(mouseX, mouseY);
            const isStillOverTarget =
                elementUnderMouse &&
                (elementUnderMouse === activeTarget || (elementUnderMouse as HTMLElement).closest(targetSelector) === activeTarget);
            if (!isStillOverTarget) {
                if (currentLeaveHandler) {
                    currentLeaveHandler();
                }
            }
        };
        window.addEventListener('scroll', scrollHandler, { passive: true });

        const mouseDownHandler = () => {
            if (!dotRef.current) return;
            gsap.to(dotRef.current, { scale: 0.7, duration: 0.3 });
            gsap.to(cursorRef.current, { scale: 0.9, duration: 0.2 });
        };

        const mouseUpHandler = () => {
            if (!dotRef.current) return;
            gsap.to(dotRef.current, { scale: 1, duration: 0.3 });
            gsap.to(cursorRef.current, { scale: 1, duration: 0.2 });
        };

        window.addEventListener('mousedown', mouseDownHandler);
        window.addEventListener('mouseup', mouseUpHandler);

        const enterHandler = (e: MouseEvent) => {
            const directTarget = e.target as Element;
            const target = directTarget.closest ? directTarget.closest(targetSelector) as HTMLElement : null;
            if (!target || !cursorRef.current || !cornersRef.current) return;
            if (activeTarget === target) return;
            if (activeTarget) {
                cleanupTarget(activeTarget);
            }
            if (resumeTimeout) {
                clearTimeout(resumeTimeout);
                resumeTimeout = null;
            }

            activeTarget = target;
            const corners = Array.from(cornersRef.current);
            corners.forEach(corner => gsap.killTweensOf(corner));

            gsap.killTweensOf(cursorRef.current, 'rotation');
            spinTl.current?.pause();
            gsap.set(cursorRef.current, { rotation: 0 });

            isActiveRef.current = true;
            gsap.ticker.add(tickerFnRef.current!);

            gsap.to(activeStrengthRef, {
                current: 1,
                duration: hoverDuration,
                ease: 'power2.out'
            });

            const leaveHandler = () => {
                if (tickerFnRef.current) gsap.ticker.remove(tickerFnRef.current);

                isActiveRef.current = false;
                targetCornerPositionsRef.current = null;
                gsap.set(activeStrengthRef, { current: 0, overwrite: true });
                activeTarget = null;

                if (cornersRef.current) {
                    const corners = Array.from(cornersRef.current);
                    gsap.killTweensOf(corners);
                    const { cornerSize } = constants;
                    const positions = [
                        { x: -cornerSize * 1.5, y: -cornerSize * 1.5 },
                        { x: cornerSize * 0.5, y: -cornerSize * 1.5 },
                        { x: cornerSize * 0.5, y: cornerSize * 0.5 },
                        { x: -cornerSize * 1.5, y: cornerSize * 0.5 }
                    ];
                    const tl = gsap.timeline();
                    corners.forEach((corner, index) => {
                        tl.to(
                            corner,
                            {
                                x: positions[index].x,
                                y: positions[index].y,
                                duration: 0.3,
                                ease: 'power3.out'
                            },
                            0
                        );
                    });
                }

                resumeTimeout = setTimeout(() => {
                    if (!activeTarget && cursorRef.current && spinTl.current) {
                        const currentRotation = gsap.getProperty(cursorRef.current, 'rotation') as number;
                        const normalizedRotation = currentRotation % 360;
                        spinTl.current.kill();
                        spinTl.current = gsap
                            .timeline({ repeat: -1 })
                            .to(cursorRef.current, { rotation: '+=360', duration: spinDuration, ease: 'none' });
                        gsap.to(cursorRef.current, {
                            rotation: normalizedRotation + 360,
                            duration: spinDuration * (1 - normalizedRotation / 360),
                            ease: 'none',
                            onComplete: () => {
                                spinTl.current?.restart();
                            }
                        });
                    }
                    resumeTimeout = null;
                }, 50);

                if (target) cleanupTarget(target);
            };

            currentLeaveHandler = leaveHandler;
            target.addEventListener('mouseleave', leaveHandler);
        };

        window.addEventListener('mouseover', enterHandler, { passive: true });

        return () => {
            if (tickerFnRef.current) {
                gsap.ticker.remove(tickerFnRef.current);
            }

            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseover', enterHandler);
            window.removeEventListener('scroll', scrollHandler);
            window.removeEventListener('mousedown', mouseDownHandler);
            window.removeEventListener('mouseup', mouseUpHandler);

            if (activeTarget) {
                cleanupTarget(activeTarget);
            }

            spinTl.current?.kill();
            document.documentElement.classList.remove('hide-cursor-global');
            document.body.style.cursor = originalCursor;

            isActiveRef.current = false;
            targetCornerPositionsRef.current = null;
            activeStrengthRef.current = 0;
        };
    }, [targetSelector, spinDuration, moveCursor, constants, hideDefaultCursor, isMobile, hoverDuration, parallaxOn, isTargeting]);

    useEffect(() => {
        if (isMobile || !cursorRef.current || !spinTl.current) return;
        if (spinTl.current.isActive()) {
            spinTl.current.kill();
            spinTl.current = gsap
                .timeline({ repeat: -1 })
                .to(cursorRef.current, { rotation: '+=360', duration: spinDuration, ease: 'none' });
        }
    }, [spinDuration, isMobile]);

    if (!mounted || isMobile || !isTargeting) {
        return null;
    }

    return (
        <div ref={cursorRef} className="target-cursor-wrapper">
            <div ref={dotRef} className="target-cursor-dot" />
            <div className="target-cursor-corner corner-tl" />
            <div className="target-cursor-corner corner-tr" />
            <div className="target-cursor-corner corner-br" />
            <div className="target-cursor-corner corner-bl" />
        </div>
    );
};

export default TargetCursor;
