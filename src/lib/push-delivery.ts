export function retryPush(status: number | null) {
  return status === null || status === 408 || status === 429 || status >= 500;
}
export function pushFailureStage(stage: "payload" | "network" | "record") {
  return `${stage} error`;
}