import { concat } from "../../deps.ts";
import { bigintToBytes } from "../encoding/encoding.ts";
import { EncodingScheme, PathScheme } from "../parameters/types.ts";
import { decodePath, encodedPathLength, encodePath } from "../paths/paths.ts";
import { Position3d } from "../ranges/types.ts";
import { Entry } from "./types.ts";

/** Returns the `Position3d` of an `Entry`. */
export function entryPosition<NamespaceKey, SubspaceKey, PayloadDigest>(
  entry: Entry<NamespaceKey, SubspaceKey, PayloadDigest>,
): Position3d<SubspaceKey> {
  return {
    path: entry.path,
    subspace: entry.subspaceId,
    time: entry.timestamp,
  };
}

/** Encode an `Entry`.
 *
 * https://willowprotocol.org/specs/encodings/index.html#enc_entry
 */
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
    opts.namespaceScheme.encode(entry.namespaceId),
    opts.subspaceScheme.encode(entry.subspaceId),
    encodePath(opts.pathScheme, entry.path),
    bigintToBytes(entry.timestamp),
    bigintToBytes(entry.payloadLength),
    opts.payloadScheme.encode(entry.payloadDigest),
  );
}

/** Decode bytes to an `Entry`.
 *
 * https://willowprotocol.org/specs/encodings/index.html#enc_entry
 */
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

  const namespaceId = opts.namespaceScheme.decode(encEntry);

  const subspacePos = opts.namespaceScheme.encodedLength(namespaceId);
  const subspaceId = opts.subspaceScheme.decode(encEntry.subarray(subspacePos));

  const pathPos = subspacePos + opts.subspaceScheme.encodedLength(subspaceId);

  const path = decodePath(opts.pathScheme, encEntry.subarray(pathPos));

  const timestampPos = pathPos + encodedPathLength(opts.pathScheme, path);
  const timestamp = view.getBigUint64(timestampPos);

  const payloadLengthPos = timestampPos + 8;
  const payloadLength = view.getBigUint64(payloadLengthPos);

  const payloadDigestPos = payloadLengthPos + 8;
  const payloadDigest = opts.payloadScheme.decode(
    encEntry.subarray(payloadDigestPos),
  );

  return {
    namespaceId,
    subspaceId,
    path,
    timestamp,
    payloadLength,
    payloadDigest,
  };
}
