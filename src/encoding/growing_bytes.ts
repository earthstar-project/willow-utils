import { concat } from "@std/bytes";

/** A bytestring which, upon request, pulls bytes from an asynchronous source of bytes. */
export class GrowingBytes {
  /** All received bytes. */
  array: Uint8Array = new Uint8Array();

  private hasUnfulfilledRequests = Promise.withResolvers<void>();

  private deferredUntilLength:
    | [number, PromiseWithResolvers<Uint8Array>]
    | null = null;

  /** Create a new {@linkcode GrowingBytes} from a stream of bytes. */
  constructor(readonly incoming: AsyncIterable<Uint8Array>) {
    (async () => {
      await this.hasUnfulfilledRequests.promise;

      for await (const chunk of incoming) {
        this.array = concat([this.array, chunk]);

        if (
          this.deferredUntilLength &&
          this.array.byteLength >= this.deferredUntilLength[0]
        ) {
          this.deferredUntilLength[1].resolve(this.array);
          this.deferredUntilLength = null;
          this.hasUnfulfilledRequests = Promise.withResolvers<void>();
        }

        await this.hasUnfulfilledRequests.promise;
      }
    })();
  }

  /** Attempt to pull bytes from the underlying source until the accumulated bytestring has grown by the given amount of bytes.
   *
   * @param length - The number of bytes to pull from the underlying source until returning.
   * @returns The accumulated bytestring after having pulled the given number of bytes.
   */
  nextRelative(length: number): Promise<Uint8Array> {
    const target = this.array.byteLength + length;
    return this.nextAbsolute(target);
  }

  /** Attempt to pull bytes from the underlying source until the accumulated bytestring has grown to the given size.
   *
   * @param length - The size the accumulated bytestring must have reached before returning.
   * @returns The accumulated bytestring after having reached the given bytelength.
   */
  nextAbsolute(length: number): Promise<Uint8Array> {
    if (this.array.byteLength >= length) {
      return Promise.resolve(this.array);
    }

    this.hasUnfulfilledRequests.resolve();

    if (this.deferredUntilLength && this.deferredUntilLength[0] === length) {
      return this.deferredUntilLength[1].promise;
    }

    this.deferredUntilLength = [
      length,
      Promise.withResolvers<Uint8Array>(),
    ];

    return this.deferredUntilLength[1].promise;
  }

  /** Prunes the array by the given bytelength. */
  prune(length: number) {
    this.array = this.array.slice(length);
  }
}
