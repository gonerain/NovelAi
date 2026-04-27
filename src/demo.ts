import { formatV1RunResult } from "./v1-formatters.js";
import { defaultDemoProjectId, runV1 } from "./v1-lib.js";

async function main(): Promise<void> {
  const result = await runV1({
    projectId: defaultDemoProjectId,
    mode: "chapter",
    chapterNumber: 1,
  });

  console.log(formatV1RunResult(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
