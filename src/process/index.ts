import { withHash } from './hash';

export * from './interfaces/process';
export { instantiate } from './instantiate';
export { step, timeout } from './step';
export { predict } from './predict';
export { etag, lastModified } from './etag';
export { hasEnded, chain } from './utils';
export { hash, withHash } from './hash';

export type HashFn = typeof withHash;
