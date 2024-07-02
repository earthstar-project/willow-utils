import type { PathScheme } from "../parameters/types.ts";
import { isValidPath } from "../paths/paths.ts";
import type { Path } from "../paths/types.ts";

/** Return the least path which is greater than `path`, or return `null` if `path` is the greatest possible path.  */
export function successorPath(
  path: Path,
  { maxComponentCount, maxComponentLength, maxPathLength }: PathScheme,
): Path | null {
  if (path.length === 0) {
    const nextPath = [new Uint8Array()];

    const isSimplestOptionValid = isValidPath(
      nextPath,
      { maxComponentCount, maxComponentLength, maxPathLength },
    );

    if (isSimplestOptionValid) {
      return nextPath;
    }

    return null;
  }

  // Try add an empty component
  const nextPath = [...path, new Uint8Array()];

  const isSimplestOptionValid = isValidPath(
    nextPath,
    { maxComponentCount, maxComponentLength, maxPathLength },
  );

  if (isSimplestOptionValid) {
    return nextPath;
  }

  for (let i = path.length - 1; i >= 0; i--) {
    // Does the simplest thing work?

    const component = path[i];

    const simplestNextComponent = new Uint8Array([...component, 0]);

    const simplestNextPath = [...path.slice(0, i), simplestNextComponent];

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
      const nextPath = [...path.slice(0, i), incrementedComponent];

      return nextPath;
    }
  }

  return null;
}

/** Return the least path that is greater than `path` and which is not prefixed by `path`, or `null` if `path` is the empty path *or* if `path` is the greatest path. */
export function successorPrefix(
  path: Path,
  { maxComponentCount, maxComponentLength, maxPathLength }: PathScheme,
): Path | null {
  for (let i = path.length - 1; i >= 0; i--) {
    const component = path[i];

    const simplestNextComponent = new Uint8Array([...component, 0]);

    const simplestNextPath = [...path.slice(0, i), simplestNextComponent];

    const isSimplestOptionValid = isValidPath(
      simplestNextPath,
      { maxComponentCount, maxComponentLength, maxPathLength },
    );

    if (isSimplestOptionValid) {
      return simplestNextPath;
    }

    // prefix_successor

    for (let ci = component.length - 1; ci >= 0; ci--) {
      const byte = component[ci];

      if (byte !== 255) {
        const newComponent = new Uint8Array([
          ...component.slice(0, ci),
          byte + 1,
        ]);

        const newPath = [...path.slice(0, i), newComponent];

        if (
          isValidPath(newPath, {
            maxComponentCount,
            maxComponentLength,
            maxPathLength,
          })
        ) {
          return newPath;
        }
      }
    }
  }

  return null;
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
      break;
    }
  }

  if (!didIncrement) {
    return null;
  }

  return newBytes;
}
