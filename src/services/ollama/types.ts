export type OllamaModel = { name?: string; size?: number };
export type OllamaTagsResponse = { models?: OllamaModel[] };
export type OllamaProcessResponse = { models?: OllamaModel[] };
export type GenerateRequest = { model: string; prompt: string; system?: string; keep_alive?: string; options?: { num_gpu: number }; stream: boolean };
export type GenerateResponse = { response?: string };
export type SelectedMessage = { role: "user" | "assistant"; text: string };
export type ShowResponse = { details?: string; modelfile?: string; parameters?: string; template?: string };
