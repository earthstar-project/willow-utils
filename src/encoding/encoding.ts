export function bigintToBytes(bigint: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);

  view.setBigUint64(0, bigint);

  return bytes;
}

/** Returns the maximum number of octets needed to store an unsigned integer. */
export function max32Width(num: number): 1 | 2 | 3 | 4 {
  if (num < 256) {
    return 1;
  } else if (num < 65536) {
    return 2;
  } else if (num < 16777216) {
    return 3;
  }

  return 4;
}

/** Encodes a number as a UintMax, with Max being the maximum number of octets needed to represent the unsigned integer */
export function encodeUintMax32(num: number, max: number): Uint8Array {
  const width = max32Width(max);

  const bytes = new Uint8Array(width);
  const view = new DataView(bytes.buffer);

  switch (width) {
    case 1:
      view.setUint8(0, num);
      break;
    case 2:
      view.setUint16(0, num);
      break;
    case 3: {
      view.setUint16(0, num >> 8);
      view.setUint8(2, num & 0xff);
      break;
    }
    case 4:
      view.setUint32(0, num);
      break;
  }

  return bytes;
}

/** Decodes an UintMax unsigned integer,  */
export function decodeUintMax32(bytes: Uint8Array) {
  if (bytes.byteLength > 4) {
    throw new Error("Cannot decode non-UintMax bytes");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset);

  if (bytes.byteLength === 1) {
    return view.getUint8(0);
  } else if (bytes.byteLength === 2) {
    return view.getUint16(0);
  } else if (bytes.byteLength === 4) {
    return view.getUint32(0);
  }

  // Otherwise it's 24 bit.
  const a = view.getUint16(0);
  const b = view.getUint8(2);

  return (a << 8) + b;
}

/** Returns the number of octets needed to store a number, along the lines of 8-bit, 16-bit, 32-bit, or 64-bit unsigned integers. */
export function compactWidth(num: number | bigint): 1 | 2 | 4 | 8 {
  if (num < 256) {
    return 1;
  } else if (num < 65536) {
    return 2;
  } else if (num < 4294967296) {
    return 4;
  }

  return 8;
}

export function encodeCompactWidth(num: number | bigint): Uint8Array {
  const width = compactWidth(num);

  const bytes = new Uint8Array(width);
  const view = new DataView(bytes.buffer);

  switch (width) {
    case 1:
      view.setUint8(0, Number(num));
      break;
    case 2:
      view.setUint16(0, Number(num));
      break;
    case 4:
      view.setUint32(0, Number(num));
      break;
    case 8:
      view.setBigUint64(0, BigInt(num));
  }

  return bytes;
}

export function decodeCompactWidth(encoded: Uint8Array): number | bigint {
  const view = new DataView(encoded.buffer, encoded.byteOffset);

  if (encoded.byteLength === 1) {
    return view.getUint8(0);
  } else if (encoded.byteLength === 2) {
    return view.getUint16(0);
  } else if (encoded.byteLength === 4) {
    return view.getUint32(0);
  }

  return view.getBigUint64(0);
}
