import { Position3d } from "../ranges/types.ts";
import { Entry } from "./types.ts";

export function entryPosition<NamespaceKey, SubspaceKey, PayloadDigest>(
  entry: Entry<NamespaceKey, SubspaceKey, PayloadDigest>,
): Position3d<SubspaceKey> {
  return {
    path: entry.identifier.path,
    subspace: entry.identifier.subspace,
    time: entry.record.timestamp,
  };
}
