import { assertEquals } from "$std/assert/mod.ts";
import { isPathPrefixed, isValidPath } from "./paths.ts";
import { Path } from "./types.ts";

type ValidPathVector = [Path, number, number, number, boolean];

const validPathVectors: ValidPathVector[] = [
  [[new Uint8Array([0])], 1, 1, 1, true],

  [[new Uint8Array([0])], 0, 0, 0, false],

  // Too many components
  [[new Uint8Array([0]), new Uint8Array([0])], 1, 1, 2, false],

  // Component too long
  [[new Uint8Array([0]), new Uint8Array([0, 255])], 2, 1, 3, false],

  // Path too long
  [[new Uint8Array([0]), new Uint8Array([0, 255])], 2, 2, 1, false],
];

Deno.test("isValidPath", () => {
  for (
    const [path, maxCompCount, maxCompLen, maxLen, result] of validPathVectors
  ) {
    assertEquals(
      isValidPath(
        path,
        maxCompCount,
        maxCompLen,
        maxLen,
      ),
      result,
    );
  }
});

type PathPrefixVector = [Path, Path, boolean];

const prefixVectors: PathPrefixVector[] = [
  [[], [], true],
  [[], [new Uint8Array(0), new Uint8Array(2)], true],
  [[new Uint8Array([1, 2, 3])], [new Uint8Array([1, 2, 3])], true],
  [
    [new Uint8Array([1, 2, 3])],
    [new Uint8Array([1, 2, 3]), new Uint8Array(4)],
    true,
  ],
  [
    [new Uint8Array([1, 2, 3])],
    [new Uint8Array([1, 2, 3, 4])],
    false,
  ],
];

Deno.test("isPathPrefixed", () => {
  for (const [prefix, path, result] of prefixVectors) {
    assertEquals(
      isPathPrefixed(
        prefix,
        path,
      ),
      result,
    );
  }
});
