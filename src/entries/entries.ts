import { concat } from "../../deps.ts";
import { bigintToBytes } from "../encoding/encoding.ts";
import { EncodingScheme, PathScheme } from "../parameters/types.ts";
import { decodePath, encodedPathLength, encodePath } from "../paths/paths.ts";
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

export function encodeEntry<NamespaceKey, SubspaceKey, PayloadDigest>(
  opts: {
    namespaceScheme: EncodingScheme<NamespaceKey>;
    subspaceScheme: EncodingScheme<SubspaceKey>;
    payloadScheme: EncodingScheme<PayloadDigest>;
    pathScheme: PathScheme;
  },
  entry: Entry<NamespaceKey, SubspaceKey, PayloadDigest>,
): Uint8Array {
  return concat(
    opts.namespaceScheme.encode(entry.identifier.namespace),
    opts.subspaceScheme.encode(entry.identifier.subspace),
    encodePath(opts.pathScheme, entry.identifier.path),
    bigintToBytes(entry.record.timestamp),
    bigintToBytes(entry.record.length),
    opts.payloadScheme.encode(entry.record.payloadDigest),
  );
}

export function decodeEntry<NamespaceKey, SubspaceKey, PayloadDigest>(
  opts: {
    namespaceScheme: EncodingScheme<NamespaceKey>;
    subspaceScheme: EncodingScheme<SubspaceKey>;
    payloadScheme: EncodingScheme<PayloadDigest>;
    pathScheme: PathScheme;
  },
  encEntry: Uint8Array,
): Entry<NamespaceKey, SubspaceKey, PayloadDigest> {
  // first get the namespace.

  const view = new DataView(encEntry.buffer);

  const namespace = opts.namespaceScheme.decode(encEntry);

  const subspacePos = opts.namespaceScheme.encodedLength(namespace);
  const subspace = opts.subspaceScheme.decode(encEntry.subarray(subspacePos));

  const pathPos = subspacePos + opts.subspaceScheme.encodedLength(subspace);

  const path = decodePath(opts.pathScheme, encEntry.subarray(pathPos));

  const timestampPos = pathPos + encodedPathLength(opts.pathScheme, path);
  const timestamp = view.getBigUint64(timestampPos);

  const lengthPos = timestampPos + 8;
  const length = view.getBigUint64(lengthPos);

  const payloadDigestPos = lengthPos + 8;
  const payloadDigest = opts.payloadScheme.decode(
    encEntry.subarray(payloadDigestPos),
  );

  return {
    identifier: {
      namespace,
      subspace,
      path,
    },
    record: {
      timestamp,
      length,
      payloadDigest,
    },
  };
}
