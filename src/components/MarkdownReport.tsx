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
                        <h1 className="text-xl font-black uppercase tracking-[0.2em] text-cyan-400 border-b border-cyan-500/30 pb-2 mb-6 mt-8 flex items-center gap-3" {...props}>
                            <span className="w-1.5 h-6 bg-cyan-500 shadow-[0_0_10px_#22d3ee]" />
                            {props.children}
                        </h1>
                    ),
                    h2: ({ ...props }) => (
                        <h2 className="text-lg font-bold uppercase tracking-widest text-cyan-200/90 mt-8 mb-4 flex items-center gap-2" {...props}>
                            <span className="w-1 h-4 bg-cyan-500/50" />
                            {props.children}
                        </h2>
                    ),
                    h3: ({ ...props }) => (
                        <h3 className="text-md font-semibold text-slate-100 mt-6 mb-3" {...props} />
                    ),
                    p: ({ ...props }) => <p className="mb-4 text-slate-400/90" {...props} />,
                    ul: ({ ...props }) => <ul className="list-none space-y-2 mb-6 ml-4" {...props} />,
                    li: ({ ...props }) => (
                        <li className="flex items-start gap-2 before:content-['>'] before:text-cyan-500/60 before:font-mono before:text-[10px] before:mt-1.5" {...props} />
                    ),
                    table: ({ ...props }) => (
                        <div className="overflow-x-auto my-8 border border-white/5 bg-white/[0.02] backdrop-blur-sm rounded-sm">
                            <table className="w-full text-left text-sm border-collapse" {...props} />
                        </div>
                    ),
                    thead: ({ ...props }) => <thead className="bg-cyan-500/10 border-b border-cyan-500/30 font-mono text-[10px] uppercase tracking-wider text-cyan-400" {...props} />,
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
