import { concat, equalsBytes } from "../../deps.ts";
import {
  decodeUintMax32,
  encodeUintMax32,
  max32Width,
} from "../encoding/encoding.ts";
import { orderPathComponent } from "../order/order.ts";
import { PathScheme } from "../parameters/types.ts";
import { Path } from "./types.ts";

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

export function isValidPath(
  path: Path,
  maxComponentCount: number,
  maxComponentLength: number,
  maxPathLength: number,
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

export function isPathPrefixed(prefix: Path, path: Path): boolean {
  if (prefix.length > path.length) {
    return false;
  }

  for (let i = 0; i < prefix.length; i++) {
    const prefixComponent = prefix[i];
    const testComponent = path[i];

    const order = orderPathComponent(prefixComponent, testComponent);

    if (order !== 0) {
      return false;
    }
  }

  return true;
}

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

    componentBytes.push(concat(lengthBytes, component));
  }

  return concat(componentCountBytes, ...componentBytes);
}

export function decodePath(pathScheme: PathScheme, encPath: Uint8Array): Path {
  const maxCountWidth = max32Width(pathScheme.maxComponentCount);
  const countBytes = encPath.subarray(0, maxCountWidth);

  const componentCount = decodeUintMax32(countBytes);

  let position = maxCountWidth;

  const componentLengthWidth = max32Width(pathScheme.maxComponentLength);

  const path: Path = [];

  for (let i = 0; i < componentCount; i++) {
    const lengthBytes = encPath.subarray(
      position,
      position + componentLengthWidth,
    );

    const componentLength = decodeUintMax32(lengthBytes);
    const pathComponent = encPath.subarray(
      position + componentLengthWidth,
      position + componentLengthWidth + componentLength,
    );

    path.push(pathComponent);

    position += componentLengthWidth + componentLength;
  }

  return path;
}

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

export function encodePathRelative(
  scheme: PathScheme,
  primary: Path,
  reference: Path,
) {
  const longestPrefixLength = commonPrefix(primary, reference).length;

  const prefixLengthBytes = encodeUintMax32(
    longestPrefixLength,
    scheme.maxComponentCount,
  );

  const suffix = reference.slice(longestPrefixLength);

  const suffixBytes = encodePath(scheme, suffix);

  return concat(prefixLengthBytes, suffixBytes);
}

export function decodePathRelative(
  scheme: PathScheme,
  primary: Path,
  encodedReference: Uint8Array,
): Path {
  const prefixLengthWidth = max32Width(scheme.maxComponentCount);

  const prefixLength = decodeUintMax32(
    encodedReference.subarray(0, prefixLengthWidth),
  );

  const prefix = primary.slice(0, prefixLength);

  const suffix = decodePath(
    scheme,
    encodedReference.subarray(prefixLengthWidth),
  );

  return prefix.concat(suffix);
}

export function encodedPathRelativeLength(
  scheme: PathScheme,
  primary: Path,
  reference: Path,
) {
  const longestPrefixLength = commonPrefix(primary, reference).length;

  const prefixLengthLength = max32Width(scheme.maxComponentCount);

  const suffix = reference.slice(longestPrefixLength);

  const suffixLength = encodedPathLength(scheme, suffix);

  return prefixLengthLength + suffixLength;
}
