import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownReportProps {
    content: string;
    className?: string;
}

export function MarkdownReport({ content, className }: MarkdownReportProps) {
    if (!content) return null;

    return (
        <div className={cn("markdown-report space-y-4 text-slate-300 leading-relaxed", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ ...props }) => (
                        <div className="relative mb-8 mt-4 group">
                            <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-cyan-400 shadow-[0_0_15px_#22d3ee] rounded-full" />
                            <h1 className="text-3xl font-black uppercase tracking-[0.05em] text-cyan-400 leading-tight" {...props}>
                                {props.children}
                            </h1>
                            <div className="h-[1px] w-full bg-white/10 mt-6" />
                        </div>
                    ),
                    h2: ({ ...props }) => (
                        <h2 className="text-xl font-black uppercase tracking-widest text-slate-100 mt-12 mb-6 flex items-center gap-3 border-l-4 border-cyan-500/60 pl-4" {...props}>
                            {props.children}
                        </h2>
                    ),
                    h3: ({ ...props }) => (
                        <h3 className="text-lg font-bold text-slate-200 mt-8 mb-4" {...props} />
                    ),
                    p: ({ ...props }) => <p className="mb-6 text-slate-400 leading-relaxed text-[15px]" {...props} />,
                    strong: ({ ...props }) => <strong className="font-bold text-slate-200" {...props} />,
                    ul: ({ ...props }) => <ul className="list-none space-y-3 mb-8 ml-4" {...props} />,
                    li: ({ ...props }) => (
                        <li className="flex items-start gap-3 before:content-['—'] before:text-cyan-500/40 before:font-mono before:mt-1" {...props} />
                    ),
                    table: ({ ...props }) => (
                        <div className="overflow-x-auto my-8 border border-white/10 bg-black/40 backdrop-blur-sm rounded-sm">
                            <table className="w-full text-left text-sm border-collapse" {...props} />
                        </div>
                    ),
                    thead: ({ ...props }) => <thead className="bg-cyan-500/10 border-b border-cyan-500/30 font-mono text-[11px] uppercase tracking-wider text-cyan-400" {...props} />,
                    th: ({ ...props }) => <th className="px-4 py-3 font-bold" {...props} />,
                    td: ({ ...props }) => <td className="px-4 py-3 border-t border-white/5 text-slate-400" {...props} />,
                    blockquote: ({ ...props }) => (
                        <blockquote className="border-l-2 border-cyan-500/50 bg-cyan-500/5 px-4 py-2 my-4 italic text-slate-300" {...props} />
                    ),
                    code: ({ ...props }) => (
                        <code className="bg-slate-800/50 text-cyan-300 px-1.5 py-0.5 rounded font-mono text-[0.9em]" {...props} />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>

            <style jsx global>{`
                .markdown-report table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .markdown-report tr:hover {
                    background: rgba(6, 182, 212, 0.03);
                }
            `}</style>
        </div>
    );
}
