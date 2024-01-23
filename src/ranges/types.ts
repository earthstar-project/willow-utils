import { Path } from "../paths/types.ts";

/** Represents an open value for a range ending. */
export const OPEN_END = Symbol("OPEN_END");

/** A closed or open range of values.
 *
 * https://willowprotocol.org/specs/grouping-entries/index.html#range
 */
export type Range<ValueType> = {
  start: ValueType;
  end: ValueType | typeof OPEN_END;
};

/** A three-dimensional with dimension of time, path, and subspace. */
export type Range3d<SubspaceType> = {
  timeRange: Range<bigint>;
  pathRange: Range<Path>;
  subspaceRange: Range<SubspaceType>;
};

/** A position in a space with dimensions of time, path, and subspace. */
export type Position3d<SubspaceType> = {
  time: bigint;
  path: Path;
  subspace: SubspaceType;
};
