export function orderTimestamp(a: bigint, b: bigint): -1 | 0 | 1 {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

export function orderPath(a: Uint8Array[], b: Uint8Array[]): -1 | 0 | 1 {
  const shorter = a.length < b.length ? a : b;

  for (let i = 0; i < shorter.length; i++) {
    const aComponent = a[i];
    const bComponent = b[i];

    const order = orderPathComponent(aComponent, bComponent);

    if (order === 0) {
      continue;
    }

    return order;
  }

  if (a.length < b.length) {
    return -1;
  } else if (a.length > b.length) {
    return 1;
  }

  return 0;
}

export function orderPathComponent(a: Uint8Array, b: Uint8Array): -1 | 0 | 1 {
  const shorter = a.byteLength < b.byteLength ? a : b;

  for (let i = 0; i < shorter.byteLength; i++) {
    const aByte = a[i];
    const bByte = b[i];

    if (aByte === bByte) {
      continue;
    }

    if (aByte < bByte) {
      return -1;
    }

    if (aByte > bByte) {
      return 1;
    }
  }

  if (a.byteLength < b.byteLength) {
    return -1;
  } else if (a.byteLength > b.byteLength) {
    return 1;
  }

  return 0;
}
