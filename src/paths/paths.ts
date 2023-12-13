import { orderPathComponent } from "../order/order.ts";
import { Path } from "./types.ts";

export function isValidPath(
  path: Path,
  maxComponentCount: number,
  maxComponentLength: number,
  maxPathLength: number,
): boolean {
  if (path.length > maxComponentCount) {
    return false;
  }

  let totalLength = 0;

  for (const component of path) {
    if (component.byteLength > maxComponentLength) {
      return false;
    }

    totalLength += component.byteLength;

    if (totalLength > maxPathLength) {
      return false;
    }
  }
  return true;
}

export function isPathPrefixed(prefix: Path, path: Path): boolean {
  if (prefix.length > path.length) {
    return false;
  }

  for (let i = 0; i < prefix.length; i++) {
    const prefixComponent = prefix[i];
    const testComponent = path[i];

    const order = orderPathComponent(prefixComponent, testComponent);

    if (order !== 0) {
      return false;
    }
  }

  return true;
}
