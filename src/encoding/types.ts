import { GrowingBytes } from "./growing_bytes.ts";

export type StreamDecoder<ValueType> = (
  value: GrowingBytes,
) => Promise<ValueType>;

export type EncodingScheme<ValueType> = {
  encode: (value: ValueType) => Uint8Array;
  decode: (encoded: Uint8Array) => ValueType;
  encodedLength: (value: ValueType) => number;
  decodeStream: StreamDecoder<ValueType>;
};
