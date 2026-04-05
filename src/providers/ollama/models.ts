import type { OllamaClient } from './client.js';
import type { OllamaModel, OllamaTagsResponse } from '../../types/index.js';

export async function fetchModels(client: OllamaClient): Promise<OllamaModel[]> {
  const data = await client.get<OllamaTagsResponse>('/api/tags');
  return (data.models ?? []).sort((a, b) => b.size - a.size);
}
