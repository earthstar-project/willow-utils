import { assertEquals } from "$std/assert/assert_equals.ts";
import { orderTimestamp } from "../order/order.ts";
import { SuccessorFn } from "../order/types.ts";
import { OPEN_END, Position3d, Range3d } from "../ranges/types.ts";
import {
  areaIsIncluded,
  areaTo3dRange,
  intersectArea,
  isIncludedArea,
} from "./areas.ts";
import { Area } from "./types.ts";

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
  for (const [parentArea, subArea, expected] of areaIsIncludedVectors) {
    assertEquals(
      areaIsIncluded(
        orderTimestamp,
        parentArea,
        subArea,
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
  {
    successorSubspace: SuccessorFn<bigint>;
    maxPathLength: number;
    maxComponentCount: number;
    maxPathComponentLength: number;
  },
  Area<bigint>,
  Range3d<bigint>,
];

const areaOpts = {
  successorSubspace: (subspace: bigint) => subspace + BigInt(1),
  maxPathLength: 5,
  maxComponentCount: 3,
  maxPathComponentLength: 3,
};

const areaToRangeVectors: AreaToRangeVector[] = [
  [
    areaOpts,
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
  for (const [opts, area, expected] of areaToRangeVectors) {
    assertEquals(
      areaTo3dRange(
        opts,
        area,
      ),
      expected,
    );
  }
});
