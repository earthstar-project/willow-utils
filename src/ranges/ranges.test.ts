import { assert, assertEquals } from "$std/assert/mod.ts";
import FIFO from "https://deno.land/x/fifo@v0.2.2/mod.ts";

import { orderTimestamp } from "../order/order.ts";
import { successorPath } from "../order/successor.ts";
import { Path } from "../paths/types.ts";
import {
  decodeRange3dRelative,
  decodeStreamRange3dRelative,
  encodeRange3dRelative,
  intersectRange,
  isIncluded3d,
  isIncludedRange,
  isValidRange,
  isValidRange3d,
  rangeIsIncluded,
} from "./ranges.ts";
import { OPEN_END, Range, Range3d } from "./types.ts";
import { delay } from "https://deno.land/std@0.202.0/async/delay.ts";
import { GrowingBytes } from "../encoding/growing_bytes.ts";

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

function randomTimeRange(): Range<bigint> {
  const isOpen = Math.random() < 0.5;

  const start = BigInt(Math.floor(Math.random() * 1000));

  if (isOpen) {
    return {
      start,
      end: OPEN_END,
    };
  }

  return {
    start,
    end: start + BigInt(Math.floor(Math.random() * 1000)),
  };
}

function randomSubspaceRange(): Range<number> {
  const isOpen = Math.random() < 0.5;

  const start = Math.floor(Math.random() * 256);

  if (isOpen) {
    return {
      start,
      end: OPEN_END,
    };
  }

  return {
    start,
    end: Math.min(255, start + Math.floor(Math.random() * 256)),
  };
}

export function randomPath(): Path {
  const pathLength = Math.floor(Math.random() * 4);

  const maxComponentLength = pathLength === 4
    ? 2
    : pathLength === 3
    ? 2
    : pathLength === 2
    ? 4
    : pathLength === 1
    ? 8
    : 0;

  const path = [];

  // Now create components with random uint.
  for (let i = 0; i < pathLength; i++) {
    const pathLength = Math.floor(Math.random() * maxComponentLength);

    path.push(crypto.getRandomValues(new Uint8Array(pathLength)));
  }

  return path;
}

const randomPathRange = () => {
  const isOpen = Math.random() > 0.5;

  const start = randomPath();

  if (isOpen) {
    return {
      start,
      end: OPEN_END,
    } as Range<Path>;
  }

  let end = successorPath(start, {
    maxComponentCount: 4,
    maxComponentLength: 8,
    maxPathLength: 32,
  });

  const iterations = Math.floor(Math.random() * 3);

  for (let i = 0; i < iterations; i++) {
    if (end === null) {
      break;
    }

    end = successorPath(end, {
      maxComponentCount: 4,
      maxComponentLength: 8,
      maxPathLength: 32,
    });
  }

  if (end === null) {
    return {
      start,
      end: OPEN_END,
    } as Range<Path>;
  }

  return { start, end };
};

function randomRange3d(): Range3d<number> {
  return {
    subspaceRange: randomSubspaceRange(),
    pathRange: randomPathRange(),
    timeRange: randomTimeRange(),
  };
}

Deno.test("encodeRange3dRelative", () => {
  const vectors = [];

  for (let i = 0; i < 256; i++) {
    vectors.push([
      randomRange3d(),
      randomRange3d(),
    ]);
  }

  for (const [range, ref] of vectors) {
    const encoded = encodeRange3dRelative(
      {
        encodeSubspaceId: (number) => new Uint8Array([number]),
        orderSubspace: (a, b) => {
          if (a < b) return -1;
          else if (a > b) return 1;
          return 0;
        },
        pathScheme: {
          maxComponentCount: 4,
          maxComponentLength: 8,
          maxPathLength: 32,
        },
      },
      range,
      ref,
    );

    const decoded = decodeRange3dRelative(
      {
        decodeSubspaceId: (enc) => enc[0],
        encodedSubspaceIdLength: () => 1,
        pathScheme: {
          maxComponentCount: 4,
          maxComponentLength: 8,
          maxPathLength: 32,
        },
      },
      encoded,
      ref,
    );

    assertEquals(decoded, range);
  }
});

Deno.test("encodeRange3dRelative (streaming)", async () => {
  const vectors = [];

  for (let i = 0; i < 256; i++) {
    vectors.push([
      randomRange3d(),
      randomRange3d(),
    ]);
  }

  for (const [range, ref] of vectors) {
    const encoded = encodeRange3dRelative(
      {
        encodeSubspaceId: (number) => new Uint8Array([number]),
        orderSubspace: (a, b) => {
          if (a < b) return -1;
          else if (a > b) return 1;
          return 0;
        },
        pathScheme: {
          maxComponentCount: 4,
          maxComponentLength: 8,
          maxPathLength: 32,
        },
      },
      range,
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

    const decoded = await decodeStreamRange3dRelative(
      {
        decodeStreamSubspaceId: async (bytes: GrowingBytes) => {
          await bytes.nextAbsolute(1);

          const id = bytes.array[0];

          bytes.prune(1);

          return id;
        },

        pathScheme: {
          maxComponentCount: 4,
          maxComponentLength: 8,
          maxPathLength: 32,
        },
      },
      bytes,
      ref,
    );

    assertEquals(decoded, range);
  }
});
