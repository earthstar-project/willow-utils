import { concat, equals as equalsBytes } from "@std/bytes";
import type { GrowingBytes } from "../../mod.ts";
import {
  decodeUintMax32,
  encodeUintMax32,
  max32Width,
} from "../encoding/encoding.ts";
import { orderBytes } from "../order/order.ts";
import type { PathScheme } from "../parameters/types.ts";
import type { Path } from "./types.ts";

/** Return all prefixes of a given path (which included the path itself), in order of path length. */
export function prefixesOf(path: Path): Path[] {
  const prefixes: Path[] = [[]];

  for (let i = 1; i <= path.length; i++) {
    prefixes.push(path.slice(0, i));
  }

  return prefixes;
}

/** Return the prefix shared by two `Path`s. */
export function commonPrefix(a: Path, b: Path): Path {
  let longestPrefix = 0;

  for (let i = 0; i < a.length; i++) {
    const compA = a[i];
    const compB = b[i];

    if (!compB) {
      break;
    }

    const isEqual = equalsBytes(compA, compB);

    if (!isEqual) {
      break;
    }

    longestPrefix += 1;
  }

  return a.slice(0, longestPrefix);
}

/** Returns whether a `Path` does not exceed the limits given by a `PathScheme`. */
export function isValidPath(
  path: Path,
  { maxComponentCount, maxComponentLength, maxPathLength }: PathScheme,
): boolean {
  if (path.length > maxComponentCount) {
    return false;
  }

  let totalLength = 0;

  for (const component of path) {
    if (component.byteLength > maxComponentLength) {
      return false;
    }

    totalLength += component.byteLength;

    if (totalLength > maxPathLength) {
      return false;
    }
  }
  return true;
}

/** Returns whether a path is prefixed by another path. */
export function isPathPrefixed(prefix: Path, path: Path): boolean {
  if (prefix.length > path.length) {
    return false;
  }

  for (let i = 0; i < prefix.length; i++) {
    const prefixComponent = prefix[i];
    const testComponent = path[i];

    const order = orderBytes(prefixComponent, testComponent);

    if (order !== 0) {
      return false;
    }
  }

  return true;
}

/** Encodes a path.
 *
 * https://willowprotocol.org/specs/encodings/index.html#enc_path
 */
export function encodePath(pathScheme: PathScheme, path: Path): Uint8Array {
  const componentCountBytes = encodeUintMax32(
    path.length,
    pathScheme.maxComponentCount,
  );

  const componentBytes: Uint8Array[] = [];

  for (const component of path) {
    const lengthBytes = encodeUintMax32(
      component.length,
      pathScheme.maxComponentLength,
    );

    componentBytes.push(concat([lengthBytes, component]));
  }

  return concat([componentCountBytes, ...componentBytes]);
}

/** Decodes a path.
 *
 * https://willowprotocol.org/specs/encodings/index.html#enc_path
 */
export function decodePath(pathScheme: PathScheme, encPath: Uint8Array): Path {
  const maxCountWidth = max32Width(pathScheme.maxComponentCount);
  const countBytes = encPath.subarray(0, maxCountWidth);

  const componentCount = decodeUintMax32(
    countBytes,
    pathScheme.maxComponentCount,
  );

  let position = maxCountWidth;

  const componentLengthWidth = max32Width(pathScheme.maxComponentLength);

  const path: Path = [];

  for (let i = 0; i < componentCount; i++) {
    const lengthBytes = encPath.subarray(
      position,
      position + componentLengthWidth,
    );

    const componentLength = decodeUintMax32(
      lengthBytes,
      pathScheme.maxComponentLength,
    );
    const pathComponent = encPath.subarray(
      position + componentLengthWidth,
      position + componentLengthWidth + componentLength,
    );

    path.push(pathComponent);

    position += componentLengthWidth + componentLength;
  }

  return path;
}

/** Decodes an encoded path (which is streaming in).
 *
 * https://willowprotocol.org/specs/encodings/index.html#enc_path
 */
