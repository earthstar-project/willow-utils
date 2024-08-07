import { concat } from "@std/bytes";
import {
  compactWidth,
  decodeCompactWidth,
  encodeCompactWidth,
} from "../encoding/encoding.ts";
import type { GrowingBytes } from "../encoding/growing_bytes.ts";
import type { EncodingScheme } from "../encoding/types.ts";
import type { Entry } from "../entries/types.ts";
import { orderTimestamp } from "../order/order.ts";
import { successorPrefix } from "../order/successor.ts";
import type { SuccessorFn, TotalOrder } from "../order/types.ts";
import type { PathScheme } from "../parameters/types.ts";
import {
  decodePathRelative,
  decodeStreamPathRelative,
  encodedPathRelativeLength,
  encodePathRelative,
  isPathPrefixed,
} from "../paths/paths.ts";
import {
  intersectRange,
  isIncludedRange,
  rangeIsIncluded,
} from "../ranges/ranges.ts";
import { OPEN_END, type Position3d, type Range3d } from "../ranges/types.ts";
import { ANY_SUBSPACE, type Area } from "./types.ts";

/** The full area is the Area including all Entries. */
export function fullArea<SubspaceId>(): Area<SubspaceId> {
  return {
    includedSubspaceId: ANY_SUBSPACE,
    pathPrefix: [],
    timeRange: {
      start: BigInt(0),
      end: OPEN_END,
    },
  };
}

/** The subspace area is the Area include all entries with a given subspace ID. */
export function subspaceArea<SubspaceId>(
  subspaceId: SubspaceId,
): Area<SubspaceId> {
  return {
    includedSubspaceId: subspaceId,
    pathPrefix: [],
    timeRange: {
      start: BigInt(0),
      end: OPEN_END,
    },
  };
}

/** Return whether a subspace ID is included by an `Area`. */
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

/** Return whether a 3d position is included by an `Area`. */
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

/** Return whether an area is fully included by another area. */
export function areaIsIncluded<SubspaceType>(
  orderSubspace: TotalOrder<SubspaceType>,
  /** The area being tested for inclusion. */
  inner: Area<SubspaceType>,
  /** The area which we are testing for inclusion within. */
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

/** Return the intersection of two areas, for which there may be none. */
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

/** Convert an `Area` to a `Range3d`. */
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
      end: successorPrefix(
        area.pathPrefix,
        {
          maxComponentCount: opts.maxComponentCount,
          maxComponentLength: opts.maxPathComponentLength,
          maxPathLength: opts.maxPathLength,
        },
      ) || OPEN_END,
    },
  };
}

const REALLY_BIG_INT = BigInt(2 ** 64);

/** `Math.min`, but for `BigInt`. */
function bigIntMin(a: bigint, b: bigint) {
  if (a < b) {
    return a;
  }

  return b;
}

/** Encode an `Area` relative to known outer `Area`.
 *
 * https://willowprotocol.org/specs/encodings/index.html#enc_area_in_area
 */
