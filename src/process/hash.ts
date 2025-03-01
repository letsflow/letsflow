import { hmac as createHmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import stringify from 'fast-json-stable-stringify';
import { Event } from './interfaces';

export function hash(data: string | Record<string, any>): string {
  const input = typeof data === 'string' ? data : stringify(data);
  return bytesToHex(sha256(input));
}

export function withHash<T extends Event>(event: Omit<T, 'hash'>): T {
  return { ...event, hash: hash(event) } as T;
}

export function hmac(data: string | Record<string, any>, key: string): string {
  const input = typeof data === 'string' ? data : stringify(data);
  return bytesToHex(createHmac(sha256, key, input));
}
