import { isMainThread } from 'node:worker_threads';
import { writeSync } from 'node:fs';
if (!isMainThread) { writeSync(2, 'AUDIT_WORKER_EXIT_23\n'); process.exit(23); }
