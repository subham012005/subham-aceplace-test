# ACEPLACE — Web Control Plane (`src/`)

Welcome to the **ACEPLACE Web Control Plane**. This directory contains the UI, User Management, and Governance components for the platform.

### Structure
- **app/**: Next.js App Router for the Dashboard and Authentication.
- **api/**: Control Plane APIs for task intake, telemetry lookup, and human governance.
- **components/**: React UI components (HUD/Sci-fi aesthetic).
- **hooks/**: Firestore real-time subscription hooks.
- **context/**: Application state management (Auth, Theme).

### 🛡️ Separation of Concerns
This directory is strictly for **enrollment, governance, and observation**. All execution-tier logic (the "how" of multi-agent tasks) resides in `apps/runtime-worker/`. 

This Control Plane interacts with the Execution Plane solely through Firestore via **Canonical Execution Envelopes**. It uses `@aceplace/runtime-core` for all shared types, constants, and state machine validation logic.

**No direct execution paths or worker claim logic are allowed in this directory.**
