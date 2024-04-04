import { concat } from "../../deps.ts";
import {
  compactWidth,
  decodeCompactWidth,
  encodeCompactWidth,
} from "../encoding/encoding.ts";
import { GrowingBytes } from "../encoding/growing_bytes.ts";
import { orderPath, orderTimestamp } from "../order/order.ts";
import { TotalOrder } from "../order/types.ts";
import { PathScheme } from "../parameters/types.ts";
import {
  commonPrefix,
  decodePathRelative,
  decodeStreamPathRelative,
  encodedPathRelativeLength,
  encodePathRelative,
} from "../paths/paths.ts";
import { Path } from "../paths/types.ts";
import { OPEN_END, Position3d, Range, Range3d } from "./types.ts";

/** Order a given pair of ranges by their type. Useful for functions using boolean logic based on the different combinations of range types. */
export function orderRangePair<ValueType>(
  a: Range<ValueType>,
  b: Range<ValueType>,
): [Range<ValueType>, Range<ValueType>] {
  if (
    (a.end === OPEN_END && b.end === OPEN_END) ||
    (a.end !== OPEN_END && b.end !== OPEN_END) ||
    (a.end === OPEN_END && b.end !== OPEN_END)
  ) {
    return [a, b];
  }

  return [b, a];
}

// Ranges

/* Returns whether the range's end is greater than its start. */
export function isValidRange<ValueType>(
  order: TotalOrder<ValueType>,
  range: Range<ValueType>,
): boolean {
  if (range.end === OPEN_END) {
    return true;
  }

  const startEndOrder = order(range.start, range.end);

  return startEndOrder < 0;
}

/** Returns whether a `Value` is included by a given `Range`. */
export function isIncludedRange<ValueType>(
  order: TotalOrder<ValueType>,
  range: Range<ValueType>,
  value: ValueType,
): boolean {
  const gteStart = order(value, range.start) >= 0;

  if (range.end === OPEN_END || !gteStart) {
    return gteStart;
  }

  const ltEnd = order(value, range.end) === -1;

  return ltEnd;
}

/** Returns the intersection of two ranges, of which there may be none. */
export function intersectRange<ValueType>(
  order: TotalOrder<ValueType>,
  a: Range<ValueType>,
  b: Range<ValueType>,
): Range<ValueType> | null {
  if (!isValidRange(order, a) || !isValidRange(order, b)) {
    throw new Error("Invalid ranges given");
  }

  const [x, y] = orderRangePair(a, b);

  if (x.end === OPEN_END && y.end === OPEN_END) {
    return {
      start: order(x.start, y.start) <= 0 ? y.start : x.start,
      end: OPEN_END,
    };
  } else if (
    x.end === OPEN_END &&
    y.end !== OPEN_END
  ) {
    const aStartBStartOrder = order(x.start, y.start);
    const aStartBEndOrder = order(x.start, y.end);

    if (aStartBStartOrder <= 0) {
      return y;
    } else if (
      aStartBStartOrder > 0 && aStartBEndOrder < 0
    ) {
      return {
        start: x.start,
        end: y.end,
      };
    }

    return null;
  } else if (
    x.end !== OPEN_END && y.end !== OPEN_END
  ) {
    const min = order(x.start, y.start) < 0 ? x : y;
    const max = min === x ? y : x;

    // reject if min's end is lte max's start
    if (order(min.end as ValueType, max.start) <= 0) {
      return null;
    }

    // reject if max's start is gte min's end
    if (order(max.start, min.end as ValueType) >= 0) {
      return null;
    }

    return {
      start: max.start,
      end: order(min.end as ValueType, max.end as ValueType) < 0
        ? min.end
        : max.end,
    };
  }

  return null;
}

/** Returns whether a range is fully included by another range. */
export function rangeIsIncluded<ValueType>(
  order: TotalOrder<ValueType>,
  parentRange: Range<ValueType>,
  range: Range<ValueType>,
): boolean {
  if (range.end === OPEN_END && parentRange.end !== OPEN_END) {
    return false;
  } else if (parentRange.end === OPEN_END) {
    return order(range.start, parentRange.start) >= 0;
  }
  const gteStart = order(range.start, parentRange.start) >= 0;

  if (!gteStart) {
    return false;
  }

  const lteEnd = order(range.end as ValueType, parentRange.end) <= 0;

  return lteEnd;
}

