import { Range } from "../ranges/types.ts";

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
