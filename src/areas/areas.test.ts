import { assertEquals } from "@std/assert";
import { delay } from "@std/async";
import FIFO from "https://deno.land/x/fifo@v0.2.2/mod.ts";
import { GrowingBytes } from "../encoding/growing_bytes.ts";
import { orderTimestamp } from "../order/order.ts";
import { OPEN_END, type Position3d, type Range3d } from "../ranges/types.ts";
import {
  areaIsIncluded,
  areaTo3dRange,
  decodeAreaInArea,
  decodeStreamAreaInArea,
  decodeStreamEntryInNamespaceArea,
  encodeAreaInArea,
  encodeEntryInNamespaceArea,
  intersectArea,
  isIncludedArea,
} from "./areas.ts";
import { ANY_SUBSPACE, type Area } from "./types.ts";
import type { Entry } from "../entries/types.ts";

type IsIncludedVector = [Area<bigint>, Position3d<bigint>, boolean];

const isIncludedVectors: IsIncludedVector[] = [
  [
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      path: [new Uint8Array(4)],
      subspace: BigInt(3),
      time: BigInt(1000),
    },
    true,
  ],
  // Excluded by prefix
  [
    {
      pathPrefix: [new Uint8Array(5)],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      path: [new Uint8Array(4)],
      subspace: BigInt(3),
      time: BigInt(1000),
    },
    false,
  ],
  // Excluded by subspace
  [
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(7),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      path: [new Uint8Array(4)],
      subspace: BigInt(3),
      time: BigInt(1000),
    },
    false,
  ],
  // Excluded by time
  [
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(2000),
        end: OPEN_END,
      },
    },
    {
      path: [new Uint8Array(4)],
      subspace: BigInt(3),
      time: BigInt(1000),
    },
    false,
  ],
];

Deno.test("isIncludedArea", () => {
  for (const [area, position, expected] of isIncludedVectors) {
    assertEquals(
      isIncludedArea(
        orderTimestamp,
        area,
        position,
      ),
      expected,
    );
  }
});

type AreaIsIncludedVector = [Area<bigint>, Area<bigint>, boolean];

const areaIsIncludedVectors: AreaIsIncludedVector[] = [
  [
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    true,
  ],
  [
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [new Uint8Array(4)],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(2000),
        end: BigInt(4000),
      },
    },
    true,
  ],
  // Excluded by path
  [
    {
      pathPrefix: [new Uint8Array(5)],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [new Uint8Array(4)],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    false,
  ],
  // Excluded by subspace
  [
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(5),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    false,
  ],
  // Excluded by time range
  [
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(2000),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    false,
  ],
];

Deno.test("areaIsIncluded", () => {
  for (const [outer, inner, expected] of areaIsIncludedVectors) {
    assertEquals(
      areaIsIncluded(
        orderTimestamp,
        inner,
        outer,
      ),
      expected,
    );
  }
});

type AreaIntersectVector = [Area<bigint>, Area<bigint>, Area<bigint> | null];

const areaIntersectVectors: AreaIntersectVector[] = [
  [
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
  ],
  // Intersect path
  [
    {
      pathPrefix: [new Uint8Array(4)],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [new Uint8Array(4), new Uint8Array(4)],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [new Uint8Array(4), new Uint8Array(4)],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
  ],
  // Intersect path the other way, too!
  [
    {
      pathPrefix: [new Uint8Array(4), new Uint8Array(4)],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [new Uint8Array(4)],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [new Uint8Array(4), new Uint8Array(4)],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
  ],
  // Intersect subspace
  [
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(4),
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    null,
  ],
  // Intersect time range
  [
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(0),
        end: BigInt(10),
      },
    },
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(5),
        end: BigInt(15),
      },
    },
    {
      pathPrefix: [],
      includedSubspaceId: BigInt(3),
      timeRange: {
        start: BigInt(5),
        end: BigInt(10),
      },
    },
  ],
];

Deno.test("intersectArea", () => {
  for (const [a, b, expected] of areaIntersectVectors) {
    assertEquals(
      intersectArea(
        orderTimestamp,
        a,
        b,
      ),
      expected,
    );
  }
});

type AreaToRangeVector = [
  Area<bigint>,
  Range3d<bigint>,
];

const areaOpts = {
  successorSubspace: (subspace: bigint) => subspace + BigInt(1),
  maxPathLength: 5,
  maxComponentCount: 3,
  maxPathComponentLength: 3,
  minimalSubspace: BigInt(0),
};

