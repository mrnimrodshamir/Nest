import {
  detectEventSourceLanguage,
  eventSourceFingerprint,
  translationTargets,
  type CachedEventTranslation,
} from '../_shared/eventTranslation.ts';
import { TranslationProviderError, type EventTranslationProvider } from './provider.ts';

export interface EventTranslationJob {
  eventId: string;
  title: string;
  description: string | null;
  sourceUpdatedAt: string;
}

export interface TranslationDatabase {
  enqueue(provider: string | null): Promise<number>;
  preview(limit: number): Promise<EventTranslationJob[]>;
  claim(limit: number): Promise<EventTranslationJob[]>;
  save(job: EventTranslationJob, rows: CachedEventTranslation[], provider: string, model: string): Promise<boolean>;
  fail(job: EventTranslationJob, code: string): Promise<void>;
}

export interface TranslationBatchResult {
  dryRun: boolean;
  enqueued: number;
  claimed: number;
  translated: number;
  bypassed: number;
  failed: number;
  stale: number;
}

export async function runEventTranslationBatch(
  input: { dryRun: boolean; limit?: number },
  database: TranslationDatabase,
  provider: EventTranslationProvider,
): Promise<TranslationBatchResult> {
  const limit = Math.min(50, Math.max(1, Math.trunc(input.limit ?? 20)));
  const enqueued = input.dryRun ? 0 : await database.enqueue(null);
  const jobs = input.dryRun ? await database.preview(limit) : await database.claim(limit);
  const result: TranslationBatchResult = { dryRun: input.dryRun, enqueued, claimed: jobs.length, translated: 0, bypassed: 0, failed: 0, stale: 0 };
  if (input.dryRun) return result;

  for (const job of jobs) {
    const content = { title: job.title, description: job.description };
    const sourceLanguage = detectEventSourceLanguage(content);
    const targets = translationTargets(sourceLanguage);
    try {
      if (targets.length === 0) {
        const saved = await database.save(job, [], provider.name, provider.model);
        if (saved) result.bypassed += 1; else result.stale += 1;
        continue;
      }
      const translated = await provider.translate({ content, sourceLanguage, targetLocales: targets });
      const sourceFingerprint = eventSourceFingerprint(content);
      const rows: CachedEventTranslation[] = translated.translations.map((row) => ({
        ...row, sourceLanguage, sourceFingerprint,
      }));
      const saved = await database.save(job, rows, provider.name, provider.model);
      if (saved) result.translated += 1; else result.stale += 1;
    } catch (error) {
      result.failed += 1;
      const code = error instanceof TranslationProviderError ? error.code : 'UNEXPECTED';
      await database.fail(job, code).catch(() => undefined);
    }
  }
  return result;
}