// 3D ranges

/* Returns whether all a 3d range's constituent ranges are valid, i.e. correctly ordered. */
export function isValidRange3d<SubspaceType>(
  orderSubspace: TotalOrder<SubspaceType>,
  range: Range3d<SubspaceType>,
): boolean {
  if (!isValidRange(orderTimestamp, range.timeRange)) {
    return false;
  }

  if (!isValidRange(orderPath, range.pathRange)) {
    return false;
  }

  if (!isValidRange(orderSubspace, range.subspaceRange)) {
    return false;
  }

  return true;
}

/** Returns whether a `Position3d` is included by a given `Range`. */
export function isIncluded3d<SubspaceType>(
  orderSubspace: TotalOrder<SubspaceType>,
  range: Range3d<SubspaceType>,
  position: Position3d<SubspaceType>,
): boolean {
  if (
    isIncludedRange(orderTimestamp, range.timeRange, position.time) === false
  ) {
    return false;
  }

  if (
    isIncludedRange(orderPath, range.pathRange, position.path) === false
  ) {
    return false;
  }

  if (
    isIncludedRange(orderSubspace, range.subspaceRange, position.subspace) ===
      false
  ) {
    return false;
  }

  return true;
}

export function intersectRange3d<SubspaceType>(
  orderSubspace: TotalOrder<SubspaceType>,
  a: Range3d<SubspaceType>,
  b: Range3d<SubspaceType>,
): Range3d<SubspaceType> | null {
  const intersectionTimestamp = intersectRange(
    orderTimestamp,
    a.timeRange,
    b.timeRange,
  );

  if (!intersectionTimestamp) {
    return null;
  }

  const intersectionSubspace = intersectRange(
    orderSubspace,
    a.subspaceRange,
    b.subspaceRange,
  );

  if (!intersectionSubspace) {
    return null;
  }

  const intersectionPath = intersectRange(
    orderPath,
    a.pathRange,
    b.pathRange,
  );

  if (!intersectionPath) {
    return null;
  }

  return {
    subspaceRange: intersectionSubspace,
    pathRange: intersectionPath,
    timeRange: intersectionTimestamp,
  };
}

export function isEqualRangeValue<ValueType>(
  order: TotalOrder<ValueType>,
  a: ValueType | typeof OPEN_END,
  b: ValueType | typeof OPEN_END,
) {
  if (a === OPEN_END && b === OPEN_END) {
    return true;
  }

  if (a !== OPEN_END && b !== OPEN_END && order(a, b) === 0) {
    return true;
  }

  return false;
}

function bigAbs(n: bigint) {
  return n < 0n ? -n : n;
}

/** `Math.min`, but for `BigInt`. */
function bigIntMin(a: bigint, b: bigint) {
  if (a < b) {
    return a;
  }

  return b;
}