const areaToRangeVectors: AreaToRangeVector[] = [
  [
    {
      includedSubspaceId: BigInt(3),
      pathPrefix: [],
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
    {
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
      subspaceRange: {
        start: BigInt(3),
        end: BigInt(4),
      },
      pathRange: {
        start: [],
        end: OPEN_END,
      },
    },
  ],
];

Deno.test("areaTo3dRange", () => {
  for (const [area, expected] of areaToRangeVectors) {
    assertEquals(
      areaTo3dRange(
        areaOpts,
        area,
      ),
      expected,
    );
  }
});

type AreaInAreaVector = [Area<number>, Area<number>];

const areaInAreaVectors: AreaInAreaVector[] = [
  [
    {
      pathPrefix: [new Uint8Array(4)],
      includedSubspaceId: 1,
      timeRange: {
        start: BigInt(500),
        end: BigInt(1000),
      },
    },
    {
      pathPrefix: [],
      includedSubspaceId: 1,
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
  ],
  [
    {
      pathPrefix: [new Uint8Array(4)],
      includedSubspaceId: 1,
      timeRange: {
        start: BigInt(500),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [],
      includedSubspaceId: 1,
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
  ],
  [
    {
      pathPrefix: [new Uint8Array(4)],
      includedSubspaceId: 3,
      timeRange: {
        start: BigInt(500),
        end: OPEN_END,
      },
    },
    {
      pathPrefix: [],
      includedSubspaceId: ANY_SUBSPACE,
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
    },
  ],
  [
    {
      pathPrefix: [new Uint8Array(13)],
      includedSubspaceId: 1,
      timeRange: {
        start: BigInt(7),
        end: BigInt(13),
      },
    },
    {
      pathPrefix: [new Uint8Array(13)],
      includedSubspaceId: 1,
      timeRange: {
        start: BigInt(2),
        end: BigInt(17),
      },
    },
  ],
];

Deno.test("encodeAreaInArea", () => {
  for (const [inner, outer] of areaInAreaVectors) {
    const encoded = encodeAreaInArea(
      {
        pathScheme: {
          maxComponentCount: 255,
          maxComponentLength: 255,
          maxPathLength: 255,
        },
        encodeSubspace: (v: number) => new Uint8Array([v]),
        orderSubspace: (a, b) => {
          if (a < b) return -1;
          else if (a > b) return 1;
          return 0;
        },
      },
      inner,
      outer,
    );

    const decoded = decodeAreaInArea(
      {
        pathScheme: {
          maxComponentCount: 255,
          maxComponentLength: 255,
          maxPathLength: 255,
        },
        decodeSubspaceId: (v: Uint8Array) => v[0],
      },
      encoded,
      outer,
    );

    assertEquals(inner, decoded);
  }
});

Deno.test("encodeAreaInArea (streaming)", async () => {
  for (const [inner, outer] of areaInAreaVectors) {
    const encoded = encodeAreaInArea(
      {
        pathScheme: {
          maxComponentCount: 255,
          maxComponentLength: 255,
          maxPathLength: 255,
        },
        encodeSubspace: (v: number) => new Uint8Array([v]),
        orderSubspace: (a, b) => {
          if (a < b) return -1;
          else if (a > b) return 1;
          return 0;
        },
      },
      inner,
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

    const decoded = await decodeStreamAreaInArea(
      {
        pathScheme: {
          maxComponentCount: 255,
          maxComponentLength: 255,
          maxPathLength: 255,
        },
        decodeStreamSubspace: async (bytes) => {
          await bytes.nextAbsolute(1);
          const id = bytes.array[0];
          bytes.prune(1);
          return id;
        },
      },
      bytes,
      outer,
    );

    assertEquals(decoded, inner);
  }
});

const entryInAreaVectors: [
  Entry<number, number, Uint8Array>,
  Area<number>,
  number,
][] = [[
  {
    namespaceId: 0,
    subspaceId: 3,
    path: [],
    payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
    payloadLength: 500n,
    timestamp: 1000n,
  },
  {
    includedSubspaceId: ANY_SUBSPACE,
    pathPrefix: [],
    timeRange: {
      start: 0n,
      end: OPEN_END,
    },
  },
  0,
], [
  {
    namespaceId: 0,
    subspaceId: 3,
    path: [new Uint8Array([1]), new Uint8Array([2])],
    payloadDigest: crypto.getRandomValues(new Uint8Array(32)),
    payloadLength: 500n,
    timestamp: 1000n,
  },
  {
    includedSubspaceId: 3,
    pathPrefix: [new Uint8Array([1])],
    timeRange: {
      start: 0n,
      end: 1100n,
    },
  },
  0,
]];

Deno.test("encodeEntryInNamespaceArea (streaming)", async () => {
  for (const [entry, area, namespace] of entryInAreaVectors) {
    const encoded = encodeEntryInNamespaceArea(
      {
        encodePayloadDigest: (enc) => enc,
        encodeSubspaceId: (subspace) => new Uint8Array([subspace]),
        pathScheme: {
          maxComponentCount: 255,
          maxComponentLength: 255,
          maxPathLength: 255,
        },
      },
      entry,
      area,
    );

    const stream = new FIFO<Uint8Array>();

    const bytes = new GrowingBytes(stream);

    (async () => {
      for (const byte of encoded) {
        await delay(0);
        stream.push(new Uint8Array([byte]));
      }
    })();

    const decoded = await decodeStreamEntryInNamespaceArea(
      {
        decodeStreamPayloadDigest: async (bytes) => {
          await bytes.nextAbsolute(32);

          const digest = bytes.array.slice(0, 32);

          bytes.prune(32);

          return digest;
        },
        decodeStreamSubspace: async (bytes) => {
          await bytes.nextAbsolute(1);

          const subspace = bytes.array[0];

          bytes.prune(1);

          return subspace;
        },
        pathScheme: {
          maxComponentCount: 255,
          maxComponentLength: 255,
          maxPathLength: 255,
        },
      },
      bytes,
      area,
      namespace,
    );

    assertEquals(decoded, entry);
  }
});
