"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ABOUT_MD } from "./aboutMdContent";

export default function RawAboutMarkdown() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 font-mono text-sm border-t border-white/10 mt-16">
      <div className="mb-12">
        <span className="text-[10px] font-black tracking-[0.3em] text-purple-400 uppercase">
          RAW DOCUMENTATION
        </span>
        <h2 className="text-2xl font-black uppercase tracking-tight text-white mt-1 italic">
          Complete Specification
        </h2>
        <div className="h-[1px] bg-gradient-to-r from-purple-500/40 via-purple-500/10 to-transparent mt-3" />
      </div>

      <div className="prose prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ node, ...props }) => <h1 className="text-3xl font-black text-white uppercase mt-16 mb-6 tracking-tight italic" {...props} />,
            h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-cyan-400 uppercase mt-12 mb-4 tracking-widest text-[13px]" {...props} />,
            h3: ({ node, ...props }) => <h3 className="text-lg font-semibold text-purple-400 uppercase mt-8 mb-4 tracking-widest text-[11px]" {...props} />,
            p: ({ node, ...props }) => <p className="text-slate-300 leading-relaxed mb-6" {...props} />,
            ul: ({ node, ...props }) => <ul className="space-y-2 mb-8" {...props} />,
            li: ({ node, ...props }) => (
              <li className="flex items-start gap-2 text-slate-300" {...props}>
                <span className="text-cyan-500 mt-0.5 shrink-0">›</span>
                <span>{props.children}</span>
              </li>
            ),
            strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
            hr: ({ node, ...props }) => <hr className="border-t border-white/10 my-12" {...props} />,
            a: ({ node, ...props }) => <a className="text-cyan-400 hover:text-cyan-300 underline" {...props} />,
          }}
        >
          {ABOUT_MD}
        </ReactMarkdown>
      </div>
    </div>
  );
}
