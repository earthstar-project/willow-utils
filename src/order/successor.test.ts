import { assert, assertEquals } from "$std/assert/mod.ts";
import { orderPath } from "./order.ts";
import { successorPath } from "./successor.ts";

type Vector = [Uint8Array[], Uint8Array[] | null];

const maxLength = 3;
const maxComponentCount = 3;
const maxComponentLength = 2;

const testVectors: Vector[] = [
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
    [new Uint8Array([0]), new Uint8Array([0]), new Uint8Array([0])],
    [new Uint8Array([0]), new Uint8Array([0]), new Uint8Array([1])],
  ],
  [
    [new Uint8Array([255]), new Uint8Array([255]), new Uint8Array([255])],
    null,
  ],
];

Deno.test("successorPath", () => {
  for (const [original, successor] of testVectors) {
    if (successor) {
      assert(
        orderPath(original, successor) === -1,
      );
    }

    assertEquals(
      successorPath(
        original,
        maxComponentCount,
        maxComponentLength,
        maxLength,
      ),
      successor,
    );
  }
});
