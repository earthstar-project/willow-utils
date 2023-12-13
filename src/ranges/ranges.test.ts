import { assert, assertEquals } from "$std/assert/mod.ts";
import { orderTimestamp } from "../order/order.ts";
import {
  intersectRange,
  isIncluded3d,
  isIncludedRange,
  isValidRange,
  isValidRange3d,
  rangeIsIncluded,
} from "./ranges.ts";
import { OPEN_END } from "./types.ts";

Deno.test("isValidRange", () => {
  assert(isValidRange(orderTimestamp, {
    start: BigInt(0),
    end: OPEN_END,
  }));

  assert(isValidRange(orderTimestamp, {
    start: BigInt(0),
    end: BigInt(3),
  }));

  assert(
    !isValidRange(orderTimestamp, {
      start: BigInt(3),
      end: BigInt(0),
    }),
  );
});

Deno.test("isIncludedRange", () => {
  assert(isIncludedRange(orderTimestamp, {
    start: BigInt(0),
    end: BigInt(10),
  }, BigInt(5)));

  assert(isIncludedRange(orderTimestamp, {
    start: BigInt(0),
    end: OPEN_END,
  }, BigInt(5)));

  assert(
    !isIncludedRange(orderTimestamp, {
      start: BigInt(10),
      end: BigInt(15),
    }, BigInt(20)),
  );

  assert(
    !isIncludedRange(orderTimestamp, {
      start: BigInt(10),
      end: OPEN_END,
    }, BigInt(5)),
  );
});

Deno.test("intersectRange", () => {
  assertEquals(
    intersectRange(
      orderTimestamp,
      {
        start: BigInt(0),
        end: BigInt(10),
      },
      {
        start: BigInt(5),
        end: BigInt(15),
      },
    ),
    {
      start: BigInt(5),
      end: BigInt(10),
    },
  );

  assertEquals(
    intersectRange(
      orderTimestamp,
      {
        start: BigInt(0),
        end: OPEN_END,
      },
      {
        start: BigInt(5),
        end: OPEN_END,
      },
    ),
    {
      start: BigInt(5),
      end: OPEN_END,
    },
  );

  assertEquals(
    intersectRange(
      orderTimestamp,
      {
        start: BigInt(0),
        end: BigInt(10),
      },
      {
        start: BigInt(5),
        end: OPEN_END,
      },
    ),
    {
      start: BigInt(5),
      end: BigInt(10),
    },
  );

  assertEquals(
    intersectRange(
      orderTimestamp,
      {
        start: BigInt(0),
        end: BigInt(10),
      },
      {
        start: BigInt(20),
        end: BigInt(30),
      },
    ),
    null,
  );

  assertEquals(
    intersectRange(
      orderTimestamp,
      {
        start: BigInt(0),
        end: BigInt(10),
      },
      {
        start: BigInt(20),
        end: OPEN_END,
      },
    ),
    null,
  );
});

Deno.test("rangeIsIncluded", () => {
  assert(
    rangeIsIncluded(orderTimestamp, {
      start: BigInt(0),
      end: BigInt(10),
    }, {
      start: BigInt(2),
      end: BigInt(8),
    }),
  );

  assert(
    rangeIsIncluded(orderTimestamp, {
      start: BigInt(0),
      end: OPEN_END,
    }, {
      start: BigInt(2),
      end: OPEN_END,
    }),
  );

  assert(
    rangeIsIncluded(orderTimestamp, {
      start: BigInt(10),
      end: OPEN_END,
    }, {
      start: BigInt(15),
      end: BigInt(15),
    }),
  );

  assert(
    !rangeIsIncluded(orderTimestamp, {
      start: BigInt(0),
      end: BigInt(10),
    }, {
      start: BigInt(10),
      end: BigInt(20),
    }),
  );

  assert(
    !rangeIsIncluded(orderTimestamp, {
      start: BigInt(10),
      end: OPEN_END,
    }, {
      start: BigInt(5),
      end: OPEN_END,
    }),
  );
});

// 3D ranges

Deno.test("isValidRange3d", () => {
  assert(
    isValidRange3d(orderTimestamp, {
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
      pathRange: {
        start: [],
        end: [new Uint8Array(4)],
      },
      subspaceRange: {
        start: BigInt(0),
        end: BigInt(5),
      },
    }),
  );

  assert(
    !isValidRange3d(orderTimestamp, {
      timeRange: {
        start: BigInt(0),
        end: OPEN_END,
      },
      pathRange: {
        start: [new Uint8Array(4)],
        end: [],
      },
      subspaceRange: {
        start: BigInt(0),
        end: BigInt(5),
      },
    }),
  );
});

Deno.test("isIncluded3d", () => {
  assert(
    isIncluded3d(
      orderTimestamp,
      {
        timeRange: {
          start: BigInt(0),
          end: OPEN_END,
        },
        pathRange: {
          start: [],
          end: [new Uint8Array(4)],
        },
        subspaceRange: {
          start: BigInt(0),
          end: BigInt(5),
        },
      },
      {
        time: BigInt(0),
        path: [new Uint8Array(0)],
        subspace: BigInt(2),
      },
    ),
  );

  assert(
    !isIncluded3d(
      orderTimestamp,
      {
        timeRange: {
          start: BigInt(0),
          end: OPEN_END,
        },
        pathRange: {
          start: [],
          end: [new Uint8Array(4)],
        },
        subspaceRange: {
          start: BigInt(0),
          end: BigInt(5),
        },
      },
      {
        time: BigInt(0),
        path: [new Uint8Array(0)],
        subspace: BigInt(10),
      },
    ),
  );
});
