import { PathScheme } from "../parameters/types.ts";
import { isValidPath } from "../paths/paths.ts";
import { Path } from "../paths/types.ts";

/** Returns the successor to a path given a `Path` and `PathScheme`.  */
export function successorPath(
  path: Path,
  { maxComponentCount, maxComponentLength, maxPathLength }: PathScheme,
): Path | null {
  if (path.length === 0) {
    const nextPath = [new Uint8Array(1)];

    const isSimplestOptionValid = isValidPath(
      nextPath,
      { maxComponentCount, maxComponentLength, maxPathLength },
    );

    if (isSimplestOptionValid) {
      return nextPath;
    }

    return null;
  }

  const workingPath = [...path];

  for (let i = path.length - 1; i >= 0; i--) {
    // Does the simplest thing work?

    const component = workingPath[i];

    const simplestNextComponent = new Uint8Array([...component, 0]);

    const simplestNextPath = [...path];
    simplestNextPath[i] = simplestNextComponent;

    const isSimplestOptionValid = isValidPath(
      simplestNextPath,
      { maxComponentCount, maxComponentLength, maxPathLength },
    );

    if (isSimplestOptionValid) {
      return simplestNextPath;
    }

    // Otherwise...

    const incrementedComponent = successorBytesFixedWidth(component);

    if (incrementedComponent) {
      const nextPath = [...path.slice(0, i)];
      nextPath[i] = incrementedComponent;

      return nextPath;
    }

    // Otherwise (there was an overflow)...

    workingPath.pop();
  }

  if (workingPath.length === 0) {
    return null;
  }

  return workingPath;
}

/** Return a successor to a prefix, that is, the next element that is not a prefix of the given path. */
export function successorPrefix(
  path: Path,
): Path | null {
  if (path.length === 0) {
    return null;
  }

  const workingPath = [...path];

  for (let i = path.length - 1; i >= 0; i--) {
    // Does the simplest thing work?

    const component = workingPath[i];

    const incrementedComponent = successorBytesFixedWidth(component);

    if (incrementedComponent) {
      const nextPath = [...path.slice(0, i)];
      nextPath[i] = incrementedComponent;

      return nextPath;
    }

    // Otherwise (there was an overflow)...

    if (component.byteLength === 0) {
      const nextPath = [...path.slice(0, i)];
      nextPath[i] = new Uint8Array([0]);

      return nextPath;
    }

    workingPath.pop();
  }

  if (workingPath.length === 0) {
    return null;
  }

  return workingPath;
}

/** Return the succeeding bytestring of the given bytestring without increasing that bytestring's length.  */
export function successorBytesFixedWidth(bytes: Uint8Array): Uint8Array | null {
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
