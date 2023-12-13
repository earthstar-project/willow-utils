import { orderPath, orderTimestamp } from "../order/order.ts";
import { TotalOrder } from "../order/types.ts";
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

/** Intersect two ranges */
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
