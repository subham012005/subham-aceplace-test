import React from "react";
import { cn } from "@/lib/utils";
import { MarkdownReport } from "./MarkdownReport";
import { Cpu, Search, Target, Activity, FileText } from "lucide-react";

interface DeliverableItemProps {
    title?: string;
    subtitle?: string;
    content: string | object;
    type?: 'plan' | 'research' | 'final' | 'default';
    icon?: React.ElementType;
    findings?: any[];
    sources?: any[];
    className?: string;
}

export function DeliverableItem({ 
    title, 
    subtitle, 
    content, 
    type = 'default', 
    icon: Icon,
    findings,
    sources,
    className 
}: DeliverableItemProps) {
    
    // Determine theme colors and icon based on type
    const themes = {
        plan: { color: 'text-cyan-400', border: 'border-cyan-500/20', bg: 'bg-cyan-500/5', defaultIcon: Activity },
        research: { color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/5', defaultIcon: Search },
        final: { color: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/5', defaultIcon: FileText },
        default: { color: 'text-slate-400', border: 'border-white/10', bg: 'bg-white/5', defaultIcon: Cpu }
    };
    
    const theme = themes[type] || themes.default;
    const EffectiveIcon = Icon || theme.defaultIcon;

    // Helper to safely parse and extract content
    const prepareContent = (raw: any) => {
        let data = raw;
        if (typeof raw === 'string') {
            try {
                // Try to parse if it looks like JSON
                if (raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
                    data = JSON.parse(raw);
                }
            } catch (e) {
                return { text: raw, findings: findings || [], sources: sources || [] };
            }
        }

        if (typeof data === 'object' && data !== null) {
            // Handle common agent output wrappers
            const text = data.intelligence_summary || 
                        data.research_summary || 
                        data.summary || 
                        data.analysis || 
                        data.plan_summary || 
                        data.content ||
                        (typeof data.final_output === 'object' ? data.final_output.content : data.final_output) ||
                        JSON.stringify(data, null, 2);
            
            const extraFindings = data.findings || data.steps || data.supporting_points || [];
            const extraSources = data.sources || [];
            
            return { 
                text: String(text), 
                findings: [...(findings || []), ...(Array.isArray(extraFindings) ? extraFindings : [])],
                sources: [...(sources || []), ...(Array.isArray(extraSources) ? extraSources : [])]
            };
        }

        return { text: String(data), findings: findings || [], sources: sources || [] };
    };

    const { text, findings: finalFindings, sources: finalSources } = prepareContent(content);

    return (
        <div className={cn("space-y-4", className)}>
            <div className={cn(
                "p-6 border rounded-sm relative overflow-hidden transition-all hover:bg-opacity-10",
                theme.border,
                theme.bg
            )}>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <EffectiveIcon className="w-16 h-16" />
                </div>
                
                <div className="relative space-y-4">
                    {/* Header */}
                    {(title || subtitle) && (
                        <div className="border-b border-white/10 pb-4 mb-4">
                            {subtitle && (
                                <span className={cn("text-[9px] uppercase font-bold tracking-widest block mb-1", theme.color)}>
                                    {subtitle}
                                </span>
                            )}
                            {title && (
                                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <EffectiveIcon className={cn("w-5 h-5", theme.color)} />
                                    {title}
                                </h3>
                            )}
                        </div>
                    )}

                    {/* Primary Content (Markdown) */}
                    <MarkdownReport content={text} className="text-sm" />

                    {/* Findings Grid (Research-style) */}
                    {finalFindings && finalFindings.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                            {finalFindings.map((item, idx) => (
                                <div key={idx} className="p-4 bg-white/5 border border-white/10 scifi-clip hover:bg-white/10 transition-colors group">
                                    <h4 className={cn("text-[10px] font-black mb-2 uppercase tracking-wide flex items-center gap-2", theme.color)}>
                                        <Target className="w-3 h-3" />
                                        {item.title || item.id || `Finding ${idx + 1}`}
                                    </h4>
                                    <p className="text-xs text-slate-300 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                                        {item.detail || item.summary || (typeof item === 'object' ? (item.task || JSON.stringify(item)) : String(item))}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Sources (Footer) */}
                    {finalSources && finalSources.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-white/5 opacity-60">
                            {finalSources.map((src, idx) => {
                                const srcText = typeof src === 'object' ? (src.title || src.url || JSON.stringify(src)) : String(src);
                                return (
                                    <span key={idx} className="px-2 py-1 bg-white/5 text-[9px] text-slate-500 font-mono border border-white/10 italic truncate max-w-[200px]" title={String(srcText)}>
                                        REF: {String(srcText)}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
