declare module '@agnai/sentencepiece-js' {
  export class SentencePieceProcessor {
    constructor();
    load(modelPath: string): Promise<void>;
    encodeIds(text: string): number[];
    decodeIds(ids: number[]): string;
  }
}
