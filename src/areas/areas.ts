import { concat } from "../../deps.ts";
import {
  compactWidth,
  decodeCompactWidth,
  encodeCompactWidth,
} from "../encoding/encoding.ts";
import { orderTimestamp } from "../order/order.ts";
import { successorPath } from "../order/successor.ts";
import { SuccessorFn, TotalOrder } from "../order/types.ts";
import { EncodingScheme, PathScheme } from "../parameters/types.ts";
import {
  decodePathRelative,
  encodedPathRelativeLength,
  encodePathRelative,
  isPathPrefixed,
} from "../paths/paths.ts";
import {
  intersectRange,
  isIncludedRange,
  rangeIsIncluded,
} from "../ranges/ranges.ts";
import { OPEN_END, Position3d, Range3d } from "../ranges/types.ts";
import { ANY_SUBSPACE, Area } from "./types.ts";

export function isSubspaceIncludedInArea<SubspaceType>(
  orderSubspace: TotalOrder<SubspaceType>,
  area: Area<SubspaceType>,
  subspace: SubspaceType,
): boolean {
  if (area.includedSubspaceId === ANY_SUBSPACE) {
    return true;
  }

  return orderSubspace(area.includedSubspaceId, subspace) === 0;
}

export function isIncludedArea<SubspaceType>(
  orderSubspace: TotalOrder<SubspaceType>,
  area: Area<SubspaceType>,
  position: Position3d<SubspaceType>,
): boolean {
  if (!isSubspaceIncludedInArea(orderSubspace, area, position.subspace)) {
    return false;
  }

  if (
    !isIncludedRange(orderTimestamp, area.timeRange, position.time)
  ) {
    return false;
  }

  if (!isPathPrefixed(area.pathPrefix, position.path)) {
    return false;
  }

  return true;
}

export function areaIsIncluded<SubspaceType>(
  orderSubspace: TotalOrder<SubspaceType>,
  inner: Area<SubspaceType>,
  outer: Area<SubspaceType>,
): boolean {
  if (
    outer.includedSubspaceId !== ANY_SUBSPACE &&
    inner.includedSubspaceId === ANY_SUBSPACE
  ) {
    return false;
  }

  if (
    outer.includedSubspaceId !== ANY_SUBSPACE &&
    inner.includedSubspaceId !== ANY_SUBSPACE &&
    orderSubspace(outer.includedSubspaceId, inner.includedSubspaceId) !== 0
  ) {
    return false;
  }

  if (!isPathPrefixed(outer.pathPrefix, inner.pathPrefix)) {
    return false;
  }

  if (!rangeIsIncluded(orderTimestamp, outer.timeRange, inner.timeRange)) {
    return false;
  }

  return true;
}

export function intersectArea<SubspaceType>(
  orderSubspace: TotalOrder<SubspaceType>,
  a: Area<SubspaceType>,
  b: Area<SubspaceType>,
): Area<SubspaceType> | null {
  if (
    a.includedSubspaceId !== ANY_SUBSPACE &&
    b.includedSubspaceId !== ANY_SUBSPACE &&
    orderSubspace(a.includedSubspaceId, b.includedSubspaceId) !== 0
  ) {
    return null;
  }

  const isPrefixA = isPathPrefixed(a.pathPrefix, b.pathPrefix);
  const isPrefixB = isPathPrefixed(b.pathPrefix, a.pathPrefix);

  if (!isPrefixA && !isPrefixB) {
    return null;
  }

  const timeIntersection = intersectRange(
    orderTimestamp,
    a.timeRange,
    b.timeRange,
  );

  if (timeIntersection === null) {
    return null;
  }

  if (isPrefixA) {
    return {
      includedSubspaceId: a.includedSubspaceId,
      pathPrefix: b.pathPrefix,
      timeRange: timeIntersection,
    };
  }

  return {
    includedSubspaceId: a.includedSubspaceId,
    pathPrefix: a.pathPrefix,
    timeRange: timeIntersection,
  };
}

export function areaTo3dRange<SubspaceType>(
  opts: {
    successorSubspace: SuccessorFn<SubspaceType>;
    maxPathLength: number;
    maxComponentCount: number;
    maxPathComponentLength: number;
    minimalSubspace: SubspaceType;
  },
  area: Area<SubspaceType>,
): Range3d<SubspaceType> {
  return {
    timeRange: area.timeRange,
    subspaceRange: area.includedSubspaceId === ANY_SUBSPACE
      ? {
        start: opts.minimalSubspace,
        end: OPEN_END,
      }
      : {
        start: area.includedSubspaceId,
        end: opts.successorSubspace(area.includedSubspaceId) || OPEN_END,
      },
    pathRange: {
      start: area.pathPrefix,
      end: successorPath(
        area.pathPrefix,
        opts.maxComponentCount,
        opts.maxPathComponentLength,
        opts.maxPathLength,
      ) || OPEN_END,
    },
  };
}

const REALLY_BIG_INT = BigInt(2 ** 1023);

function bigIntMin(a: bigint, b: bigint) {
  if (a < b) {
    return a;
  }

  return b;
}

