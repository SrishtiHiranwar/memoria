import { cp, mkdir } from 'node:fs/promises';

await mkdir(new URL('../dist/prompts/', import.meta.url), { recursive: true });
await cp(new URL('../src/prompts/', import.meta.url), new URL('../dist/prompts/', import.meta.url), { recursive: true });
