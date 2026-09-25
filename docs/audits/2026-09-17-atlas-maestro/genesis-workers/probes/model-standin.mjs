import { readFileSync, appendFileSync } from 'node:fs';
const prompt = readFileSync(0,'utf8');
appendFileSync(process.argv[2], JSON.stringify({prompt})+'\n');
// Offline abstaining command: no network, no model, no fabricated fact.
