// Pencil grading model is configurable: defaults to gemini-3.6-flash and
// honours window.StudyDashConfig.aiModel; the selected id appears in grading metadata.
import assert from "node:assert";
import { loadSync } from "./helpers/load-sync-runtime.mjs";

const IMG = "data:image/jpeg;base64," + "A".repeat(64);
function modelReturning(obj) { return { async generateContent() { return { response: { text: () => JSON.stringify(obj) } }; } }; }

// Default model when no runtime config is supplied.
{
  const { sync } = await loadSync({ pathname: "/history-p2/", localStorage: { histp2: "{}" } });
  const fail = await sync.gradePencil({ image: "nope", maxMarks: 3 }); // fail path carries model metadata
  assert.equal(fail.model, "gemini-3.6-flash", "default model is gemini-3.6-flash");

  sync._setPencilModel(modelReturning({ transcription: "ok", verdict: "correct", score: 3, maxMarks: 3, confidence: 0.95, humanReview: "not_needed", criteria: [{ label: "c", met: true, marks: 3 }], feedback: "" }));
  const ok = await sync.gradePencil({ image: IMG, maxMarks: 3, confidenceThreshold: 0.85 });
  assert.equal(ok.model, "gemini-3.6-flash", "success metadata reports the default model");
}

// Explicit runtime override via StudyDashConfig.aiModel.
{
  const { sync } = await loadSync({ pathname: "/history-p2/", localStorage: { histp2: "{}" }, StudyDashConfig: { aiModel: "gemini-3.5-flash-lite" } });
  const fail = await sync.gradePencil({ image: "nope", maxMarks: 3 });
  assert.equal(fail.model, "gemini-3.5-flash-lite", "override model flows into metadata");
}

console.log("pencil model config contract passed");