export function encodeRange3dRelative<SubspaceId>(
  opts: {
    orderSubspace: TotalOrder<SubspaceId>;
    encodeSubspaceId: (subspace: SubspaceId) => Uint8Array;
    pathScheme: PathScheme;
  },
  range: Range3d<SubspaceId>,
  ref: Range3d<SubspaceId>,
): Uint8Array {
  // Flag 0-1
  let encodeSubspaceStartFlag: number;
  let encodedSubspaceStart: Uint8Array;

  if (
    isEqualRangeValue(
      opts.orderSubspace,
      range.subspaceRange.start,
      ref.subspaceRange.start,
    )
  ) {
    encodeSubspaceStartFlag = 0x40;
    encodedSubspaceStart = new Uint8Array();
  } else if (
    isEqualRangeValue(
      opts.orderSubspace,
      range.subspaceRange.start,
      ref.subspaceRange.end,
    )
  ) {
    encodeSubspaceStartFlag = 0x80;
    encodedSubspaceStart = new Uint8Array();
  } else {
    encodeSubspaceStartFlag = 0xc0;
    encodedSubspaceStart = opts.encodeSubspaceId(range.subspaceRange.start);
  }

  // Flag 2-3
  let encodeSubspaceEndFlag: number;
  let encodedSubspaceEnd: Uint8Array;

  if (range.subspaceRange.end === OPEN_END) {
    encodeSubspaceEndFlag = 0x0;
    encodedSubspaceEnd = new Uint8Array();
  } else if (
    isEqualRangeValue(
      opts.orderSubspace,
      range.subspaceRange.end,
      ref.subspaceRange.start,
    )
  ) {
    encodeSubspaceEndFlag = 0x10;
    encodedSubspaceEnd = new Uint8Array();
  } else if (
    isEqualRangeValue(
      opts.orderSubspace,
      range.subspaceRange.end,
      ref.subspaceRange.end,
    )
  ) {
    encodeSubspaceEndFlag = 0x20;
    encodedSubspaceEnd = new Uint8Array();
  } else {
    encodeSubspaceEndFlag = 0x30;
    encodedSubspaceEnd = opts.encodeSubspaceId(range.subspaceRange.end);
  }

  // Flag 4
  let encodePathStartRelToRefStart: number;
  let encodedPathStart: Uint8Array;

  if (ref.pathRange.end === OPEN_END) {
    encodePathStartRelToRefStart = 0x8;
    encodedPathStart = encodePathRelative(
      opts.pathScheme,
      range.pathRange.start,
      ref.pathRange.start,
    );
  } else {
    const commonPrefixStartStart = commonPrefix(
      range.pathRange.start,
      ref.pathRange.start,
    );

    const commonPrefixStartEnd = commonPrefix(
      range.pathRange.start,
      ref.pathRange.end,
    );

    if (commonPrefixStartStart.length >= commonPrefixStartEnd.length) {
      encodePathStartRelToRefStart = 0x8;
      encodedPathStart = encodePathRelative(
        opts.pathScheme,
        range.pathRange.start,
        ref.pathRange.start,
      );
    } else {
      encodePathStartRelToRefStart = 0x0;
      encodedPathStart = encodePathRelative(
        opts.pathScheme,
        range.pathRange.start,
        ref.pathRange.end,
      );
    }
  }

  // Flag 5
  const isPathEndOpen = range.pathRange.end === OPEN_END ? 0x4 : 0x0;

  // Flag 6
  let encodePathEndRelToRefStart: number;

  let encodedPathEnd: Uint8Array;

  if (range.pathRange.end === OPEN_END) {
    encodePathEndRelToRefStart = 0x0;
    encodedPathEnd = new Uint8Array();
  } else if (ref.pathRange.end === OPEN_END) {
    encodePathEndRelToRefStart = 0x2;
    encodedPathEnd = encodePathRelative(
      opts.pathScheme,
      range.pathRange.end,
      ref.pathRange.start,
    );
  } else {
    const commonPrefixEndStart = commonPrefix(
      range.pathRange.end,
      ref.pathRange.start,
    );
    const commonPrefixEndEnd = commonPrefix(
      range.pathRange.end,
      ref.pathRange.end,
    );

    if (commonPrefixEndStart.length >= commonPrefixEndEnd.length) {
      encodePathEndRelToRefStart = 0x2;
      encodedPathEnd = encodePathRelative(
        opts.pathScheme,
        range.pathRange.end,
        ref.pathRange.start,
      );
    } else {
      encodePathEndRelToRefStart = 0x0;
      encodedPathEnd = encodePathRelative(
        opts.pathScheme,
        range.pathRange.end,
        ref.pathRange.end,
      );
    }
  }

  // Flag 7
  const isTimeEndOpen = range.timeRange.end === OPEN_END ? 0x1 : 0x0;

  // Flag 8

  let encodeTimeStartRelToRefStart: number;

  if (ref.timeRange.end === OPEN_END) {
    encodeTimeStartRelToRefStart = 0x80;
  } else {
    const startToStart = bigAbs(range.timeRange.start - ref.timeRange.start);
    const startToEnd = bigAbs(range.timeRange.start - ref.timeRange.end);

    if (startToStart <= startToEnd) {
      encodeTimeStartRelToRefStart = 0x80;
    } else {
      encodeTimeStartRelToRefStart = 0x0;
    }
  }

  // Flag 9
  let addOrSubtractStartTimeDiff: number;

  if (encodeTimeStartRelToRefStart === 0x80) {
    if (range.timeRange.start >= ref.timeRange.start) {
      addOrSubtractStartTimeDiff = 0x40;
    } else {
      addOrSubtractStartTimeDiff = 0x0;
    }
  } else {
    if (
      ref.timeRange.end !== OPEN_END &&
      range.timeRange.start >= ref.timeRange.end
    ) {
      addOrSubtractStartTimeDiff = 0x40;
    } else {
      addOrSubtractStartTimeDiff = 0x0;
    }
  }

  // Flag 10-11

  let compactWidthStartTime: number;
  let encodedStartTime: Uint8Array;

  if (ref.timeRange.end === OPEN_END) {
    const startToStart = bigAbs(range.timeRange.start - ref.timeRange.start);

    const compactWidthStartTimeDiff = compactWidth(startToStart);

    compactWidthStartTime = compactWidthStartTimeDiff === 1
      ? 0x0
      : compactWidthStartTimeDiff === 2
      ? 0x10
      : compactWidthStartTimeDiff === 4
      ? 0x20
      : 0x30;

    encodedStartTime = encodeCompactWidth(startToStart);
  } else {
    const startToStart = bigAbs(range.timeRange.start - ref.timeRange.start);
    const startToEnd = bigAbs(range.timeRange.start - ref.timeRange.end);

    const startTimeDiff = bigIntMin(startToStart, startToEnd);

    const compactWidthStartTimeDiff = compactWidth(startTimeDiff);

    compactWidthStartTime = compactWidthStartTimeDiff === 1
      ? 0x0
      : compactWidthStartTimeDiff === 2
      ? 0x10
      : compactWidthStartTimeDiff === 4
      ? 0x20
      : 0x30;

    encodedStartTime = encodeCompactWidth(startTimeDiff);
  }

  // Flag 12

  let encodeTimeEndRelToRefStart: number;

  if (range.timeRange.end === OPEN_END) {
    encodeTimeEndRelToRefStart = 0x0;
  } else if (ref.timeRange.end !== OPEN_END) {
    const endToStart = bigAbs(range.timeRange.end - ref.timeRange.start);
    const endToEnd = bigAbs(range.timeRange.end - ref.timeRange.end);

    if (endToStart <= endToEnd) {
      encodeTimeEndRelToRefStart = 0x8;
    } else {
      encodeTimeEndRelToRefStart = 0x0;
    }
  } else {
    encodeTimeEndRelToRefStart = 0x8;
  }

  // Flag 13

  let addOrSubtractEndTimeDiff: number;

  if (range.timeRange.end === OPEN_END) {
    addOrSubtractEndTimeDiff = 0x0;
  } else {
    if (
      encodeTimeEndRelToRefStart === 0x8 &&
      range.timeRange.end >= ref.timeRange.start
    ) {
      addOrSubtractEndTimeDiff = 0x4;
    } else if (
      ref.timeRange.end !== OPEN_END &&
      encodeTimeEndRelToRefStart === 0x0 &&
      range.timeRange.end >= ref.timeRange.end
    ) {
      addOrSubtractEndTimeDiff = 0x4;
    } else {
      addOrSubtractEndTimeDiff = 0x0;
    }
  }

  // Bit 14 - 15

  let compactWidthEndTimeFlag: number;
  let encodedEndTime: Uint8Array;

  if (range.timeRange.end === OPEN_END) {
    compactWidthEndTimeFlag = 0x0;
    encodedEndTime = new Uint8Array();
  } else if (ref.timeRange.end !== OPEN_END) {
    const endToStart = bigAbs(range.timeRange.end - ref.timeRange.start);
    const endToEnd = bigAbs(range.timeRange.end - ref.timeRange.end);

    const endTimeDiff = bigIntMin(endToStart, endToEnd);

    const compactWidthEndTimeDiff = compactWidth(endTimeDiff);

    compactWidthEndTimeFlag = compactWidthEndTimeDiff === 1
      ? 0x0
      : compactWidthEndTimeDiff === 2
      ? 0x1
      : compactWidthEndTimeDiff === 4
      ? 0x2
      : 0x3;

    encodedEndTime = encodeCompactWidth(endTimeDiff);
  } else {
    const endToStart = bigAbs(range.timeRange.end - ref.timeRange.start);

    const compactWidthEndTimeDiff = compactWidth(endToStart);

    compactWidthEndTimeFlag = compactWidthEndTimeDiff === 1
      ? 0x0
      : compactWidthEndTimeDiff === 2
      ? 0x1
      : compactWidthEndTimeDiff === 4
      ? 0x2
      : 0x3;

    encodedEndTime = encodeCompactWidth(endToStart);
  }

  const firstByte = encodeSubspaceStartFlag |
    encodeSubspaceEndFlag | encodePathStartRelToRefStart |
    isPathEndOpen | encodePathEndRelToRefStart |
    isTimeEndOpen;

  const secondByte = encodeTimeStartRelToRefStart |
    addOrSubtractStartTimeDiff | compactWidthStartTime |
    encodeTimeEndRelToRefStart | addOrSubtractEndTimeDiff |
    compactWidthEndTimeFlag;

  return concat(
    new Uint8Array([firstByte, secondByte]),
    encodedSubspaceStart,
    encodedSubspaceEnd,
    encodedPathStart,
    encodedPathEnd,
    encodedStartTime,
    encodedEndTime,
  );
}

