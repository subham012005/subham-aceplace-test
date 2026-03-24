"""
graph/pipeline.py — DEPRECATED in Phase 2

The LangGraph pipeline (COO → Researcher → Worker → Grader) has been
replaced by the envelope-driven runtime loop in graph/runtime_loop.py.

This file is kept for reference only. Do NOT import from this module.
"""

# Phase 2 Note:
# The hardcoded LangGraph pipeline has been removed.
# Use graph.runtime_loop.run_envelope(envelope_id, instance_id) instead.
#
# The runtime loop reads steps from execution_envelopes.steps[] and
# dispatches to the appropriate agent node based on step_type.

raise ImportError(
    "graph.pipeline is deprecated in Phase 2. "
    "Use graph.runtime_loop.run_envelope() instead."
)
