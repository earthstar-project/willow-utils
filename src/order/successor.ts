import { isValidPath } from "../paths/paths.ts";
import { Path } from "../paths/types.ts";

export function successorPath(
  path: Path,
  maxComponentCount: number,
  maxComponentLength: number,
  maxPathLength: number,
): Uint8Array[] | null {
  const workingPath = [...path];

  if (path.length === 0) {
    const nextPath = [new Uint8Array(1)];

    const isSimplestOptionValid = isValidPath(
      nextPath,
      maxComponentCount,
      maxComponentLength,
      maxPathLength,
    );

    if (isSimplestOptionValid) {
      return nextPath;
    }

    return null;
  }

  for (let i = path.length - 1; i >= 0; i--) {
    // Does the simplest thing work?

    const component = workingPath[i];

    const simplestNextComponent = new Uint8Array([...component, 0]);

    const simplestNextPath = [...path];
    simplestNextPath[i] = simplestNextComponent;

    const isSimplestOptionValid = isValidPath(
      simplestNextPath,
      maxComponentCount,
      maxComponentLength,
      maxPathLength,
    );

    if (isSimplestOptionValid) {
      return simplestNextPath;
    }

    // Otherwise...

    const incrementedComponent = incrementFixed(component);

    if (incrementedComponent) {
      const nextPath = [...path.slice(0, i)];
      nextPath[i] = incrementedComponent;

      return nextPath;
    }

    // Otherwise (there was an overflow)...

    if (path.length === 0) {
      return null;
    }

    workingPath.pop();
  }

  if (workingPath.length === 0) {
    return null;
  }

  return workingPath;
}

function incrementFixed(bytes: Uint8Array): Uint8Array | null {
  const newBytes = new Uint8Array(bytes);

  let didIncrement = false;

  for (let i = newBytes.byteLength - 1; i >= 0; i--) {
    const byte = bytes[i];

    if (byte >= 255) {
      newBytes.set([0], i);
      continue;
    }

    if (!didIncrement) {
      newBytes.set([byte + 1], i);
      didIncrement = true;
    }
  }

  if (!didIncrement) {
    return null;
  }

  return newBytes;
}