export async function decodeStreamPath(
  pathScheme: PathScheme,
  bytes: GrowingBytes,
): Promise<Path> {
  const maxCountWidth = max32Width(pathScheme.maxComponentCount);

  await bytes.nextAbsolute(maxCountWidth);

  const countBytes = bytes.array.subarray(0, maxCountWidth);

  const componentCount = decodeUintMax32(
    countBytes,
    pathScheme.maxComponentCount,
  );

  bytes.prune(maxCountWidth);

  const componentLengthWidth = max32Width(pathScheme.maxComponentLength);

  const path: Path = [];

  for (let i = 0; i < componentCount; i++) {
    await bytes.nextAbsolute(componentLengthWidth);

    const lengthBytes = bytes.array.subarray(
      0,
      componentLengthWidth,
    );

    const componentLength = decodeUintMax32(
      lengthBytes,
      pathScheme.maxComponentLength,
    );

    await bytes.nextAbsolute(componentLengthWidth + componentLength);

    const pathComponent = bytes.array.subarray(
      componentLengthWidth,
      componentLengthWidth + componentLength,
    );

    path.push(pathComponent);

    bytes.prune(componentLengthWidth + componentLength);
  }

  return path;
}

/** Encodes the length of a `Path`. */
export function encodedPathLength(pathScheme: PathScheme, path: Path): number {
  const countWidth = max32Width(pathScheme.maxComponentCount);

  let length = countWidth;

  const compLenWidth = max32Width(pathScheme.maxComponentLength);

  for (const component of path) {
    length += compLenWidth;
    length += component.byteLength;
  }

  return length;
}

/** Encodes a `Path` relative to another `Path`.
 *
 * https://willowprotocol.org/specs/encodings/index.html#enc_path_relative
 */
export function encodePathRelative(
  scheme: PathScheme,
  /** The path which `primary` is being encoded relative to. */
  toEncode: Path,
  /** The path being encoded relative to `reference`. */
  reference: Path,
): Uint8Array {
  const longestPrefixLength = commonPrefix(toEncode, reference).length;

  const prefixLengthBytes = encodeUintMax32(
    longestPrefixLength,
    scheme.maxComponentCount,
  );

  const suffix = toEncode.slice(longestPrefixLength);

  const suffixBytes = encodePath(scheme, suffix);

  return concat([prefixLengthBytes, suffixBytes]);
}

/** Decodes a `Path` relative to another `Path`.
 *
 * https://willowprotocol.org/specs/encodings/index.html#enc_path_relative
 */
export function decodePathRelative(
  scheme: PathScheme,
  /** The path which was encoded relative to `reference`. */
  encodedRelativePath: Uint8Array,
  /** The path which `encodedRelativePath` was encoded relative to. */
  reference: Path,
): Path {
  const prefixLengthWidth = max32Width(scheme.maxComponentCount);

  const prefixLength = decodeUintMax32(
    encodedRelativePath.subarray(0, prefixLengthWidth),
    scheme.maxComponentCount,
  );

  const prefix = reference.slice(0, prefixLength);

  const suffix = decodePath(
    scheme,
    encodedRelativePath.subarray(prefixLengthWidth),
  );

  return prefix.concat(suffix);
}

/** Decodes a `Path` relative to another `Path` from {@linkcode GrowingBytes}.
 *
 * https://willowprotocol.org/specs/encodings/index.html#enc_path_relative
 */
export async function decodeStreamPathRelative(
  scheme: PathScheme,
  /** The path which was encoded relative to `reference`. */
  bytes: GrowingBytes,
  /** The path which `encodedRelativePath` was encoded relative to. */
  reference: Path,
): Promise<Path> {
  const prefixLengthWidth = max32Width(scheme.maxComponentCount);

  await bytes.nextAbsolute(prefixLengthWidth);

  const prefixLength = decodeUintMax32(
    bytes.array.subarray(0, prefixLengthWidth),
    scheme.maxPathLength,
  );

  const prefix = reference.slice(0, prefixLength);

  bytes.prune(prefixLengthWidth);

  const suffix = await decodeStreamPath(scheme, bytes);

  return prefix.concat(suffix);
}

/** Determine the bytelength of a {@linkcode Path} encoded relative to another `Path`. */
export function encodedPathRelativeLength(
  scheme: PathScheme,
  primary: Path,
  reference: Path,
): number {
  const longestPrefixLength = commonPrefix(reference, primary).length;

  const prefixLengthLength = max32Width(scheme.maxComponentCount);

  const suffix = primary.slice(longestPrefixLength);

  const suffixLength = encodedPathLength(scheme, suffix);

  return prefixLengthLength + suffixLength;
}