export function decodeRange3dRelative<SubspaceId>(
  opts: {
    decodeSubspaceId: (encoded: Uint8Array) => SubspaceId;
    encodedSubspaceIdLength: (subspace: SubspaceId) => number;
    pathScheme: PathScheme;
  },
  encoded: Uint8Array,
  ref: Range3d<SubspaceId>,
): Range3d<SubspaceId> {
  const [firstByte, secondByte] = encoded;

  // Flag 0-1
  const isSubspaceStartEncoded: "yes" | "ref_start" | "ref_end" | "invalid" =
    (firstByte & 0xc0) === 0xc0
      ? "yes"
      : (firstByte & 0x80) === 0x80
      ? "ref_end"
      : (firstByte & 0x40) === 0x40
      ? "ref_start"
      : "invalid";

  if (isSubspaceStartEncoded === "invalid") {
    throw new Error("Invalid 3d range relative to relative 3d range encoding");
  }

  // Flag 2-3
  const isSubspaceEndEncoded: "open" | "ref_start" | "ref_end" | "yes" =
    (firstByte & 0x30) === 0x30
      ? "yes"
      : (firstByte & 0x20) === 0x20
      ? "ref_end"
      : (firstByte & 0x10) === 0x10
      ? "ref_start"
      : "open";

  // Flag 4
  const isPathStartRelativeToRefStart = (firstByte & 0x8) === 0x8;
  // Flag 5
  const isRangePathEndOpen = (firstByte & 0x4) === 0x4;
  // Flag 6
  const isPathEndEncodedRelToRefStart = (firstByte & 0x2) === 0x2;
  // Flag 7
  const isTimeEndOpen = (firstByte & 0x1) === 0x1;

  // Second byte

  // Flag 8
  const encodeTimeStartRelToRefTimeStart = (secondByte & 0x80) === 0x80;
  // Flag 9
  const addStartTimeDiff = (secondByte & 0x40) === 0x40;
  // Flag 10-11
  const compactWidthStartTimeDiff = 2 ** ((secondByte & 0x30) >> 4);
  // Flag 12
  const encodeTimeEndRelToRefStart = (secondByte & 0x8) === 0x8;
  // Flag 13
  const addEndTimeDiff = (secondByte & 0x4) === 0x4;
  // Flag 14-15
  const compactWidthEndTimeDiff = 2 ** (secondByte & 0x3);

  // Now we decode the rest.
  let position = 2;

  // Subspace start.
  let subspaceStart: SubspaceId;

  switch (isSubspaceStartEncoded) {
    case "ref_start":
      subspaceStart = ref.subspaceRange.start;
      break;
    case "ref_end": {
      if (ref.subspaceRange.end !== OPEN_END) {
        subspaceStart = ref.subspaceRange.end;
      } else {
        throw new Error(
          "The start value of an encoded range cannot be that of the reference end (open)",
        );
      }
      break;
    }
    case "yes": {
      subspaceStart = opts.decodeSubspaceId(encoded.subarray(position));

      position += opts.encodedSubspaceIdLength(subspaceStart);
    }
  }

  // Subspace end
  let subspaceEnd: SubspaceId | typeof OPEN_END;

  switch (isSubspaceEndEncoded) {
    case "open": {
      subspaceEnd = OPEN_END;
      break;
    }
    case "ref_start": {
      subspaceEnd = ref.subspaceRange.start;
      break;
    }
    case "ref_end": {
      subspaceEnd = ref.subspaceRange.end;
      break;
    }
    case "yes": {
      subspaceEnd = opts.decodeSubspaceId(encoded.subarray(position));

      position += opts.encodedSubspaceIdLength(subspaceEnd);
    }
  }

  // Path start.
  let pathStart: Path;

  if (isPathStartRelativeToRefStart) {
    pathStart = decodePathRelative(
      opts.pathScheme,
      encoded.subarray(position),
      ref.pathRange.start,
    );

    position += encodedPathRelativeLength(
      opts.pathScheme,
      pathStart,
      ref.pathRange.start,
    );
  } else {
    if (ref.pathRange.end === OPEN_END) {
      throw new Error(
        "The start of a path range cannot be encoded relative to an open end.",
      );
    }

    pathStart = decodePathRelative(
      opts.pathScheme,
      encoded.subarray(position),
      ref.pathRange.end,
    );

    position += encodedPathRelativeLength(
      opts.pathScheme,
      pathStart,
      ref.pathRange.end,
    );
  }

  // Path end

  let pathEnd: Path | typeof OPEN_END;

  if (isRangePathEndOpen) {
    pathEnd = OPEN_END;
  } else if (isPathEndEncodedRelToRefStart) {
    pathEnd = decodePathRelative(
      opts.pathScheme,
      encoded.subarray(position),
      ref.pathRange.start,
    );

    position += encodedPathRelativeLength(
      opts.pathScheme,
      pathEnd,
      ref.pathRange.start,
    );
  } else {
    if (ref.pathRange.end === OPEN_END) {
      throw new Error(
        "The end of a path range cannot be encoded relative to an open end.",
      );
    }

    pathEnd = decodePathRelative(
      opts.pathScheme,
      encoded.subarray(position),
      ref.pathRange.end,
    );

    position += encodedPathRelativeLength(
      opts.pathScheme,
      pathEnd,
      ref.pathRange.end,
    );
  }

  // Time start

  const startTimeDiff = decodeCompactWidth(
    encoded.subarray(position, position + compactWidthStartTimeDiff),
  );

  position += compactWidthStartTimeDiff;

  let timeStart: bigint;

  if (encodeTimeStartRelToRefTimeStart) {
    if (addStartTimeDiff) {
      timeStart = ref.timeRange.start + BigInt(startTimeDiff);
    } else {
      timeStart = ref.timeRange.start - BigInt(startTimeDiff);
    }
  } else {
    if (ref.timeRange.end === OPEN_END) {
      throw new Error(
        "The start of a time range cannot be encoded relative to an open end",
      );
    }

    if (addStartTimeDiff) {
      timeStart = ref.timeRange.end + BigInt(startTimeDiff);
    } else {
      timeStart = ref.timeRange.end - BigInt(startTimeDiff);
    }
  }

  // Time end

  let timeEnd: bigint | typeof OPEN_END;

  if (isTimeEndOpen) {
    timeEnd = OPEN_END;
  } else {
    const endTimeDiff = decodeCompactWidth(
      encoded.subarray(position, position + compactWidthEndTimeDiff),
    );

    if (encodeTimeEndRelToRefStart) {
      if (addEndTimeDiff) {
        timeEnd = ref.timeRange.start + BigInt(endTimeDiff);
      } else {
        timeEnd = ref.timeRange.start - BigInt(endTimeDiff);
      }
    } else {
      if (ref.timeRange.end === OPEN_END) {
        throw new Error(
          "The end of a time range cannot be encoded relative to an open end",
        );
      }

      if (addEndTimeDiff) {
        timeEnd = ref.timeRange.end + BigInt(endTimeDiff);
      } else {
        timeEnd = ref.timeRange.end - BigInt(endTimeDiff);
      }
    }
  }

  return {
    subspaceRange: {
      start: subspaceStart,
      end: subspaceEnd,
    },
    pathRange: {
      start: pathStart,
      end: pathEnd,
    },
    timeRange: {
      start: timeStart,
      end: timeEnd,
    },
  };
}

