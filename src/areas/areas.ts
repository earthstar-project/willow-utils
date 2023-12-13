import { orderTimestamp } from "../order/order.ts";
import { successorPath } from "../order/successor.ts";
import { SuccessorFn, TotalOrder } from "../order/types.ts";
import { isPathPrefixed } from "../paths/paths.ts";
import {
  intersectRange,
  isIncludedRange,
  rangeIsIncluded,
} from "../ranges/ranges.ts";
import { OPEN_END, Position3d, Range3d } from "../ranges/types.ts";
import { Area } from "./types.ts";

export function isIncludedArea<SubspaceType>(
  orderSubspace: TotalOrder<SubspaceType>,
  area: Area<SubspaceType>,
  position: Position3d<SubspaceType>,
): boolean {
  if (orderSubspace(area.includedSubspaceId, position.subspace) !== 0) {
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
  parentArea: Area<SubspaceType>,
  area: Area<SubspaceType>,
): boolean {
  if (
    orderSubspace(parentArea.includedSubspaceId, area.includedSubspaceId) !== 0
  ) {
    return false;
  }

  if (!isPathPrefixed(parentArea.pathPrefix, area.pathPrefix)) {
    return false;
  }

  if (!rangeIsIncluded(orderTimestamp, parentArea.timeRange, area.timeRange)) {
    return false;
  }

  return true;
}

export function intersectArea<SubspaceType>(
  orderSubspace: TotalOrder<SubspaceType>,
  a: Area<SubspaceType>,
  b: Area<SubspaceType>,
): Area<SubspaceType> | null {
  if (orderSubspace(a.includedSubspaceId, b.includedSubspaceId) !== 0) {
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
  },
  area: Area<SubspaceType>,
): Range3d<SubspaceType> {
  return {
    timeRange: area.timeRange,
    subspaceRange: {
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
