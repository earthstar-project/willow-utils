import { concat } from "../../deps.ts";
import {
  bigintToBytes,
  compactWidth,
  decodeCompactWidth,
  encodeCompactWidth,
} from "../encoding/encoding.ts";
import { GrowingBytes } from "../encoding/growing_bytes.ts";
import { EncodingScheme } from "../encoding/types.ts";
import { TotalOrder } from "../order/types.ts";
import { PathScheme } from "../parameters/types.ts";
import {
  decodePath,
  decodeStreamPathRelative,
  encodedPathLength,
  encodePath,
  encodePathRelative,
} from "../paths/paths.ts";
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

const compactWidthEndMasks: Record<1 | 2 | 4 | 8, number> = {
  1: 0x0,
  2: 0x1,
  4: 0x2,
  8: 0x3,
};

function bigAbs(n: bigint) {
  return n < 0n ? -n : n;
}

export function encodeEntryRelativeEntry<
  NamespaceId,
  SubspaceId,
  PayloadDigest,
>(
  opts: {
    encodeNamespace: (namespace: NamespaceId) => Uint8Array;
    encodeSubspace: (subspace: SubspaceId) => Uint8Array;
    encodePayloadDigest: (digest: PayloadDigest) => Uint8Array;
    orderNamespace: TotalOrder<NamespaceId>;
    orderSubspace: TotalOrder<SubspaceId>;
    pathScheme: PathScheme;
  },
  entry: Entry<NamespaceId, SubspaceId, PayloadDigest>,
  ref: Entry<NamespaceId, SubspaceId, PayloadDigest>,
): Uint8Array {
  const timeDiff = bigAbs(entry.timestamp - ref.timestamp);

  const encodeNamespaceFlag =
    opts.orderNamespace(entry.namespaceId, ref.namespaceId) !== 0 ? 0x80 : 0x0;

  const encodeSubspaceFlag =
    opts.orderSubspace(entry.subspaceId, ref.subspaceId) !== 0 ? 0x40 : 0x0;

  const addOrSubtractTimeDiff = entry.timestamp - ref.timestamp > 0
    ? 0x20
    : 0x0;

  const compactWidthTimeDiffFlag =
    compactWidthEndMasks[compactWidth(timeDiff)] << 2;

  const compactWidthPayloadLengthFlag =
    compactWidthEndMasks[compactWidth(entry.payloadLength)];

  const encodedNamespace = encodeNamespaceFlag === 0x0
    ? new Uint8Array()
    : opts.encodeNamespace(entry.namespaceId);

  const encodedSubspace = encodeSubspaceFlag === 0x0
    ? new Uint8Array()
    : opts.encodeSubspace(entry.subspaceId);

  const encodedPath = encodePathRelative(opts.pathScheme, entry.path, ref.path);

  const encodedTimeDiff = encodeCompactWidth(timeDiff);

  const encodedPayloadLength = encodeCompactWidth(entry.payloadLength);

  const encodedDigest = opts.encodePayloadDigest(entry.payloadDigest);

  const header = encodeNamespaceFlag | encodeSubspaceFlag |
    addOrSubtractTimeDiff | compactWidthTimeDiffFlag |
    compactWidthPayloadLengthFlag;

  return concat(
    new Uint8Array([header]),
    encodedNamespace,
    encodedSubspace,
    encodedPath,
    encodedTimeDiff,
    encodedPayloadLength,
    encodedDigest,
  );
}

export async function decodeStreamEntryRelativeEntry<
  NamespaceId,
  SubspaceId,
  PayloadDigest,
>(
  opts: {
    decodeStreamNamespace: (bytes: GrowingBytes) => Promise<NamespaceId>;
    decodeStreamSubspace: (bytes: GrowingBytes) => Promise<SubspaceId>;
    decodeStreamPayloadDigest: (bytes: GrowingBytes) => Promise<PayloadDigest>;
    pathScheme: PathScheme;
  },
  bytes: GrowingBytes,
  ref: Entry<NamespaceId, SubspaceId, PayloadDigest>,
): Promise<Entry<NamespaceId, SubspaceId, PayloadDigest>> {
  await bytes.nextAbsolute(1);

  const [header] = bytes.array;

  const isNamespaceEncoded = (header & 0x80) === 0x80;
  const isSubspaceEncoded = (header & 0x40) === 0x40;
  const addTimeDiff = (header & 0x20) === 0x20;
  const compactWidthTimeDiff = 2 ** ((header & 0xc) >> 2);
  const compactWidthPayloadLength = 2 ** (header & 0x3);

  bytes.prune(1);

  const namespaceId = isNamespaceEncoded
    ? await opts.decodeStreamNamespace(bytes)
    : ref.namespaceId;

  const subspaceId = isSubspaceEncoded
    ? await opts.decodeStreamSubspace(bytes)
    : ref.subspaceId;

  const path = await decodeStreamPathRelative(opts.pathScheme, bytes, ref.path);

  await bytes.nextAbsolute(compactWidthTimeDiff);

  const timeDiff = BigInt(decodeCompactWidth(
    bytes.array.subarray(0, compactWidthTimeDiff),
  ));

  bytes.prune(compactWidthTimeDiff);

  await bytes.nextAbsolute(compactWidthPayloadLength);

  const payloadLength = BigInt(decodeCompactWidth(
    bytes.array.subarray(0, compactWidthPayloadLength),
  ));

  bytes.prune(compactWidthPayloadLength);

  const payloadDigest = await opts.decodeStreamPayloadDigest(bytes);

  return {
    namespaceId,
    subspaceId,
    path,
    payloadDigest,
    payloadLength,
    timestamp: addTimeDiff
      ? ref.timestamp + timeDiff
      : ref.timestamp - timeDiff,
  };
}
