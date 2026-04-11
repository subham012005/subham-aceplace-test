/**
 * Roll up raw telemetry_events into telemetry_rollups (ACEPLACE spec).
 */
export declare function aggregateTelemetryWindow(params: {
    window_start: string;
    window_end: string;
}): Promise<{
    rollup_id: string;
}>;
//# sourceMappingURL=aggregateTelemetryWindow.d.ts.map