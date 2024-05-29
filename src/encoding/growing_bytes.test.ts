import { assertEquals } from "@std/assert";
import { FIFO } from "https://deno.land/x/fifo@v0.2.2/mod.ts";
import { GrowingBytes } from "./growing_bytes.ts";
import { delay } from "@std/async";

Deno.test("GrowingBytes (relative)", async () => {
  const fifo = new FIFO<Uint8Array>();

  const bytes = new GrowingBytes(fifo);

  assertEquals(bytes.array, new Uint8Array());

  fifo.push(new Uint8Array([0]));

  assertEquals(bytes.array, new Uint8Array());

  fifo.push(new Uint8Array([1]));
  fifo.push(new Uint8Array([2, 3]));

  assertEquals(bytes.array, new Uint8Array());

  const receivedBytes = await bytes.nextRelative(4);

  assertEquals(receivedBytes, new Uint8Array([0, 1, 2, 3]));

  const lastPromise = bytes.nextRelative(2);

  assertEquals(bytes.array, new Uint8Array([0, 1, 2, 3]));

  fifo.push(new Uint8Array([4, 5]));

  await delay(0);

  assertEquals(await lastPromise, new Uint8Array([0, 1, 2, 3, 4, 5]));
});

Deno.test("GrowingBytes (absolute)", async () => {
  const fifo = new FIFO<Uint8Array>();

  const bytes = new GrowingBytes(fifo);

  assertEquals(bytes.array, new Uint8Array());

  fifo.push(new Uint8Array([0]));

  await delay(0);

  assertEquals(bytes.array, new Uint8Array());

  fifo.push(new Uint8Array([1]));
  fifo.push(new Uint8Array([2, 3]));

  await delay(0);

  assertEquals(bytes.array, new Uint8Array());

  const receivedBytes = await bytes.nextAbsolute(4);

  assertEquals(receivedBytes, new Uint8Array([0, 1, 2, 3]));

  bytes.prune(4);

  fifo.push(new Uint8Array([4]));
  fifo.push(new Uint8Array([5, 6]));

  assertEquals(bytes.array, new Uint8Array());

  const lastPromise = bytes.nextAbsolute(4);

  await delay(0);

  assertEquals(bytes.array, new Uint8Array([4, 5, 6]));

  fifo.push(new Uint8Array([7]));

  await delay(0);

  assertEquals(await lastPromise, new Uint8Array([4, 5, 6, 7]));
});
