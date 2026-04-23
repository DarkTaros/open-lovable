import { appConfig } from '@/config/app.config';
import { createOpenAI } from '@ai-sdk/openai';

type ProviderName = 'openai';

// Client function type returned by @ai-sdk providers
export type ProviderClient = ReturnType<typeof createOpenAI>;

export interface ProviderResolution {
  provider: ProviderName;
  client: ProviderClient;
  actualModel: string;
}

export const defaultOpenAICompatibleBaseURL = 'https://a.ah-api.com/v1';

// Cache provider clients by a stable key to avoid recreating
const clientCache = new Map<string, ProviderClient>();

function getOpenAICompatibleDefaults(): { apiKey?: string; baseURL?: string } {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || defaultOpenAICompatibleBaseURL,
  };
}

function getOrCreateClient(apiKey?: string, baseURL?: string): ProviderClient {
  const defaults = getOpenAICompatibleDefaults();
  const effective = {
    apiKey: apiKey || defaults.apiKey,
    baseURL: baseURL ?? defaults.baseURL,
  };
  const cacheKey = `openai:${effective.apiKey || ''}:${effective.baseURL || ''}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const client = createOpenAI({
    apiKey: effective.apiKey,
    baseURL: effective.baseURL,
  });

  clientCache.set(cacheKey, client);
  return client;
}

function getActualModel(modelId: string): string {
  if (modelId.startsWith('openai/')) {
    return modelId.replace('openai/', '');
  }

  if (modelId.startsWith('anthropic/')) {
    return modelId.replace('anthropic/', '');
  }

  if (modelId.startsWith('google/')) {
    return modelId.replace('google/', '');
  }

  return modelId;
}

export function getProviderForModel(modelId: string): ProviderResolution {
  // 1) Check explicit model configuration in app config (custom models)
  const configured = appConfig.ai.modelApiConfig?.[modelId as keyof typeof appConfig.ai.modelApiConfig];
  if (configured) {
    const { apiKey, baseURL, model } = configured as { provider?: string; apiKey?: string; baseURL?: string; model: string };
    const client = getOrCreateClient(apiKey, baseURL);
    return { provider: 'openai', client, actualModel: model };
  }

  const client = getOrCreateClient();
  return {
    provider: 'openai',
    client,
    actualModel: getActualModel(modelId),
  };
}

export default getProviderForModel;

