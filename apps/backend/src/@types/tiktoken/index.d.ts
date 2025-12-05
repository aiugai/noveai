import { TiktokenModel } from 'tiktoken';

declare module 'tiktoken' {
  interface CustomTiktokenModel extends TiktokenModel {
    'gpt-3.5-turbo': 'gpt-3.5-turbo';
    'gpt-4': 'gpt-4';
    'gpt-4-32k': 'gpt-4-32k';
    'gpt-3.5-turbo-0301': 'gpt-3.5-turbo-0301';
    'gpt-4o': 'gpt-4o';
    o1: 'o1';
  }

  export function encoding_for_model(
    model: string,
    extend_special_tokens?: Record<string, number>,
  ): any;
}
