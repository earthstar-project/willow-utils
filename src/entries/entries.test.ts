import { assertEquals } from "$std/assert/assert_equals.ts";
import { EncodingScheme } from "../encoding/types.ts";

import { decodeEntry, encodeEntry } from "./entries.ts";
import { Entry } from "./types.ts";

export const testSchemeNamespace: EncodingScheme<Uint8Array> = {
  encode: (v: Uint8Array) => v,
  decode: (v: Uint8Array) => v.subarray(0, 8),
  encodedLength: () => 8,
  // Not used here.
  decodeStream: () => Promise.resolve(new Uint8Array()),
};

export const testSchemeSubspace: EncodingScheme<Uint8Array> = {
  encode: (v: Uint8Array) => v,
  decode: (v: Uint8Array) => v.subarray(0, 16),
  encodedLength: () => 16,
  // Not used here.
  decodeStream: () => Promise.resolve(new Uint8Array()),
};

export const testSchemePayload: EncodingScheme<ArrayBuffer> = {
  encode(hash: ArrayBuffer) {
    return new Uint8Array(hash);
  },
  decode(bytes: Uint8Array) {
    return bytes.subarray(0, 32);
  },
  encodedLength() {
    return 32;
  },
  // Not used here.
  decodeStream: () => Promise.resolve(new Uint8Array().buffer),
};

const entries: Entry<Uint8Array, Uint8Array, ArrayBuffer>[] = [
  {
    namespaceId: crypto.getRandomValues(new Uint8Array(8)),
    subspaceId: crypto.getRandomValues(new Uint8Array(16)),
    path: [
      crypto.getRandomValues(new Uint8Array(4)),
      crypto.getRandomValues(new Uint8Array(4)),
      crypto.getRandomValues(new Uint8Array(4)),
    ],
    payloadLength: BigInt(1024),
    payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
    timestamp: BigInt(1000),
  },
];

Deno.test("Encoding", () => {
  for (const entry of entries) {
    const encoded = encodeEntry({
      namespaceScheme: testSchemeNamespace,
      subspaceScheme: testSchemeSubspace,
      payloadScheme: testSchemePayload,
      pathScheme: {
        maxComponentCount: 255,
        maxComponentLength: 255,
        maxPathLength: 255,
      },
    }, entry);

    const decoded = decodeEntry({
      namespaceScheme: testSchemeNamespace,
      subspaceScheme: testSchemeSubspace,
      payloadScheme: testSchemePayload,
      pathScheme: {
        maxComponentCount: 255,
        maxComponentLength: 255,
        maxPathLength: 255,
      },
    }, encoded);

    assertEquals(entry, decoded);
  }
});
