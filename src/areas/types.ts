import type { Range } from "../ranges/types.ts";

/** Represents any subspace ID. */
export const ANY_SUBSPACE = Symbol("ANY_SUBSPACE");

/** A grouping of Entries.
 *
 * https://willowprotocol.org/specs/grouping-entries/index.html#areas
 */
export type Area<SubspaceType> = {
  /** To be included in this Area, an Entry’s timestamp must be included in the time_range. */
  timeRange: Range<bigint>;
  /** To be included in this Area, an Entry’s path must be prefixed by the path_prefix. */
  pathPrefix: Uint8Array[];
  /** To be included in this Area, an Entry’s subspace_id must be equal to the included_subspace_id, unless it is any. */
  includedSubspaceId: SubspaceType | typeof ANY_SUBSPACE;
};

/** A grouping of Entries that are among the newest in some store. */
export type AreaOfInterest<SubspaceType> = {
  /** To be included in this AreaOfInterest, an Entry must be included in the area. */
  area: Area<SubspaceType>;
  /** To be included in this AreaOfInterest, an Entry’s timestamp must be among the max_count greatest Timestamps, unless max_count is zero. */
  maxCount: number;
  /** The total payload_lengths of all included Entries is at most max_size, unless max_size is zero. */
  maxSize: bigint;
};
