import { assertEquals } from "$std/assert/assert_equals.ts";
import { delay } from "https://deno.land/std@0.202.0/async/delay.ts";
import FIFO from "https://deno.land/x/fifo@v0.2.2/mod.ts";
import { GrowingBytes } from "../encoding/growing_bytes.ts";
import { EncodingScheme } from "../encoding/types.ts";
import { orderBytes } from "../order/order.ts";

import {
  decodeEntry,
  decodeStreamEntryRelativeEntry,
  decodeStreamEntryRelativeRange3d,
  encodeEntry,
  encodeEntryRelativeEntry,
  encodeEntryRelativeRange3d,
} from "./entries.ts";
import { Entry } from "./types.ts";
import { OPEN_END, Range3d } from "../ranges/types.ts";

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

const namespaceA = crypto.getRandomValues(new Uint8Array(8));
const namespaceB = crypto.getRandomValues(new Uint8Array(8));
const subspaceA = crypto.getRandomValues(new Uint8Array(16));
const subspaceB = crypto.getRandomValues(new Uint8Array(16));

const relativeEntryEncodingVectors: [
  Entry<Uint8Array, Uint8Array, ArrayBuffer>,
  Entry<Uint8Array, Uint8Array, ArrayBuffer>,
][] = [
  [
    {
      namespaceId: namespaceA,
      subspaceId: subspaceA,
      path: [
        new Uint8Array([1]),
        new Uint8Array([2]),
      ],
      payloadLength: 1024n,
      payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
      timestamp: 1000n,
    },
    {
      namespaceId: namespaceA,
      subspaceId: subspaceA,
      path: [
        new Uint8Array([1]),
      ],
      payloadLength: 1024n,
      payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
      timestamp: 500n,
    },
  ],
  [
    {
      namespaceId: namespaceA,
      subspaceId: subspaceA,
      path: [
        new Uint8Array([1]),
        new Uint8Array([2]),
      ],
      payloadLength: 1024n,
      payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
      timestamp: 1000n,
    },
    {
      namespaceId: namespaceB,
      subspaceId: subspaceA,
      path: [
        new Uint8Array([1]),
      ],
      payloadLength: 1024n,
      payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
      timestamp: 500n,
    },
  ],
  [
    {
      namespaceId: namespaceA,
      subspaceId: subspaceA,
      path: [
        new Uint8Array([1]),
        new Uint8Array([2]),
      ],
      payloadLength: 1024n,
      payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
      timestamp: 1000n,
    },
    {
      namespaceId: namespaceB,
      subspaceId: subspaceB,
      path: [],
      payloadLength: 1024n,
      payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
      timestamp: 500n,
    },
  ],
  [
    {
      namespaceId: namespaceA,
      subspaceId: subspaceA,
      path: [
        new Uint8Array([1]),
        new Uint8Array([2]),
      ],
      payloadLength: 1024n,
      payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
      timestamp: 1000n,
    },
    {
      namespaceId: namespaceB,
      subspaceId: subspaceB,
      path: [],
      payloadLength: 1024n,
      payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
      timestamp: 1500n,
    },
  ],
];

Deno.test("Encoding (relative to another entry)", async () => {
  for (const [entry, ref] of relativeEntryEncodingVectors) {
    const encoded = encodeEntryRelativeEntry(
      {
        encodeNamespace: testSchemeNamespace.encode,
        encodeSubspace: testSchemeSubspace.encode,
        encodePayloadDigest: testSchemePayload.encode,
        pathScheme: {
          maxComponentCount: 255,
          maxComponentLength: 255,
          maxPathLength: 255,
        },
        isEqualNamespace: (a, b) => {
          return orderBytes(a, b) === 0;
        },
        orderSubspace: (a, b) => {
          return orderBytes(a, b);
        },
      },
      entry,
      ref,
    );

    const stream = new FIFO<Uint8Array>();

    const bytes = new GrowingBytes(stream);

    (async () => {
      for (const byte of encoded) {
        await delay(0);
        stream.push(new Uint8Array([byte]));
      }
    })();

    const decoded = await decodeStreamEntryRelativeEntry(
      {
        decodeStreamNamespace: async (bytes) => {
          await bytes.nextAbsolute(8);

          const namespace = bytes.array.slice(0, 8);

          bytes.prune(8);

          return namespace;
        },
        decodeStreamSubspace: async (bytes) => {
          await bytes.nextAbsolute(16);

          const subspace = bytes.array.slice(0, 16);

          bytes.prune(16);

          return subspace;
        },
        decodeStreamPayloadDigest: async (bytes) => {
          await bytes.nextAbsolute(32);

          const digest = bytes.array.slice(0, 32);

          bytes.prune(8);

          return digest;
        },
        pathScheme: {
          maxComponentCount: 255,
          maxComponentLength: 255,
          maxPathLength: 255,
        },
      },
      bytes,
      ref,
    );

    assertEquals(decoded, entry);
  }
});

