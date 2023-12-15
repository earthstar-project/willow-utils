import { assertEquals } from "$std/assert/assert_equals.ts";
import { orderBytes, orderTimestamp } from "../order/order.ts";
import { SuccessorFn } from "../order/types.ts";
import { OPEN_END, Position3d, Range3d } from "../ranges/types.ts";
import {
  areaIsIncluded,
  areaTo3dRange,
  decodeAreaInArea,
  encodeAreaInArea,
  intersectArea,
  isIncludedArea,
} from "./areas.ts";
import { ANY_SUBSPACE, Area } from "./types.ts";

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
        end: [new Uint8Array(1)],
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
        subspaceScheme: {
          encode: (v: number) => new Uint8Array([v]),
          decode: (v: Uint8Array) => v[0],
          encodedLength: () => 1,
          order: (a, b) => {
            if (a < b) return -1;
            else if (a > b) return 1;
            return 0;
          },
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
        subspaceScheme: {
          encode: (v: number) => new Uint8Array([v]),
          decode: (v: Uint8Array) => v[0],
          encodedLength: () => 1,
          order: (a, b) => {
            if (a < b) return -1;
            else if (a > b) return 1;
            return 0;
          },
        },
      },
      encoded,
      outer,
    );

    assertEquals(inner, decoded);
  }
});