export async function decodeStreamRange3dRelative<SubspaceId>(
  opts: {
    decodeStreamSubspaceId: (bytes: GrowingBytes) => Promise<SubspaceId>;

    pathScheme: PathScheme;
  },
  bytes: GrowingBytes,
  ref: Range3d<SubspaceId>,
): Promise<Range3d<SubspaceId>> {
  await bytes.nextAbsolute(2);

  const [firstByte, secondByte] = bytes.array;

  // Flag 0-1
  const isSubspaceStartEncoded: "yes" | "ref_start" | "ref_end" | "invalid" =
    (firstByte & 0xc0) === 0xc0
      ? "yes"
      : (firstByte & 0x80) === 0x80
      ? "ref_end"
      : (firstByte & 0x40) === 0x40
      ? "ref_start"
      : "invalid";

  if (isSubspaceStartEncoded === "invalid") {
    throw new Error("Invalid 3d range relative to relative 3d range encoding");
  }

  // Flag 2-3
  const isSubspaceEndEncoded: "open" | "ref_start" | "ref_end" | "yes" =
    (firstByte & 0x30) === 0x30
      ? "yes"
      : (firstByte & 0x20) === 0x20
      ? "ref_end"
      : (firstByte & 0x10) === 0x10
      ? "ref_start"
      : "open";

  // Flag 4
  const isPathStartRelativeToRefStart = (firstByte & 0x8) === 0x8;
  // Flag 5
  const isRangePathEndOpen = (firstByte & 0x4) === 0x4;
  // Flag 6
  const isPathEndEncodedRelToRefStart = (firstByte & 0x2) === 0x2;
  // Flag 7
  const isTimeEndOpen = (firstByte & 0x1) === 0x1;

  // Second byte

  // Flag 8
  const encodeTimeStartRelToRefTimeStart = (secondByte & 0x80) === 0x80;
  // Flag 9
  const addStartTimeDiff = (secondByte & 0x40) === 0x40;
  // Flag 10-11
  const compactWidthStartTimeDiff = 2 ** ((secondByte & 0x30) >> 4);
  // Flag 12
  const encodeTimeEndRelToRefStart = (secondByte & 0x8) === 0x8;
  // Flag 13
  const addEndTimeDiff = (secondByte & 0x4) === 0x4;
  // Flag 14-15
  const compactWidthEndTimeDiff = 2 ** (secondByte & 0x3);

  bytes.prune(2);

  // Subspace start.
  let subspaceStart: SubspaceId;

  switch (isSubspaceStartEncoded) {
    case "ref_start":
      subspaceStart = ref.subspaceRange.start;
      break;
    case "ref_end": {
      if (ref.subspaceRange.end !== OPEN_END) {
        subspaceStart = ref.subspaceRange.end;
      } else {
        throw new Error(
          "The start value of an encoded range cannot be that of the reference end (open)",
        );
      }
      break;
    }
    case "yes": {
      subspaceStart = await opts.decodeStreamSubspaceId(bytes);
    }
  }

  // Subspace end
  let subspaceEnd: SubspaceId | typeof OPEN_END;

  switch (isSubspaceEndEncoded) {
    case "open": {
      subspaceEnd = OPEN_END;
      break;
    }
    case "ref_start": {
      subspaceEnd = ref.subspaceRange.start;
      break;
    }
    case "ref_end": {
      subspaceEnd = ref.subspaceRange.end;
      break;
    }
    case "yes": {
      subspaceEnd = await opts.decodeStreamSubspaceId(bytes);
    }
  }

  // Path start.
  let pathStart: Path;

  if (isPathStartRelativeToRefStart) {
    pathStart = await decodeStreamPathRelative(
      opts.pathScheme,
      bytes,
      ref.pathRange.start,
    );
  } else {
    if (ref.pathRange.end === OPEN_END) {
      throw new Error(
        "The start of a path range cannot be encoded relative to an open end.",
      );
    }

    pathStart = await decodeStreamPathRelative(
      opts.pathScheme,
      bytes,
      ref.pathRange.end,
    );
  }

  // Path end

  let pathEnd: Path | typeof OPEN_END;

  if (isRangePathEndOpen) {
    pathEnd = OPEN_END;
  } else if (isPathEndEncodedRelToRefStart) {
    pathEnd = await decodeStreamPathRelative(
      opts.pathScheme,
      bytes,
      ref.pathRange.start,
    );
  } else {
    if (ref.pathRange.end === OPEN_END) {
      throw new Error(
        "The end of a path range cannot be encoded relative to an open end.",
      );
    }

    pathEnd = await decodeStreamPathRelative(
      opts.pathScheme,
      bytes,
      ref.pathRange.end,
    );
  }

  // Time start

  await bytes.nextAbsolute(compactWidthStartTimeDiff);

  const startTimeDiff = decodeCompactWidth(
    bytes.array.subarray(0, compactWidthStartTimeDiff),
  );

  bytes.prune(compactWidthStartTimeDiff);

  let timeStart: bigint;

  if (encodeTimeStartRelToRefTimeStart) {
    if (addStartTimeDiff) {
      timeStart = ref.timeRange.start + BigInt(startTimeDiff);
    } else {
      timeStart = ref.timeRange.start - BigInt(startTimeDiff);
    }
  } else {
    if (ref.timeRange.end === OPEN_END) {
      throw new Error(
        "The start of a time range cannot be encoded relative to an open end",
      );
    }

    if (addStartTimeDiff) {
      timeStart = ref.timeRange.end + BigInt(startTimeDiff);
    } else {
      timeStart = ref.timeRange.end - BigInt(startTimeDiff);
    }
  }

  // Time end

  let timeEnd: bigint | typeof OPEN_END;

  if (isTimeEndOpen) {
    timeEnd = OPEN_END;
  } else {
    await bytes.nextAbsolute(compactWidthEndTimeDiff);
    const endTimeDiff = decodeCompactWidth(
      bytes.array.subarray(0, compactWidthEndTimeDiff),
    );

    bytes.prune(compactWidthEndTimeDiff);

    if (encodeTimeEndRelToRefStart) {
      if (addEndTimeDiff) {
        timeEnd = ref.timeRange.start + BigInt(endTimeDiff);
      } else {
        timeEnd = ref.timeRange.start - BigInt(endTimeDiff);
      }
    } else {
      if (ref.timeRange.end === OPEN_END) {
        throw new Error(
          "The end of a time range cannot be encoded relative to  open end",
        );
      }

      if (addEndTimeDiff) {
        timeEnd = ref.timeRange.end + BigInt(endTimeDiff);
      } else {
        timeEnd = ref.timeRange.end - BigInt(endTimeDiff);
      }
    }
  }

  return {
    subspaceRange: {
      start: subspaceStart,
      end: subspaceEnd,
    },
    pathRange: {
      start: pathStart,
      end: pathEnd,
    },
    timeRange: {
      start: timeStart,
      end: timeEnd,
    },
  };
}

export function defaultRange3d<SubspaceId>(
  defaultSubspace: SubspaceId,
): Range3d<SubspaceId> {
  return {
    subspaceRange: {
      start: defaultSubspace,
      end: OPEN_END,
    },
    pathRange: {
      start: [],
      end: OPEN_END,
    },
    timeRange: {
      start: 0n,
      end: OPEN_END,
    },
  };
}
