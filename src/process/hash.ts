import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import stringify from 'fast-json-stable-stringify';
import { Event } from './interfaces';

export function hash(data: Record<string, any>): string {
  return bytesToHex(sha256(stringify(data)));
}

export function withHash<T extends Event>(event: Omit<T, 'hash'>): T {
  return { ...event, hash: hash(event) } as T;
}
