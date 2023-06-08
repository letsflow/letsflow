import stringify from 'fast-json-stable-stringify';
import { NIL, v5 as uuidv5 } from 'uuid';

export function uuid(data: { $schema: string; [_: string]: any }): string {
  const uuidNs = uuidv5(data.$schema, NIL);
  const json = stringify(data);
  return uuidv5(json, uuidNs);
}
