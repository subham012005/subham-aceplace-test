import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Converts diverse job artifact/result structures into clean, structured Markdown.
 * Used for both UI rendering and professional PDF reports.
 */
export const formatOutputToMarkdown = (raw: any): string => {
    if (!raw) return "";
    
    // Handle string inputs (potentially double-encoded JSON)
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        // Strip markdown code fences wrapping JSON
        const stripped = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/i, '').trim();
        
        // If it looks like JSON, try to parse and recurse
        if ((stripped.startsWith('{') && stripped.endsWith('}')) || (stripped.startsWith('[') && stripped.endsWith(']'))) {
            try { 
                const parsed = JSON.parse(stripped);
                return formatOutputToMarkdown(parsed); 
            } catch { /* fall through to return raw string */ }
        }
        return raw;
    }
    
    if (typeof raw !== 'object') return String(raw);

    let md = "";
    
    // Determine sections first to check for duplicate summary
    const sections = raw.sections || 
                     raw.content?.sections || 
                     raw.report?.sections || 
                     raw.deliverable?.sections ||
                     (Array.isArray(raw.content) ? raw.content : null) ||
                     (Array.isArray(raw.report) ? raw.report : null);

    const hasSummarySection = Array.isArray(sections) && sections.some((s: any) =>
        String(s.title || s.header || s.name || s.section_title || "").toLowerCase().includes('summary')
    );

    // 1. Handle Executive Summary / Summary
    const summary = raw.deliverable_summary || raw.summary || raw.executive_summary || raw.overview || raw.plan_summary;
    if (summary && typeof summary === 'string' && !hasSummarySection) {
        md += `# Executive Summary\n\n${summary}\n\n`;
    }

    // 2. Handle Sections (Main body)
    if (sections && Array.isArray(sections)) {
        md += sections.map((s: any, i: number) => {
            if (typeof s === 'string') return s;
            const title = s.title || s.header || s.name || s.section_title || `Section ${i + 1}`;
            const body = s.body || s.content || s.text || s.description || "";
            return `## ${title}\n\n${body}\n\n`;
        }).join("\n");
        if (md) return md;
    }

    // 3. Handle key-value structures (Findings, Results, Steps)
    const title = raw.title || raw.header || raw.report_title;
    const details = raw.details || raw.description || raw.body || raw.strategic_objective || raw.objective;
    const findings = raw.findings || raw.results || raw.steps || raw.items || raw.conclusions || raw.assignments || raw.tasks;

    if (title || details || findings) {
        if (title && typeof title === 'string') md = `# ${title}\n\n` + md;
        if (details && typeof details === 'string') md += `${details}\n\n`;
        
        if (findings && Array.isArray(findings)) {
            const label = raw.findings ? "Key Findings" : (raw.results ? "Results" : (raw.steps ? "Execution Steps" : (raw.assignments ? "Assignments" : (raw.tasks ? "Tasks" : "Details"))));
            md += `### ${label}\n\n`;
            md += findings.map((item: any) => {
                if (typeof item === 'string') return `* ${item}`;
                if (typeof item === 'object') {
                    const itemTitle = item.title || item.label || item.name || item.heading || item.role;
                    const itemValue = item.body || item.content || item.value || item.description || item.text || item.task;
                    if (itemTitle && itemValue) return `* **${itemTitle}:** ${itemValue}`;
                    if (itemTitle) return `* **${itemTitle}**`;
                    if (itemValue) return `* ${itemValue}`;
                    return `* ${JSON.stringify(item)}`;
                }
                return `* ${String(item)}`;
            }).join("\n");
        }
        if (md) return md.trim();
    }

    // 4. Handle "content" as a direct string field (Common in many agent outputs)
    const contentVal = raw.content || raw.report || raw.text || raw.body || raw.markdown || raw.artifact_content;
    if (contentVal && typeof contentVal === 'string') {
        const trimmedContent = contentVal.trim();
        // Check if content itself is JSON
        if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
            return formatOutputToMarkdown(trimmedContent);
        }
        if (md && !md.endsWith('\n\n')) md += md.endsWith('\n') ? '\n' : '\n\n';
        md += trimmedContent;
        return md.trim();
    }

    // 5. Last resort: JSON block
    return "```json\n" + JSON.stringify(raw, null, 2) + "\n```";
};
