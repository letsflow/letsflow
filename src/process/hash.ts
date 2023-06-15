import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import stringify from 'fast-json-stable-stringify';

export function hash(data: Record<string, any>): string {
  return bytesToHex(sha256(stringify(data)));
}

export function withHash<T extends Record<string, any>>(data: T): T & { hash: string } {
  return { ...data, hash: hash(data) };
}
