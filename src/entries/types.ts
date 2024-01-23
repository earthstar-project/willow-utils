import { Path } from "../paths/types.ts";

/** The metadata for storing a payload. */
export type Entry<NamespaceId, SubspaceId, PayloadDigest> = {
  /** The identifier of the namespace to which the Entry belongs. */
  namespaceId: NamespaceId;
  /** The identifier of the subspace to which the Entry belongs. */
  subspaceId: SubspaceId;
  /** The Path to which the Entry was written. */
  path: Path;
  /** The claimed creation time of the Entry. */
  timestamp: bigint;
  /** The length of the Payload in bytes. */
  payloadLength: bigint;
  /** The result of hashing the entry's payload. */
  payloadDigest: PayloadDigest;
};
