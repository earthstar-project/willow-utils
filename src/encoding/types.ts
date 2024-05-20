import type { GrowingBytes } from "./growing_bytes.ts";

/** A decoder for decoding values of `ValueType` from a {@linkcode GrowingBytes} */
export type StreamDecoder<ValueType> = (
  value: GrowingBytes,
) => Promise<ValueType>;

/** A scheme for encoding and decoding values of `ValueType`. */
export type EncodingScheme<ValueType> = {
  encode: (value: ValueType) => Uint8Array;
  decode: (encoded: Uint8Array) => ValueType;
  encodedLength: (value: ValueType) => number;
  decodeStream: StreamDecoder<ValueType>;
};

export type PrivyEncodingScheme<ValueType, PrivyType> = {
  // e.g. Value type here is a SetupBindReadCapability
  // the privy type is what both sides know - in this case,
  // the outer area and the namespace.
  encode: (value: ValueType, privy: PrivyType) => Uint8Array;
  encodedLength: (value: ValueType, privy: PrivyType) => number;

  // Although it would seem natural to put the privy type in the params,
  // Before calling this function we cannot know what this message is privy to.
  // e.g. if this is an encoded SetupBindReadCapability
  // then we can only know what we are privy to once we have the intersection handle
  // encoded in the message.
  // we then need to dereference that handle to get the privy info
  // e.g. the outer area of the intersection handle.
  // sometimes we have to dereference something in the message,
  // sometimes we don't (e.g. in reconciliation messages.)

  decode: (encoded: Uint8Array, privy: PrivyType) => ValueType;

  decodeStream: (bytes: GrowingBytes, privy: PrivyType) => Promise<ValueType>;
};
