import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';
import { AIServiceError } from '../lib/errors.js';
import {
  geminiStorySchema,
  geminiSummarySchema,
  type sceneSchema,
} from '../lib/schemas.js';
import { z } from 'zod';

type Scene = z.infer<typeof sceneSchema>;

const promptDirectory = new URL('../prompts/', import.meta.url);
const generationCache = new Map<string, { expiresAt: number; value: z.infer<typeof geminiStorySchema> }>();
const model = 'gemini-2.5-flash-lite';

function recordCall() {
  console.info(JSON.stringify({
    type: 'gemini_call',
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  }));
}

function friendlyError(error: unknown): AIServiceError {
  const detail = error instanceof Error ? error.message : '';
  if (/429|resource_exhausted|rate.?limit/i.test(detail)) {
    return new AIServiceError(429, 'The story assistant is busy right now. Please wait a moment and try again.');
  }
  if (!process.env.GEMINI_API_KEY) {
    return new AIServiceError(503, 'Story drafting is unavailable until the server Gemini key is configured.');
  }
  return new AIServiceError(502, 'The story assistant could not complete that request. Please try again.');
}

async function generateJson(systemInstruction: string, contents: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIServiceError(503, 'Story drafting is unavailable until the server Gemini key is configured.');
  recordCall();
  const ai = new GoogleGenAI({ apiKey });
  try {
    const result = await ai.models.generateContent({
      model,
      contents,
      config: { responseMimeType: 'application/json', systemInstruction },
    });
    const text = result.text;
    if (!text) throw new Error('Empty AI response');
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw friendlyError(error);
  }
}

export async function draftStory(
  prompt: string,
  photos: Array<{ id: string; caption: string }>,
): Promise<{ title: string; scenes: Scene[] }> {
  const keyedPhotos = photos.map((photo, index) => ({
    id: `photo_${index + 1}`,
    caption: photo.caption,
    databaseId: photo.id,
  }));
  const key = createHash('sha256').update(JSON.stringify({ prompt, photos: keyedPhotos.map(({ id, caption }) => ({ id, caption })) })).digest('hex');
  const cached = generationCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      title: cached.value.title,
      scenes: cached.value.scenes.map((scene) => ({
        ...scene,
        photoId: keyedPhotos.find((photo) => photo.id === scene.photoId)?.databaseId ?? scene.photoId,
      })),
    };
  }

  const systemPrompt = await readFile(new URL('story-generator.txt', promptDirectory), 'utf8');
  const input = JSON.stringify({
    doctorPrompt: prompt,
    photos: keyedPhotos.map(({ id, caption }) => ({ id, caption })),
  });

  let parsed: z.infer<typeof geminiStorySchema> | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: unknown;
    try {
      response = await generateJson(systemPrompt, input);
      parsed = geminiStorySchema.parse(response);
      const allowedIds = new Set(keyedPhotos.map((photo) => photo.id));
      if (parsed.scenes.some((scene) => !allowedIds.has(scene.photoId))) {
        parsed = undefined;
      } else {
        break;
      }
    } catch (error) {
      if (error instanceof AIServiceError && error.status !== 502) throw error;
      parsed = undefined;
    }
  }
  if (!parsed) {
    throw new AIServiceError(502, 'The story assistant returned an unusable draft twice. Please adjust the prompt and try again.');
  }

  generationCache.set(key, { expiresAt: Date.now() + 10 * 60 * 1000, value: parsed });
  return {
    title: parsed.title,
    scenes: parsed.scenes.map((scene) => ({
      ...scene,
      photoId: keyedPhotos.find((photo) => photo.id === scene.photoId)!.databaseId,
    })),
  };
}

export async function summarizeSession(results: unknown) {
  const systemPrompt = await readFile(new URL('session-summariser.txt', promptDirectory), 'utf8');
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await generateJson(systemPrompt, `Session results:\n${JSON.stringify(results)}`);
      return geminiSummarySchema.parse(response);
    } catch (error) {
      if (error instanceof AIServiceError && error.status !== 502) throw error;
      lastError = error;
    }
  }
  if (lastError) {
    throw new AIServiceError(502, 'A session summary could not be generated. The session data is saved and can be reviewed later.');
  }
  throw new AIServiceError(502, 'A session summary could not be generated. Please try again.');
}
