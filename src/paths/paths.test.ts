import { assertEquals } from "@std/assert";
import FIFO from "https://deno.land/x/fifo@v0.2.2/mod.ts";
import type { PathScheme } from "../parameters/types.ts";
import {
  decodePath,
  decodePathRelative,
  decodeStreamPath,
  decodeStreamPathRelative,
  encodedPathLength,
  encodedPathRelativeLength,
  encodePath,
  encodePathRelative,
  isPathPrefixed,
  isValidPath,
  prefixesOf,
} from "./paths.ts";
import type { Path } from "./types.ts";
import { delay } from "@std/async";
import { GrowingBytes } from "../encoding/growing_bytes.ts";

type PrefixesOfVector = [Path, Path[]];

const prefixesOfVectors: PrefixesOfVector[] = [
  [[], [[]]],
  [[new Uint8Array(2)], [[], [new Uint8Array(2)]]],
  [[new Uint8Array(2), new Uint8Array(3), new Uint8Array(4)], [
    [],
    [new Uint8Array(2)],
    [new Uint8Array(2), new Uint8Array(3)],
    [new Uint8Array(2), new Uint8Array(3), new Uint8Array(4)],
  ]],
];

Deno.test("prefixesOf", () => {
  for (const [path, expected] of prefixesOfVectors) {
    const actual = prefixesOf(path);

    assertEquals(actual, expected);
  }
});

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
  [{
    maxComponentCount: 16777215,
    maxComponentLength: 16777215,
    maxPathLength: 16777215,
  }, [
    new Uint8Array(),
    new Uint8Array(),
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

Deno.test("decode (streaming)", async () => {
  for (const [scheme, path] of pathEncodingVectors) {
    const encoded = encodePath(scheme, path);

    const stream = new FIFO<Uint8Array>();

    const bytes = new GrowingBytes(stream);

    (async () => {
      for (const byte of encoded) {
        await delay(0);
        stream.push(new Uint8Array([byte]));
      }
    })();

    const decoded = await decodeStreamPath(scheme, bytes);

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
  [{
    maxComponentCount: 255,
    maxComponentLength: 255,
    maxPathLength: 255,
  }, [
    new Uint8Array(0),
    new Uint8Array([1]),
  ], [
    new Uint8Array(0),
    new Uint8Array(0),
    new Uint8Array([2]),
  ]],
];

Deno.test("relative encode/decode", () => {
  for (const [scheme, primary, reference] of relativePathEncodingVectors) {
    const encoded = encodePathRelative(scheme, primary, reference);
    const decoded = decodePathRelative(scheme, encoded, reference);
    assertEquals(decoded, primary);
  }
});

Deno.test("encode length (relative)", () => {
  for (const [scheme, primary, reference] of relativePathEncodingVectors) {
    const encoded = encodePathRelative(scheme, primary, reference);
    const encodedLength = encodedPathRelativeLength(scheme, primary, reference);
    assertEquals(encodedLength, encoded.byteLength);
  }
});

Deno.test("relative decode (streaming)", async () => {
  for (const [scheme, primary, reference] of relativePathEncodingVectors) {
    const encoded = encodePathRelative(scheme, primary, reference);

    const stream = new FIFO<Uint8Array>();

    const bytes = new GrowingBytes(stream);

    (async () => {
      for (const byte of encoded) {
        await delay(0);
        stream.push(new Uint8Array([byte]));
      }
    })();

    const decoded = await decodeStreamPathRelative(scheme, bytes, reference);

    assertEquals(
      decoded,
      primary,
    );
  }
});
