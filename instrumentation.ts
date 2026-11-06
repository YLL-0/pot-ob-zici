/**
 * Runs once when the Next.js server starts (dev and production). Reports
 * the routed-trail conditions from lib/traseDiagnoza.ts so a deployment
 * that would show only schematic lines says so in its logs. The Node-only
 * part lives in instrumentation-node.ts so the edge bundle never sees fs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
