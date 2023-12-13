import { assertEquals } from "$std/assert/assert_equals.ts";
import { Path } from "../paths/types.ts";
import { orderPath } from "./order.ts";

type OrderVector = [Path, Path, -1 | 0 | 1];

const orderVectors: OrderVector[] = [
  [[], [], 0],
  [[], [new Uint8Array(0)], -1],
  [[new Uint8Array(0)], [], 1],
  [[new Uint8Array([1, 2])], [
    new Uint8Array([1, 2]),
    new Uint8Array([3, 4]),
  ], -1],
  [[new Uint8Array([1, 2]), new Uint8Array(3)], [
    new Uint8Array([1, 2]),
    new Uint8Array([3, 4]),
  ], -1],
];

Deno.test("orderPath", () => {
  for (const [a, b, expected] of orderVectors) {
    assertEquals(
      orderPath(a, b),
      expected,
    );
  }
});
