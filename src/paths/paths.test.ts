import { assertEquals } from "$std/assert/mod.ts";
import { PathScheme } from "../parameters/types.ts";
import {
  decodePath,
  decodePathRelative,
  encodedPathLength,
  encodePath,
  encodePathRelative,
  isPathPrefixed,
  isValidPath,
} from "./paths.ts";
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
    const [path, maxComponentCount, maxComponentLength, maxPathLength, result]
      of validPathVectors
  ) {
    assertEquals(
      isValidPath(
        path,
        {
          maxComponentCount,
          maxComponentLength,
          maxPathLength,
        },
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

type PathEncodingVector = [PathScheme, Path];

const pathEncodingVectors: PathEncodingVector[] = [
  [{
    maxComponentCount: 255,
    maxComponentLength: 65535,
    maxPathLength: 16777215,
  }, []],
  [{
    maxComponentCount: 255,
    maxComponentLength: 255,
    maxPathLength: 255,
  }, [
    new Uint8Array([1, 2, 3]),
    new Uint8Array([4, 5, 6]),
    new Uint8Array([7, 8, 9]),
  ]],
  [{
    maxComponentCount: 65535,
    maxComponentLength: 65535,
    maxPathLength: 65535,
  }, [
    new Uint8Array([1, 2, 3]),
    new Uint8Array([4, 5, 6]),
    new Uint8Array([7, 8, 9]),
  ]],
  [{
    maxComponentCount: 16777215,
    maxComponentLength: 16777215,
    maxPathLength: 16777215,
  }, [
    new Uint8Array([1, 2, 3]),
    new Uint8Array([4, 5, 6]),
    new Uint8Array([7, 8, 9]),
  ]],
];

Deno.test("encode / decode", () => {
  for (const [scheme, path] of pathEncodingVectors) {
    const encoded = encodePath(scheme, path);
    const predictedLength = encodedPathLength(scheme, path);

    assertEquals(encoded.byteLength, predictedLength);

    const decoded = decodePath(scheme, encoded);

    assertEquals(
      path,
      decoded,
    );
  }
});

type RelativePathEncodingVector = [PathScheme, Path, Path];

const relativePathEncodingVectors: RelativePathEncodingVector[] = [
  [
    {
      maxComponentCount: 255,
      maxComponentLength: 255,
      maxPathLength: 255,
    },
    [],
    [],
  ],
  [
    {
      maxComponentCount: 255,
      maxComponentLength: 255,
      maxPathLength: 255,
    },
    [],
    [new Uint8Array(4)],
  ],
  [{
    maxComponentCount: 255,
    maxComponentLength: 255,
    maxPathLength: 255,
  }, [
    new Uint8Array([1, 2, 3]),
    new Uint8Array([4, 5, 6]),
    new Uint8Array([7, 8, 9]),
  ], [
    new Uint8Array([1, 2, 3]),
    new Uint8Array([4, 5, 6]),
    new Uint8Array([7, 8, 9]),
  ]],
  [{
    maxComponentCount: 255,
    maxComponentLength: 255,
    maxPathLength: 255,
  }, [
    new Uint8Array([1, 2, 3]),
    new Uint8Array([4, 5, 6]),
  ], [
    new Uint8Array([1, 2, 3]),
    new Uint8Array([9, 9, 9]),
  ]],
  [{
    maxComponentCount: 255,
    maxComponentLength: 255,
    maxPathLength: 255,
  }, [
    new Uint8Array([0, 0, 0]),
  ], [
    new Uint8Array([1, 2, 3]),
  ]],
];

Deno.test("relative encode/decode", () => {
  for (const [scheme, primary, reference] of relativePathEncodingVectors) {
    const encoded = encodePathRelative(scheme, primary, reference);
    const decoded = decodePathRelative(scheme, encoded, reference);
    assertEquals(decoded, primary);
  }
});
