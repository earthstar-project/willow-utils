import { EncodingScheme } from "../encoding/types.ts";
import { TotalOrder } from "../order/types.ts";

/** A scheme for encoding public keys and the signatures they produce. */
export type KeypairEncodingScheme<PublicKey, Signature> = {
  /** The encoding scheme for a key pair's public key type. */
  publicKey: EncodingScheme<PublicKey>;
  /** The encoding scheme for a key pair's signature type. */
  signature: EncodingScheme<Signature>;
};

/** A scheme for signing and verifying data using key pairs. */
export type SignatureScheme<PublicKey, SecretKey, Signature> = {
  sign: (secretKey: SecretKey, bytestring: Uint8Array) => Promise<Signature>;
  verify: (
    publicKey: PublicKey,
    signature: Signature,
    bytestring: Uint8Array,
  ) => Promise<boolean>;
};

/** A scheme for signing with a keypair, and encoding the associated public keys and signatures. */
export type KeypairScheme<PublicKey, SecretKey, Signature> = {
  signatureScheme: SignatureScheme<PublicKey, SecretKey, Signature>;
  encodingScheme: KeypairEncodingScheme<PublicKey, Signature>;
};

/** A set of limits for `Path`s. */
export type PathScheme = {
  /** The maximum number of path components in a `Path`. */
  maxComponentCount: number;
  /** The maximum length of any given component in a `Path`. */
  maxComponentLength: number;
  /** The maximum total length of bytes in a `Path`. */
  maxPathLength: number;
};

/** A scheme for ordering, signing with and encoding Subspaces.  */
export type SubspaceScheme<SubspaceId> = {
  /** A total order over all values in the set `SubspaceId`. */
  order: TotalOrder<SubspaceId>;
};
