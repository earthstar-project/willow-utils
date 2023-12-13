import { Range } from "../ranges/types.ts";

/** A grouping of Entries. */
export type Area<SubspaceType> = {
  /** To be included in this Area, an Entry’s timestamp must be included in the time_range. */
  timeRange: Range<bigint>;
  /** To be included in this Area, an Entry’s path must be prefixed by the path_prefix. */
  pathPrefix: Uint8Array[];
  /** To be included in this Area, an Entry’s subspace_id must be equal to the included_subspace_id, unless it is any. */
  includedSubspaceId: SubspaceType;
};