export function encodeAreaInArea<SubspaceId>(
  opts: {
    subspaceScheme: EncodingScheme<SubspaceId> & {
      order: TotalOrder<SubspaceId>;
    };

    pathScheme: PathScheme;
  },
  inner: Area<SubspaceId>,
  outer: Area<SubspaceId>,
): Uint8Array {
  if (!areaIsIncluded(opts.subspaceScheme.order, inner, outer)) {
    throw new Error("Inner is not included by outer");
  }

  const innerEnd = inner.timeRange.end === OPEN_END
    ? REALLY_BIG_INT
    : inner.timeRange.end;
  const outerEnd = outer.timeRange.end === OPEN_END
    ? REALLY_BIG_INT
    : outer.timeRange.end;

  const startDiff = bigIntMin(
    inner.timeRange.start - outer.timeRange.start,
    outerEnd - inner.timeRange.start,
  );

  const endDiff = bigIntMin(
    innerEnd - inner.timeRange.start,
    outerEnd - innerEnd,
  );

  let flags = 0x0;

  if (inner.timeRange.end === OPEN_END) {
    flags |= 0x80;
  }

  const isSubspaceSame = (inner.includedSubspaceId === ANY_SUBSPACE &&
    outer.includedSubspaceId === ANY_SUBSPACE) ||
    (inner.includedSubspaceId !== ANY_SUBSPACE &&
      outer.includedSubspaceId !== ANY_SUBSPACE &&
      (opts.subspaceScheme.order(
        inner.includedSubspaceId,
        outer.includedSubspaceId,
      ) === 0));

  if (!isSubspaceSame) {
    flags |= 0x40;
  }

  if (startDiff === inner.timeRange.start - outer.timeRange.start) {
    flags |= 0x20;
  }

  if (endDiff === innerEnd - inner.timeRange.start) {
    flags |= 0x10;
  }

  const startDiffCompactWidth = compactWidth(startDiff);

  if (startDiffCompactWidth === 4 || startDiffCompactWidth === 8) {
    flags |= 0x8;
  }

  if (startDiffCompactWidth === 2 || startDiffCompactWidth === 8) {
    flags |= 0x4;
  }

  const endDiffCompactWidth = compactWidth(endDiff);

  if (endDiffCompactWidth === 4 || endDiffCompactWidth === 8) {
    flags |= 0x2;
  }

  if (endDiffCompactWidth === 2 || endDiffCompactWidth === 8) {
    flags |= 0x1;
  }

  const flagByte = new Uint8Array([flags]);

  const startDiffBytes = encodeCompactWidth(startDiff);
  const endDiffBytes = inner.timeRange.end === OPEN_END
    ? new Uint8Array()
    : encodeCompactWidth(endDiff);

  const relativePathBytes = encodePathRelative(
    opts.pathScheme,
    outer.pathPrefix,
    inner.pathPrefix,
  );

  const subspaceIdBytes = isSubspaceSame
    ? new Uint8Array()
    : opts.subspaceScheme.encode(inner.includedSubspaceId as SubspaceId);

  return concat(
    flagByte,
    startDiffBytes,
    endDiffBytes,
    relativePathBytes,
    subspaceIdBytes,
  );
}

export function decodeAreaInArea<SubspaceId>(
  opts: {
    subspaceScheme: EncodingScheme<SubspaceId> & {
      order: TotalOrder<SubspaceId>;
    };

    pathScheme: PathScheme;
  },
  encodedInner: Uint8Array,
  outer: Area<SubspaceId>,
): Area<SubspaceId> {
  // holy moly okay. let's do this.
  const flags = encodedInner[0];

  const hasOpenEnd = (flags & 0x80) === 0x80;
  const includeInnerSubspaceId = (flags & 0x40) === 0x40;
  const addStartDiff = (flags & 0x20) === 0x20;
  const addEndDiff = (flags & 0x10) === 0x10;
  const startDiffWidth = 2 ** ((0xc & flags) >> 2);
  const endDiffWidth = 2 ** (0x3 & flags);

  if (hasOpenEnd) {
    const pathPos = 1 + startDiffWidth;

    const startDiff = BigInt(decodeCompactWidth(
      encodedInner.subarray(1, pathPos),
    ));

    const path = decodePathRelative(
      opts.pathScheme,
      outer.pathPrefix,
      encodedInner.subarray(pathPos),
    );

    const subspacePos = pathPos +
      encodedPathRelativeLength(opts.pathScheme, outer.pathPrefix, path);

    const subspaceId = includeInnerSubspaceId
      ? opts.subspaceScheme.decode(encodedInner.subarray(subspacePos))
      : outer.includedSubspaceId;

    return {
      pathPrefix: path,
      includedSubspaceId: subspaceId,
      timeRange: {
        start: addStartDiff
          ? outer.timeRange.start + startDiff
          : outer.timeRange.start - startDiff,
        end: OPEN_END,
      },
    };
  }

  const endDiffPos = 1 + startDiffWidth;
  const pathPos = endDiffPos + endDiffWidth;

  const startDiff = BigInt(decodeCompactWidth(
    encodedInner.subarray(1, endDiffPos),
  ));

  const endDiff = BigInt(decodeCompactWidth(
    encodedInner.subarray(endDiffPos, pathPos),
  ));

  const path = decodePathRelative(
    opts.pathScheme,
    outer.pathPrefix,
    encodedInner.subarray(pathPos),
  );

  const subspacePos = pathPos +
    encodedPathRelativeLength(opts.pathScheme, outer.pathPrefix, path);

  const subspaceId = includeInnerSubspaceId
    ? opts.subspaceScheme.decode(encodedInner.subarray(subspacePos))
    : outer.includedSubspaceId;

  const innerStart = addStartDiff
    ? outer.timeRange.start + startDiff
    : outer.timeRange.start - startDiff;

  return {
    pathPrefix: path,
    includedSubspaceId: subspaceId,
    timeRange: {
      start: innerStart,
      end: addEndDiff
        ? innerStart + endDiff
        : outer.timeRange.end as bigint - endDiff,
    },
  };
}
