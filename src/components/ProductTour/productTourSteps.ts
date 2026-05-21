import { DriveStep } from "driver.js";

export interface InteractiveDriveStep extends DriveStep {
    route?: string; // The route this step should be on
    action?: 'click' | 'wait'; // Action to perform to get to next step
}

/**
 * Configure the steps for the ACEPLACE Product Tour.
 * To edit the tour, simply add, remove, or modify items in this array.
 */
export const productTourSteps: InteractiveDriveStep[] = [
    // --- DASHBOARD PHASE ---
    {
        route: '/dashboard',
        element: '#tour-logo',
        popover: {
            title: 'Welcome to ACEPLACE',
            description: 'This is your mission control. Let\'s get you oriented.',
            side: "bottom",
            align: 'start'
        }
    },
    {
        route: '/dashboard',
        element: '#tour-stats',
        popover: {
            title: 'System Telemetry',
            description: 'Track compute usage, costs, and agent events here.',
            side: "bottom",
            align: 'center'
        }
    },
    {
        route: '/dashboard',
        element: '#tour-system-config',
        popover: {
            title: 'Action: Open Config',
            description: '<div class="flex flex-col gap-2"><span>Click on <b>System Config</b> to access governance settings.</span><div class="mt-2 py-1 px-2 bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-black text-cyan-400 uppercase tracking-widest text-center animate-pulse">Waiting for User Click...</div></div>',
            side: "right",
            align: 'start',
            showButtons: ['close']
        },
        action: 'click' 
    },

    // --- SYSTEM CONFIG PHASE: INTERFACE ---
    {
        route: '/system-config',
        element: '#tour-config-title', 
        popover: {
            title: 'Governance Control',
            description: 'Welcome to System Config. Here you manage global parameters.',
            side: "bottom",
            align: 'start'
        }
    },
    {
        route: '/system-config',
        element: '#tour-identity-section',
        popover: {
            title: 'Identity Signature',
            description: 'Your unique cryptographic identity. You can copy this UID for licensing queries.',
            side: "top",
            align: 'center'
        }
    },
    {
        route: '/system-config',
        element: '#tour-providers-tab',
        popover: {
            title: 'Action: Providers',
            description: '<div class="flex flex-col gap-2"><span>Now, click the <b>Intelligence Providers</b> tab to configure your LLM backend.</span><div class="mt-2 py-1 px-2 bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-black text-cyan-400 uppercase tracking-widest text-center animate-pulse">Waiting for User Click...</div></div>',
            side: "bottom",
            align: 'center',
            showButtons: ['close']
        },
        action: 'click'
    },

    // --- SYSTEM CONFIG PHASE: PROVIDERS ---
    {
        route: '/system-config',
        element: '#tour-api-providers',
        popover: {
            title: 'API Providers',
            description: 'Assign your API keys (OpenAI, Anthropic, Gemini) here. ACEPLACE uses your own keys to drive autonomous agents.',
            side: "top",
            align: 'center'
        }
    },
    {
        route: '/system-config',
        element: '#tour-agent-assignment',
        popover: {
            title: 'Agent Role Assignment',
            description: 'Specify which LLM model handles each role: COO (Planner), Researcher, Worker, and Grader.',
            side: "top",
            align: 'center'
        }
    },
    {
        route: '/system-config',
        element: '#tour-save-config',
        popover: {
            title: 'Commit Changes',
            description: 'Once configured, use this button to secure your intelligence parameters to the blockchain/vault.',
            side: "top",
            align: 'center'
        }
    },
    {
        route: '/system-config',
        element: '#tour-knowledge-base',
        popover: {
            title: 'Action: Knowledge Base',
            description: '<div class="flex flex-col gap-2"><span>Next, let\'s manage your data. Click <b>Knowledge Base</b> in the sidebar.</span><div class="mt-2 py-1 px-2 bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-black text-cyan-400 uppercase tracking-widest text-center animate-pulse">Waiting for User Click...</div></div>',
            side: "right",
            align: 'start',
            showButtons: ['close']
        },
        action: 'click'
    },

    // --- KNOWLEDGE BASE PHASE: GRANULAR ---
    {
        route: '/dashboard/knowledge',
        element: '#tour-knowledge-stats',
        popover: {
            title: 'Intelligence Core',
            description: 'Review your total collections, instruction profiles, and context blocks here.',
            side: "bottom",
            align: 'center'
        }
    },
    {
        route: '/dashboard/knowledge',
        element: '#tour-kb-runtime',
        popover: {
            title: 'Runtime Context Injection',
            description: 'Primary override matrix. Information typed or saved as cards here directly influences immediate task execution with high priority.',
            side: "top",
            align: 'center'
        }
    },
    {
        route: '/dashboard/knowledge',
        element: '#tour-kb-sync',
        popover: {
            title: 'Sync to Session',
            description: 'Deploy your typed knowledge into the active session. This "arms" the context for the next agent dispatch.',
            side: "bottom",
            align: 'center'
        }
    },
    {
        route: '/dashboard/knowledge',
        element: '#tour-kb-repository',
        popover: {
            title: 'Document Repository',
            description: 'Manage persistent PDF/TXT document collections. ACEPLACE indexes these into vector space for long-term Retrieval Augmented Generation (RAG).',
            side: "top",
            align: 'center'
        }
    },
    {
        route: '/dashboard/knowledge',
        element: '#tour-kb-upload',
        popover: {
            title: 'Matrix Indexing Area',
            description: 'Upload technical documentation or research papers here. Our indexing engine will automatically transform them into context units for agent grounding.',
            side: "top",
            align: 'center'
        }
    },
    {
        route: '/dashboard/knowledge',
        element: '#tour-kb-protocols',
        popover: {
            title: 'Protocol Modules',
            description: 'Define behavioral profiles (System Instructions) and monitor the status of the always-active Web Search engine for autonomous verification.',
            side: "top",
            align: 'center'
        }
    },
    {
        route: '/dashboard/knowledge',
        element: '#tour-task-composer',
        popover: {
            title: 'Action: Compose Task',
            description: '<div class="flex flex-col gap-2"><span>Final step: click <b>Task Composer</b> to dispatch your first agent.</span><div class="mt-2 py-1 px-2 bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-black text-cyan-400 uppercase tracking-widest text-center animate-pulse">Waiting for User Click...</div></div>',
            side: "right",
            align: 'start',
            showButtons: ['close']
        },
        action: 'click'
    },

    // --- TASK COMPOSER PHASE ---
    {
        route: '/dashboard/composer',
        element: '#tour-composer-telemetry',
        popover: {
            title: 'Mission Telemetry',
            description: 'Monitor real-time link status, encryption strength (RSA 4096), and connection latency before dispatching.',
            side: "bottom",
            align: 'center'
        }
    },
    {
        route: '/dashboard/composer',
        element: '#tour-composer-input',
        popover: {
            title: 'Command Sequence',
            description: 'Type your mission objective here. The more detailed your instructions, the more precise the autonomous orchestration will be.',
            side: "top",
            align: 'center'
        }
    },
    {
        route: '/dashboard/composer',
        element: '#tour-composer-guidance',
        popover: {
            title: 'Strategic Guidance',
            description: 'Understand that parameters are non-blocking. The COO agent will autonomously manage Researchers and Workers based on your intent.',
            side: "top",
            align: 'center'
        }
    },
    {
        route: '/dashboard/composer',
        element: '#tour-composer-submit',
        popover: {
            title: 'Launch Sequence',
            description: 'Click this button to launch your mission. You will be redirected to the real-time job trace environment.',
            side: "top",
            align: 'center'
        }
    }
];
