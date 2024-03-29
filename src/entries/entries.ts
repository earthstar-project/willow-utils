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
  commonPrefix,
  decodePath,
  decodeStreamPathRelative,
  encodedPathLength,
  encodePath,
  encodePathRelative,
} from "../paths/paths.ts";
import { Path } from "../paths/types.ts";
import { OPEN_END, Position3d, Range3d } from "../ranges/types.ts";
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

/** `Math.min`, but for `BigInt`. */
function bigIntMin(a: bigint, b: bigint) {
  if (a < b) {
    return a;
  }

  return b;
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

export function encodeEntryRelativeRange3d<
  NamespaceId,
  SubspaceId,
  PayloadDigest,
>(
  opts: {
    encodeNamespace: (namespace: NamespaceId) => Uint8Array;
    encodeSubspace: (subspace: SubspaceId) => Uint8Array;
    encodePayloadDigest: (digest: PayloadDigest) => Uint8Array;
    orderSubspace: TotalOrder<SubspaceId>;
    pathScheme: PathScheme;
  },
  entry: Entry<NamespaceId, SubspaceId, PayloadDigest>,
  outer: Range3d<SubspaceId>,
): Uint8Array {
  const timeDiff = bigAbs(
    outer.timeRange.end !== OPEN_END
      ? bigIntMin(
        entry.timestamp - outer.timeRange.start,
        entry.timestamp - outer.timeRange.end,
      )
      : entry.timestamp - outer.timeRange.start,
  );

  let encodeSubspaceIdFlag: number;
  let encodedSubspace: Uint8Array;

  if (opts.orderSubspace(entry.subspaceId, outer.subspaceRange.start) !== 0) {
    encodeSubspaceIdFlag = 0x80;
    encodedSubspace = opts.encodeSubspace(entry.subspaceId);
  } else {
    encodeSubspaceIdFlag = 0x0;
    encodedSubspace = new Uint8Array();
  }

  let encodePathRelativeToStartFlag: number;

  let encodedPath: Uint8Array;

  if (outer.pathRange.end !== OPEN_END) {
    const commonPrefixStart = commonPrefix(entry.path, outer.pathRange.start);
    const commonPrefixEnd = commonPrefix(entry.path, outer.pathRange.end);

    if (commonPrefixStart.length >= commonPrefixEnd.length) {
      encodePathRelativeToStartFlag = 0x40;
      encodedPath = encodePathRelative(
        opts.pathScheme,
        entry.path,
        outer.pathRange.start,
      );
    } else {
      encodePathRelativeToStartFlag = 0x0;
      encodedPath = encodePathRelative(
        opts.pathScheme,
        entry.path,
        outer.pathRange.end,
      );
    }
  } else {
    encodePathRelativeToStartFlag = 0x40;
    encodedPath = encodePathRelative(
      opts.pathScheme,
      entry.path,
      outer.pathRange.start,
    );
  }

  const applyTimeDiffWithStartOrEnd =
    timeDiff === bigAbs(entry.timestamp - outer.timeRange.start) ? 0x20 : 0x0;

  let addOrSubtractTimeDiff: number;

  if (outer.timeRange.end !== OPEN_END) {
    addOrSubtractTimeDiff = (applyTimeDiffWithStartOrEnd === 0x20 &&
        entry.timestamp >= outer.timeRange.start) ||
        (applyTimeDiffWithStartOrEnd === 0x0 &&
          entry.timestamp <= outer.timeRange.end)
      ? 0x10
      : 0x0;
  } else {
    addOrSubtractTimeDiff = applyTimeDiffWithStartOrEnd === 0x20 &&
        entry.timestamp >= outer.timeRange.start
      ? 0x10
      : 0x0;
  }

  const timeDiffCompactWidthFlag =
    compactWidthEndMasks[compactWidth(timeDiff)] << 2;
  const payloadLengthFlag =
    compactWidthEndMasks[compactWidth(entry.payloadLength)];

  const header = encodeSubspaceIdFlag | encodePathRelativeToStartFlag |
    applyTimeDiffWithStartOrEnd | addOrSubtractTimeDiff |
    timeDiffCompactWidthFlag | payloadLengthFlag;

  const encodedTimeDiff = encodeCompactWidth(timeDiff);

  const encodedPayloadLength = encodeCompactWidth(entry.payloadLength);

  const encodedPayloadDigest = opts.encodePayloadDigest(entry.payloadDigest);

  return concat(
    new Uint8Array([header]),
    encodedSubspace,
    encodedPath,
    encodedTimeDiff,
    encodedPayloadLength,
    encodedPayloadDigest,
  );
}

export async function decodeStreamEntryRelativeRange3d<
  NamespaceId,
  SubspaceId,
  PayloadDigest,
>(
  opts: {
    decodeStreamSubspace: (bytes: GrowingBytes) => Promise<SubspaceId>;
    decodeStreamPayloadDigest: (bytes: GrowingBytes) => Promise<PayloadDigest>;
    pathScheme: PathScheme;
  },
  bytes: GrowingBytes,
  outer: Range3d<SubspaceId>,
  namespaceId: NamespaceId,
): Promise<
  Entry<
    NamespaceId,
    SubspaceId,
    PayloadDigest
  >
> {
  await bytes.nextAbsolute(1);

  const [header] = bytes.array;

  const isSubspaceEncoded = (header & 0x80) === 0x80;
  const isPathEncodedRelativeToStart = (header & 0x40) === 0x40;
  const isTimeDiffCombinedWithStart = (header & 0x20) === 0x20;
  const addOrSubtractTimedDiff = (header & 0x10) === 0x10;
  const timeDiffCompactWidth = 2 ** ((header & 0xc) >> 2);
  const payloadLengthCompactWidth = 2 ** (header & 0x3);

  let subspaceId: SubspaceId;

  bytes.prune(1);

  if (isSubspaceEncoded) {
    subspaceId = await opts.decodeStreamSubspace(bytes);
  } else {
    subspaceId = outer.subspaceRange.start;
  }

  let path: Path;

  if (!isPathEncodedRelativeToStart) {
    if (outer.pathRange.end === OPEN_END) {
      throw new Error(
        "The path cannot be encoded relative to an open end.",
      );
    }

    path = await decodeStreamPathRelative(
      opts.pathScheme,
      bytes,
      outer.pathRange.end,
    );
  } else {
    path = await decodeStreamPathRelative(
      opts.pathScheme,
      bytes,
      outer.pathRange.start,
    );
  }

  await bytes.nextAbsolute(timeDiffCompactWidth);

  const timeDiff = BigInt(decodeCompactWidth(
    bytes.array.subarray(0, timeDiffCompactWidth),
  ));

  bytes.prune(timeDiffCompactWidth);

  let timestamp: bigint;

  console.log({
    isTimeDiffCombinedWithStart,
    addOrSubtractTimedDiff,
    timeDiff,
  });

  if (isTimeDiffCombinedWithStart && addOrSubtractTimedDiff) {
    timestamp = outer.timeRange.start + timeDiff;
  } else if (isTimeDiffCombinedWithStart && !addOrSubtractTimedDiff) {
    timestamp = outer.timeRange.start - timeDiff;
  } else if (!isTimeDiffCombinedWithStart && addOrSubtractTimedDiff) {
    if (outer.timeRange.end === OPEN_END) {
      throw new Error("Can't apply time diff to an open end");
    }

    timestamp = outer.timeRange.end - timeDiff;
  } else {
    if (outer.timeRange.end === OPEN_END) {
      throw new Error("Can't apply time diff to an open end");
    }

    timestamp = outer.timeRange.end + timeDiff;
  }

  await bytes.nextAbsolute(payloadLengthCompactWidth);

  const payloadLength = BigInt(decodeCompactWidth(
    bytes.array.subarray(0, payloadLengthCompactWidth),
  ));

  bytes.prune(payloadLengthCompactWidth);

  const payloadDigest = await opts.decodeStreamPayloadDigest(bytes);

  return {
    namespaceId,
    subspaceId,
    path,
    payloadDigest,
    payloadLength,
    timestamp,
  };
}