const relativeRangeEncodingVectors: [
  Entry<Uint8Array, Uint8Array, ArrayBuffer>,
  Range3d<Uint8Array>,
][] = [
  [
    {
      namespaceId: namespaceA,
      subspaceId: subspaceA,
      path: [
        new Uint8Array([1]),
        new Uint8Array([2]),
      ],
      payloadLength: 1024n,
      payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
      timestamp: 1000n,
    },
    {
      subspaceRange: {
        start: subspaceA,
        end: OPEN_END,
      },
      pathRange: {
        start: [new Uint8Array([1])],
        end: OPEN_END,
      },
      timeRange: {
        start: 500n,
        end: OPEN_END,
      },
    },
  ],
  [
    {
      namespaceId: namespaceA,
      subspaceId: subspaceA,
      path: [
        new Uint8Array([1]),
        new Uint8Array([2]),
      ],
      payloadLength: 1024n,
      payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
      timestamp: 1000n,
    },
    {
      subspaceRange: {
        start: subspaceB,
        end: OPEN_END,
      },
      pathRange: {
        start: [new Uint8Array([1])],
        end: OPEN_END,
      },
      timeRange: {
        start: 500n,
        end: OPEN_END,
      },
    },
  ],
  [
    {
      namespaceId: namespaceA,
      subspaceId: subspaceA,
      path: [
        new Uint8Array([1]),
        new Uint8Array([2]),
      ],
      payloadLength: 1n,
      payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
      timestamp: 1000n,
    },
    {
      subspaceRange: {
        start: subspaceB,
        end: OPEN_END,
      },
      pathRange: {
        start: [],
        end: [new Uint8Array([1]), new Uint8Array([2])],
      },
      timeRange: {
        start: 500n,
        end: OPEN_END,
      },
    },
  ],
  [
    {
      namespaceId: namespaceA,
      subspaceId: subspaceA,
      path: [
        new Uint8Array([1]),
        new Uint8Array([2]),
      ],
      payloadLength: 1n,
      payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
      timestamp: 1100n,
    },
    {
      subspaceRange: {
        start: subspaceB,
        end: OPEN_END,
      },
      pathRange: {
        start: [],
        end: [new Uint8Array([1]), new Uint8Array([2])],
      },
      timeRange: {
        start: 500n,
        end: 1100n,
      },
    },
  ],
];

Deno.test("Encoding (relative to a range)", async () => {
  for (const [entry, outer] of relativeRangeEncodingVectors) {
    const encoded = encodeEntryRelativeRange3d(
      {
        encodeNamespace: testSchemeNamespace.encode,
        encodeSubspace: testSchemeSubspace.encode,
        encodePayloadDigest: testSchemePayload.encode,
        pathScheme: {
          maxComponentCount: 255,
          maxComponentLength: 255,
          maxPathLength: 255,
        },

        orderSubspace: (a, b) => {
          return orderBytes(a, b);
        },
      },
      entry,
      outer,
    );

    const stream = new FIFO<Uint8Array>();

    const bytes = new GrowingBytes(stream);

    (async () => {
      for (const byte of encoded) {
        await delay(0);
        stream.push(new Uint8Array([byte]));
      }
    })();

    const decoded = await decodeStreamEntryRelativeRange3d(
      {
        decodeStreamSubspace: async (bytes) => {
          await bytes.nextAbsolute(16);

          const subspace = bytes.array.slice(0, 16);

          bytes.prune(16);

          return subspace;
        },
        decodeStreamPayloadDigest: async (bytes) => {
          await bytes.nextAbsolute(32);

          const digest = bytes.array.slice(0, 32);

          bytes.prune(8);

          return digest;
        },
        pathScheme: {
          maxComponentCount: 255,
          maxComponentLength: 255,
          maxPathLength: 255,
        },
      },
      bytes,
      outer,
      entry.namespaceId,
    );

    assertEquals(decoded, entry);
  }
});
