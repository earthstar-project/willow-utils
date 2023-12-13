import { Path } from "../paths/types.ts";

export type RecordIdentifier<NamespaceKey, SubspaceKey> = {
  /** The namespace's public key as a fixed-width integer */
  namespace: NamespaceKey;
  /** The author's public key as a fixed-width integer*/
  subspace: SubspaceKey;

  path: Path;
};

export type Record<PayloadDigest> = {
  /** 64 bit integer (interpreted as microseconds since the Unix epoch). Big-endian. */
  timestamp: bigint;
  /** 64 bit integer */
  length: bigint;
  /** digest-length bit integer*/
  hash: PayloadDigest;
};

export type Entry<NamespaceKey, SubspaceKey, PayloadDigest> = {
  identifier: RecordIdentifier<NamespaceKey, SubspaceKey>;
  record: Record<PayloadDigest>;
};
