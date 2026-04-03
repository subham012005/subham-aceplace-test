"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AceWaveformProps {
    isSpeaking?: boolean;
    className?: string;
}

interface ThreadConfig {
    id: number;
    phase: number;
    baseAmplitude: number;
    frequency: number;
    speed: number;
    opacity: number;
    particleXPositions: number[];
}

export const AceWaveform: React.FC<AceWaveformProps> = ({ isSpeaking = false, className }) => {
    const [threads, setThreads] = useState<ThreadConfig[]>([]);
    const pathRefs = useRef<(SVGPathElement | null)[]>([]);
    const particleRefs = useRef<(SVGCircleElement | null)[][]>([]);
    const requestRef = useRef<number>(null);
    const phaseRef = useRef<number[]>([]);

    useEffect(() => {
        // Initialize 8 threads with unique parameters
        const newThreads: ThreadConfig[] = Array.from({ length: 8 }).map((_, i) => ({
            id: i,
            phase: (i * 180) / 8, // Distributed initial phases
            baseAmplitude: 0.8 + Math.random() * 0.4,
            frequency: 1.2 + Math.random() * 0.6,
            speed: 0.02 + Math.random() * 0.01,
            opacity: 0.3 + Math.random() * 0.4,
            particleXPositions: Array.from({ length: 3 }).map(() => 10 + Math.random() * 80), // Randomized x between 10-90
        }));

        setThreads(newThreads);
        phaseRef.current = newThreads.map(t => t.phase);
        particleRefs.current = Array.from({ length: 8 }).map(() => []);
    }, []);

    useEffect(() => {
        const animate = (time: number) => {
            threads.forEach((thread, i) => {
                const pathEl = pathRefs.current[i];
                if (!pathEl) return;

                // Update phase for horizontal flow
                const speedMult = isSpeaking ? 1.15 : 1.0;
                phaseRef.current[i] += thread.speed * speedMult * 80; // Doubled scaling factor for faster movement

                // Generate path with static amplitude envelope
                const steps = 60;
                let d = "";
                const currentAmp = isSpeaking ? 0.15 : 0.02; // Peak amplitude %

                for (let j = 0; j <= steps; j++) {
                    const x = (j * 100) / steps;
                    const envelope = Math.sin((Math.PI * x) / 100);
                    const radians = (2 * Math.PI * thread.frequency * x) / 100 + (phaseRef.current[i] * Math.PI) / 180;
                    const y = 50 + (currentAmp * thread.baseAmplitude * Math.sin(radians) * envelope * 100);
                    if (j === 0) d += `M ${x} ${y}`;
                    else d += ` L ${x} ${y}`;
                }
                pathEl.setAttribute("d", d);

                // Update particles along the path using their unique x-positions
                const particles = particleRefs.current[i];
                if (particles && thread.particleXPositions) {
                    particles.forEach((part, pIdx) => {
                        if (!part || thread.particleXPositions[pIdx] === undefined) return;
                        const px = thread.particleXPositions[pIdx];
                        const pEnvelope = Math.sin((Math.PI * px) / 100);
                        const pRadians = (2 * Math.PI * thread.frequency * px) / 100 + (phaseRef.current[i] * Math.PI) / 180;
                        const py = 50 + (currentAmp * thread.baseAmplitude * Math.sin(pRadians) * pEnvelope * 100);
                        part.setAttribute("cx", px.toString());
                        part.setAttribute("cy", py.toString());
                        part.setAttribute("opacity", (isSpeaking ? 0.8 : 0.2).toString());
                    });
                }
            });

            requestRef.current = requestAnimationFrame(animate);
        };

        if (threads.length > 0) {
            requestRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [threads, isSpeaking]);

    return (
        <div className={cn("relative flex items-center justify-center overflow-hidden rounded-full", className)}>
            {/* Background Depth Gradient */}
            <div className="absolute inset-0 bg-radial-gradient from-cyan-900/10 to-transparent opacity-60" />

            {/* Outer Circle Border */}
            <div className={cn(
                "absolute inset-0 rounded-full border transition-all duration-700",
                isSpeaking
                    ? "border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.2)] scale-100 opacity-100"
                    : "border-cyan-500/20 scale-100 opacity-100"
            )} />

            {/* Pulsing Background Aura */}
            <div className={cn(
                "absolute inset-4 rounded-full blur-[40px] transition-all duration-1000",
                isSpeaking ? "bg-cyan-400/15 opacity-80" : "bg-cyan-500/5 opacity-0"
            )} />

            <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 overflow-visible">
                <g className="text-cyan-400">
                    {threads.map((thread, i) => (
                        <g key={thread.id}>
                            <path
                                ref={(el) => { pathRefs.current[i] = el; }}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={isSpeaking ? "1.6" : "1.2"}
                                strokeLinecap="round"
                                style={{
                                    opacity: isSpeaking ? thread.opacity : thread.opacity * 0.3,
                                    transition: "stroke-width 1s ease-in-out, opacity 1s ease-in-out",
                                    filter: isSpeaking ? `drop-shadow(0 0 8px rgba(34, 211, 238, 0.3))` : "none",
                                }}
                            />
                            {/* Particles along the path using unique positions */}
                            {thread.particleXPositions?.map((_, pIdx) => (
                                <circle
                                    key={pIdx}
                                    ref={(el) => {
                                        if (!particleRefs.current[i]) particleRefs.current[i] = [];
                                        particleRefs.current[i][pIdx] = el;
                                    }}
                                    r="1.2"
                                    fill="currentColor"
                                />
                            ))}
                        </g>
                    ))}
                </g>
            </svg>

            <style jsx>{`
                .bg-radial-gradient {
                    background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 70%);
                }
            `}</style>
        </div>
    );
};
