import stringify from 'fast-json-stable-stringify';
import { v5 as uuidv5 } from 'uuid';

export function uuid(data: { $schema: string; [_: string]: any }): string {
  const ns = uuidv5(data.$schema, uuidv5.URL);
  return uuidv5(stringify(data), ns);
}
