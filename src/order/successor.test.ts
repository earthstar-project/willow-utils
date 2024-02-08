import { assert, assertEquals } from "$std/assert/mod.ts";
import { orderPath } from "./order.ts";
import { successorPath, successorPrefix } from "./successor.ts";

type VectorSuccessorPath = [Uint8Array[], Uint8Array[] | null];

const maxPathLength = 3;
const maxComponentCount = 3;
const maxComponentLength = 2;

const testVectorsSuccessorPath: VectorSuccessorPath[] = [
  [
    [],
    [new Uint8Array(1)],
  ],
  [
    [new Uint8Array([0])],
    [new Uint8Array([0, 0])],
  ],
  [
    [new Uint8Array([0, 0])],
    [new Uint8Array([0, 1])],
  ],
  [
    [new Uint8Array([0, 0]), new Uint8Array([0])],
    [new Uint8Array([0, 0]), new Uint8Array([1])],
  ],
  [
    [new Uint8Array([0, 0]), new Uint8Array([255])],
    [new Uint8Array([0, 1])],
  ],
  [
    [new Uint8Array([0, 255]), new Uint8Array([0])],
    [new Uint8Array([0, 255]), new Uint8Array([1])],
  ],
  [
    [new Uint8Array([0]), new Uint8Array([0]), new Uint8Array([0])],
    [new Uint8Array([0]), new Uint8Array([0]), new Uint8Array([1])],
  ],
  [
    [new Uint8Array([255]), new Uint8Array([255]), new Uint8Array([255])],
    null,
  ],
];

Deno.test("successorPath", () => {
  for (const [original, successor] of testVectorsSuccessorPath) {
    if (successor) {
      assert(
        orderPath(original, successor) === -1,
      );
    }

    assertEquals(
      successorPath(
        original,
        { maxComponentCount, maxComponentLength, maxPathLength },
      ),
      successor,
    );
  }
});

type VectorSuccessorPrefix = [Uint8Array[], Uint8Array[] | null];

const testVectorsSuccessorPrefix: VectorSuccessorPrefix[] = [
  [
    [],
    null,
  ],
  [
    [new Uint8Array()],
    [new Uint8Array([0])],
  ],
  [
    [new Uint8Array([1]), new Uint8Array([])],
    [new Uint8Array([1]), new Uint8Array([0])],
  ],
  [
    [new Uint8Array([0])],
    [new Uint8Array([1])],
  ],
  [
    [new Uint8Array([0, 0])],
    [new Uint8Array([0, 1])],
  ],
  [
    [new Uint8Array([0, 0]), new Uint8Array([0])],
    [new Uint8Array([0, 0]), new Uint8Array([1])],
  ],
  [
    [new Uint8Array([0, 0]), new Uint8Array([255])],
    [new Uint8Array([0, 1])],
  ],
  [
    [new Uint8Array([0, 255]), new Uint8Array([0])],
    [new Uint8Array([0, 255]), new Uint8Array([1])],
  ],
  [
    [new Uint8Array([0]), new Uint8Array([0]), new Uint8Array([0])],
    [new Uint8Array([0]), new Uint8Array([0]), new Uint8Array([1])],
  ],
  [
    [new Uint8Array([255]), new Uint8Array([255]), new Uint8Array([255])],
    null,
  ],
];

Deno.test("successorPrefix", () => {
  for (const [original, successor] of testVectorsSuccessorPrefix) {
    if (successor) {
      assert(
        orderPath(original, successor) === -1,
      );
    }

    assertEquals(
      successorPrefix(
        original,
      ),
      successor,
    );
  }
});
