/// <reference lib="webworker" />
import { runRingJob } from '@/modules/rings/job.mjs';

self.onmessage = (event: MessageEvent) => {
  const { message, transfer } = runRingJob(event.data);
  self.postMessage(message, { transfer });
};
