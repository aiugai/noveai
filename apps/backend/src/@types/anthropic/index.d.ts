declare module '@anthropic-ai/sdk' {
  export default class Anthropic {
    constructor(options: { apiKey: string; baseURL?: string });

    messages: {
      create: (params: {
        model: string;
        messages: Array<{ role: string; content: any }>;
        system?: string;
        max_tokens?: number;
        temperature?: number;
        top_p?: number;
        stop_sequences?: string[];
        stream?: boolean;
      }) => Promise<any>;
    };
  }
}
