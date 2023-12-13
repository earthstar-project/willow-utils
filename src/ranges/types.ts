import { Path } from "../paths/types.ts";

export const OPEN_END = Symbol("OPEN_END");

export type Range<ValueType> = {
  start: ValueType;
  end: ValueType | typeof OPEN_END;
};

export type Range3d<SubspaceType> = {
  timeRange: Range<bigint>;
  pathRange: Range<Path>;
  subspaceRange: Range<SubspaceType>;
};

export type Position3d<SubspaceType> = {
  time: bigint;
  path: Path;
  subspace: SubspaceType;
};
