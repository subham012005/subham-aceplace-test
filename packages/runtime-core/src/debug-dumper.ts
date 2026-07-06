import * as fs from "fs";
import * as path from "path";
import { getDb } from "./db";

interface StepData {
  step_id: string;
  step_type: string;
  role: string;
  status: string;
  depends_on?: string[];
  input_ref?: any;
  output_ref?: any;
  created_at?: string;
  updated_at?: string;
  assigned_agent_id?: string;
}

export async function writeRealTimeDebugFile(envelopeId: string) {
  if (process.env.WRITE_DEBUG_FILE !== "true") {
    return;
  }
  try {
    const db = getDb();
    const envDoc = await db.collection("execution_envelopes").doc(envelopeId).get();
    if (!envDoc.exists) return;
    const envData = envDoc.data()!;
    const jobId = envData.job_id;
    if (!jobId) return;

    const jobDoc = await db.collection("jobs").doc(jobId).get();
    if (!jobDoc.exists) return;
    const jobData = jobDoc.data()!;

    // Fetch all artifacts for this envelope
    const artifactsSnap = await db.collection("artifacts")
      .where("execution_id", "==", envelopeId)
      .get();
    const artifactsMap = new Map<string, any>();
    artifactsSnap.docs.forEach(d => {
      artifactsMap.set(d.id, d.data());
    });

    // Fetch messages to trace #us# payloads
    const messagesSnap = await db.collection("execution_messages")
      .where("envelope_id", "==", envelopeId)
      .get();
    const messagesMap = new Map<string, any>();
    messagesSnap.docs.forEach(d => {
      const data = d.data();
      if (data.step_id) {
        messagesMap.set(data.step_id, data);
      }
    });

    const steps = (envData.steps || []) as StepData[];

    // Group steps by version
    const versionsMap = new Map<number, StepData[]>();

    const getStepVersion = (step: StepData): number => {
      const id = step.step_id;
      if (id.includes("_cont_")) {
        const match = id.match(/_cont_(\d+)_/);
        if (match) return parseInt(match[1]) + 1;
      }
      if (step.depends_on && step.depends_on.length > 0) {
        for (const depId of step.depends_on) {
          const depStep = steps.find(s => s.step_id === depId);
          if (depStep) {
            const depVer = getStepVersion(depStep);
            if (depVer > 1) return depVer;
          }
        }
      }
      return 1;
    };

    for (const step of steps) {
      const ver = getStepVersion(step);
      if (!versionsMap.has(ver)) {
        versionsMap.set(ver, []);
      }
      versionsMap.get(ver)!.push(step);
    }

    const sortedVersions = Array.from(versionsMap.keys()).sort((a, b) => a - b);

    // Retrieve continuation reasons from snapshots
    const versionsSnapshotSnap = await db.collection("jobs").doc(jobId).collection("artifact_versions").get();
    const continuationInfoMap = new Map<number, any>();
    versionsSnapshotSnap.docs.forEach(d => {
      const vNum = parseInt(d.id.replace("v", ""));
      continuationInfoMap.set(vNum + 1, d.data());
    });

    let txt = "";

    for (const ver of sortedVersions) {
      const verSteps = versionsMap.get(ver)!;

      txt += `version ${ver}\n`;

      let promptVal = "";
      if (ver === 1) {
        promptVal = jobData.prompt || envData.prompt || "";
        txt += `prompt : ${promptVal.trim()}\n`;
      } else {
        const contInfo = continuationInfoMap.get(ver) || {};
        const instruction = contInfo.continuation_instruction || jobData.continuation_reason || "Add detailed budget section";
        promptVal = envData.prompt || "";
        txt += `instruction: ${instruction.trim()}\n`;
        txt += `prompt : ${promptVal.trim()}\n`;
      }

      // Helper to format artifact output content
      const getStepOutput = (stepType: string): string => {
        const step = verSteps.find(s => s.step_type === stepType);
        if (!step) return "<not scheduled>";
        if (step.status === "pending" || step.status === "ready") return "<pending>";
        if (step.status === "executing") return "<executing>";
        if (step.status === "failed") return "<failed>";
        
        const artId = step.output_ref?.artifact_id || step.output_ref;
        if (artId && typeof artId === "string") {
          const art = artifactsMap.get(artId);
          return art?.artifact_content || "<empty>";
        }
        return "<no artifact generated>";
      };

      // COO
      txt += `coo input : ${promptVal.trim()}\n`;
      txt += `coo output : ${getStepOutput("plan").trim()}\n`;

      // Researcher
      const planOutput = getStepOutput("plan");
      txt += `researcher input : ${planOutput.startsWith("<") ? planOutput : planOutput.trim()}\n`;
      txt += `researcher output : ${getStepOutput("assign").trim()}\n`;

      // Worker (could be multiple parallel worker steps)
      const workerSteps = verSteps.filter(s => s.step_type === "produce_artifact" || s.step_type === "artifact_produce");
      if (workerSteps.length === 0) {
        txt += `worker input : <pending>\n`;
        txt += `worker output : <pending>\n`;
      } else {
        let workerInputs: string[] = [];
        let workerOutputs: string[] = [];
        for (let i = 0; i < workerSteps.length; i++) {
          const ws = workerSteps[i];
          const label = workerSteps.length > 1 ? ` [Part ${i + 1}]` : "";
          
          let wIn = "";
          const msg = messagesMap.get(ws.step_id);
          if (msg && msg.payload && msg.payload.work_unit) {
            const wu = msg.payload.work_unit;
            wIn = `Objective: ${wu.objective}\nInstructions: ${wu.instructions}`;
          } else {
            wIn = getStepOutput("assign");
          }
          workerInputs.push(`${label}\n${wIn.trim()}`);

          let wOut = "";
          if (ws.status === "pending" || ws.status === "ready") wOut = "<pending>";
          else if (ws.status === "executing") wOut = "<executing>";
          else if (ws.status === "failed") wOut = "<failed>";
          else {
            const artId = ws.output_ref?.artifact_id || ws.output_ref;
            if (artId && typeof artId === "string") {
              const art = artifactsMap.get(artId);
              wOut = art?.artifact_content || "<empty>";
            } else {
              wOut = "<no artifact generated>";
            }
          }
          workerOutputs.push(`${label}\n${wOut.trim()}`);
        }
        txt += `worker input : ${workerInputs.join("\n\n").trim()}\n`;
        txt += `worker output : ${workerOutputs.join("\n\n").trim()}\n`;
      }

      // Grader
      let graderInput = "";
      const workerOutputsReady = workerSteps.every(ws => ws.status === "completed");
      if (!workerOutputsReady) {
        graderInput = "<pending worker completion>";
      } else {
        const parts = workerSteps.map(ws => {
          const artId = ws.output_ref?.artifact_id || ws.output_ref;
          return artId ? (artifactsMap.get(artId)?.artifact_content || "") : "";
        });
        graderInput = parts.join("\n\n---\n\n");
      }
      txt += `grader input : ${graderInput.trim()}\n`;
      txt += `grader output : ${getStepOutput("evaluation").trim()}\n`;
      
      txt += "\n";
    }

    const outputFilePath = path.resolve(process.cwd(), "debug.txt");
    fs.writeFileSync(outputFilePath, txt, "utf8");
  } catch (e) {
    console.warn("[DEBUG-DUMPER] Failed to write real-time debug file:", e);
  }
}

export async function triggerJobDebugDump(envelopeId: string) {
  await writeRealTimeDebugFile(envelopeId);
}