export function encodeAreaInArea<SubspaceId>(
  opts: {
    encodeSubspace: (subspace: SubspaceId) => Uint8Array;
    orderSubspace: TotalOrder<SubspaceId>;
    pathScheme: PathScheme;
  },
  /** The area to be encoded relative to `outer`. */
  inner: Area<SubspaceId>,
  /** The area which includes `inner` and which will be used to decode this relative encoding. */
  outer: Area<SubspaceId>,
): Uint8Array {
  if (!areaIsIncluded(opts.orderSubspace, inner, outer)) {
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

  const isSubspaceSame = (inner.includedSubspaceId === ANY_SUBSPACE &&
    outer.includedSubspaceId === ANY_SUBSPACE) ||
    (inner.includedSubspaceId !== ANY_SUBSPACE &&
      outer.includedSubspaceId !== ANY_SUBSPACE &&
      (opts.orderSubspace(
        inner.includedSubspaceId,
        outer.includedSubspaceId,
      ) === 0));

  if (!isSubspaceSame) {
    flags |= 0x80;
  }

  if (inner.timeRange.end === OPEN_END) {
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
    inner.pathPrefix,
    outer.pathPrefix,
  );

  const subspaceIdBytes = isSubspaceSame
    ? new Uint8Array()
    : opts.encodeSubspace(
      inner.includedSubspaceId as SubspaceId,
    );

  return concat(
    [
      flagByte,
      startDiffBytes,
      endDiffBytes,
      relativePathBytes,
      subspaceIdBytes,
    ],
  );
}

/** The length of an encoded area in area. */
export function encodeAreaInAreaLength<SubspaceId>(
  opts: {
    encodeSubspaceIdLength: (subspace: SubspaceId) => number;
    orderSubspace: TotalOrder<SubspaceId>;
    pathScheme: PathScheme;
  },
  inner: Area<SubspaceId>,
  outer: Area<SubspaceId>,
): number {
  const isSubspaceSame = (inner.includedSubspaceId === ANY_SUBSPACE &&
    outer.includedSubspaceId === ANY_SUBSPACE) ||
    (inner.includedSubspaceId !== ANY_SUBSPACE &&
      outer.includedSubspaceId !== ANY_SUBSPACE &&
      (opts.orderSubspace(
        inner.includedSubspaceId,
        outer.includedSubspaceId,
      ) === 0));

  const subspaceLen = isSubspaceSame
    ? 0
    : opts.encodeSubspaceIdLength(inner.includedSubspaceId as SubspaceId);

  const pathLen = encodedPathRelativeLength(
    opts.pathScheme,
    inner.pathPrefix,
    outer.pathPrefix,
  );

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

  const startDiffLen = compactWidth(startDiff);
  const endDiffLen = inner.timeRange.end === OPEN_END
    ? 0
    : compactWidth(endDiff);

  return 1 + subspaceLen + pathLen + startDiffLen + endDiffLen;
}

/** Decode an `Area` relative to a known outer `Area`.
 *
 * https://willowprotocol.org/specs/encodings/index.html#enc_area_in_area
 */
export function decodeAreaInArea<SubspaceId>(
  opts: {
    decodeSubspaceId: EncodingScheme<SubspaceId>["decode"];
    pathScheme: PathScheme;
  },
  /** The encoded inner area relative to the outer area. */
  encodedInner: Uint8Array,
  /** The known area the inner area was encoded relative to. */
  outer: Area<SubspaceId>,
): Area<SubspaceId> {
  const flags = encodedInner[0];

  const includeInnerSubspaceId = (flags & 0x80) === 0x80;
  const hasOpenEnd = (flags & 0x40) === 0x40;
  const addStartDiff = (flags & 0x20) === 0x20;
  const addEndDiff = (flags & 0x10) === 0x10;
  const startDiffWidth = 2 ** (0x3 & (flags >> 2));
  const endDiffWidth = 2 ** (0x3 & flags);

  if (hasOpenEnd) {
    const pathPos = 1 + startDiffWidth;

    const startDiff = BigInt(decodeCompactWidth(
      encodedInner.subarray(1, pathPos),
    ));

    const path = decodePathRelative(
      opts.pathScheme,
      encodedInner.subarray(pathPos),
      outer.pathPrefix,
    );

    const subspacePos = pathPos +
      encodedPathRelativeLength(opts.pathScheme, path, outer.pathPrefix);

    const subspaceId = includeInnerSubspaceId
      ? opts.decodeSubspaceId(encodedInner.subarray(subspacePos))
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
    encodedInner.subarray(pathPos),
    outer.pathPrefix,
  );

  const subspacePos = pathPos +
    encodedPathRelativeLength(opts.pathScheme, path, outer.pathPrefix);

  const subspaceId = includeInnerSubspaceId
    ? opts.decodeSubspaceId(encodedInner.subarray(subspacePos))
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

const compactWidthEndMasks: Record<1 | 2 | 4 | 8, number> = {
  1: 0x0,
  2: 0x1,
  4: 0x2,
  8: 0x3,
};

/** Decode an {@linkcode Area} encoded relative to an outer `Area` from a {@linkcode GrowingBytes}.  */
export async function decodeStreamAreaInArea<SubspaceId>(
  opts: {
    pathScheme: PathScheme;
    decodeStreamSubspace: EncodingScheme<SubspaceId>["decodeStream"];
  },
  bytes: GrowingBytes,
  outer: Area<SubspaceId>,
): Promise<Area<SubspaceId>> {
  await bytes.nextAbsolute(1);

  const flags = bytes.array[0];

  const includeInnerSubspaceId = (flags & 0x80) === 0x80;
  const hasOpenEnd = (flags & 0x40) === 0x40;
  const addStartDiff = (flags & 0x20) === 0x20;
  const addEndDiff = (flags & 0x10) === 0x10;
  const startDiffWidth = 2 ** (0x3 & (flags >> 2));
  const endDiffWidth = 2 ** (0x3 & flags);

  bytes.prune(1);

  if (hasOpenEnd) {
    await bytes.nextAbsolute(startDiffWidth);

    const startDiff = BigInt(decodeCompactWidth(
      bytes.array.subarray(0, startDiffWidth),
    ));

    bytes.prune(startDiffWidth);

    const path = await decodeStreamPathRelative(
      opts.pathScheme,
      bytes,
      outer.pathPrefix,
    );

    const subspaceId = includeInnerSubspaceId
      ? await opts.decodeStreamSubspace(bytes)
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

  await bytes.nextAbsolute(startDiffWidth);

  const startDiff = BigInt(decodeCompactWidth(
    bytes.array.subarray(0, startDiffWidth),
  ));

  bytes.prune(startDiffWidth);

  await bytes.nextAbsolute(endDiffWidth);

  const endDiff = BigInt(decodeCompactWidth(
    bytes.array.subarray(0, endDiffWidth),
  ));

  bytes.prune(endDiffWidth);

  const path = await decodeStreamPathRelative(
    opts.pathScheme,
    bytes,
    outer.pathPrefix,
  );

  const subspaceId = includeInnerSubspaceId
    ? await opts.decodeStreamSubspace(bytes)
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

/** Encode an {@linkcode Entry} relative to an {@linkcode Area}. */
export function encodeEntryInNamespaceArea<
  NamespaceId,
  SubspaceId,
  PayloadDigest,
>(
  opts: {
    encodeSubspaceId: (subspace: SubspaceId) => Uint8Array;
    encodePayloadDigest: (digest: PayloadDigest) => Uint8Array;
    pathScheme: PathScheme;
  },
  entry: Entry<NamespaceId, SubspaceId, PayloadDigest>,
  outer: Area<SubspaceId>,
): Uint8Array {
  let timeDiff: bigint;

  if (outer.timeRange.end === OPEN_END) {
    timeDiff = entry.timestamp - outer.timeRange.start;
  } else {
    timeDiff = bigIntMin(
      entry.timestamp - outer.timeRange.start,
      outer.timeRange.end - entry.timestamp,
    );
  }

  const isSubspaceAnyFlag = outer.includedSubspaceId === ANY_SUBSPACE
    ? 0x80
    : 0x0;

  let addTimeToStartOrSubtractFromEndFlag: number;

  if (outer.timeRange.end === OPEN_END) {
    addTimeToStartOrSubtractFromEndFlag = 0x40;
  } else {
    addTimeToStartOrSubtractFromEndFlag =
      entry.timestamp - outer.timeRange.start <= outer.timeRange.end
        ? 0x40
        : 0x0;
  }

  const compactWidthFlagsTimeDiff =
    compactWidthEndMasks[compactWidth(timeDiff)] << 4;

  const compactWidthFlagsPayloadLength =
    compactWidthEndMasks[compactWidth(entry.payloadLength)] << 2;

  const header = isSubspaceAnyFlag | addTimeToStartOrSubtractFromEndFlag |
    compactWidthFlagsTimeDiff | compactWidthFlagsPayloadLength;

  const encodedSubspace = outer.includedSubspaceId === ANY_SUBSPACE
    ? new Uint8Array()
    : opts.encodeSubspaceId(entry.subspaceId);

  const encodedPath = encodePathRelative(
    opts.pathScheme,
    entry.path,
    outer.pathPrefix,
  );

  const encodedTimeDiff = encodeCompactWidth(timeDiff);

  const encodedPayloadLength = encodeCompactWidth(entry.payloadLength);

  const encodedPayloadDigest = opts.encodePayloadDigest(entry.payloadDigest);

  return concat(
    [
      new Uint8Array([header]),
      encodedSubspace,
      encodedPath,
      encodedTimeDiff,
      encodedPayloadLength,
      encodedPayloadDigest,
    ],
  );
}

/** Decode an Entry relative to a namespace area from {@linkcode GrowingBytes}. */
export async function decodeStreamEntryInNamespaceArea<
  NamespaceId,
  SubspaceId,
  PayloadDigest,
>(
  opts: {
    decodeStreamSubspace: (bytes: GrowingBytes) => Promise<SubspaceId>;
    decodeStreamPayloadDigest: (bytes: GrowingBytes) => Promise<PayloadDigest>;
    pathScheme: PathScheme;
  },
  bytes: GrowingBytes,
  outer: Area<SubspaceId>,
  namespace: NamespaceId,
): Promise<Entry<NamespaceId, SubspaceId, PayloadDigest>> {
  await bytes.nextAbsolute(1);

  const [header] = bytes.array;

  const isSubspaceEncoded = (header & 0x80) === 0x80;
  const addToStartOrSubstractFromEnd = (header & 0x40) === 0x40;
  const compactWidthTimeDiff = 2 ** (header & 0x30 >> 4);
  const compactWidthPayloadLength = 2 ** (header & 0xc >> 2);

  bytes.prune(1);

  let subspace: SubspaceId;

  if (isSubspaceEncoded) {
    subspace = await opts.decodeStreamSubspace(bytes);
  } else if (outer.includedSubspaceId !== ANY_SUBSPACE) {
    subspace = outer.includedSubspaceId;
  } else {
    throw new Error(
      "Entry was encoded relative to area with specified subspace",
    );
  }

  const path = await decodeStreamPathRelative(
    opts.pathScheme,
    bytes,
    outer.pathPrefix,
  );

  await bytes.nextAbsolute(compactWidthTimeDiff);

  const timeDiff = BigInt(decodeCompactWidth(
    bytes.array.subarray(0, compactWidthTimeDiff),
  ));

  await bytes.nextAbsolute(compactWidthPayloadLength);

  const payloadLength = BigInt(decodeCompactWidth(
    bytes.array.subarray(
      compactWidthTimeDiff,
      compactWidthTimeDiff + compactWidthPayloadLength,
    ),
  ));

  bytes.prune(compactWidthTimeDiff + compactWidthPayloadLength);

  const payloadDigest = await opts.decodeStreamPayloadDigest(bytes);

  let timestamp: bigint;

  if (addToStartOrSubstractFromEnd) {
    timestamp = timeDiff + outer.timeRange.start;
  } else if (outer.timeRange.end !== OPEN_END) {
    timestamp = outer.timeRange.end - timeDiff;
  } else {
    throw new Error(
      "Entry was encoded relative to area with concrete time end",
    );
  }

  return {
    namespaceId: namespace,
    subspaceId: subspace,
    path,
    payloadLength,
    payloadDigest,
    timestamp,
  };
}
