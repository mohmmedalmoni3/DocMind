export function sameOrigin(request: Request) {
  // Next 14 may normalize request.url to localhost even when the browser used 127.0.0.1.
  const target = new URL(request.url);
  const host = request.headers.get("host") || target.host;
  const incoming = new URL(`${target.protocol}//${host}`);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(incoming.hostname))
    throw new Error("DocMind accepts local requests only.");
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== incoming.origin)
    throw new Error("Cross-origin requests are not allowed.");
}
export function errorResponse(e: unknown, status = 400) {
  return Response.json(
    { error: e instanceof Error ? e.message : "Something went wrong." },
    { status },
  );
}
export function sse<T>(
  request: Request,
  work: (emit: (event: T) => void, signal: AbortSignal) => Promise<unknown>,
) {
  const controller = new AbortController();
  const signal = AbortSignal.any([request.signal, controller.signal]);
  let closed = false;
  return new Response(
    new ReadableStream({
      async start(stream) {
        const encoder = new TextEncoder();
        const emit = (event: unknown) => {
          if (!closed && !signal.aborted)
            stream.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
            );
        };
        const heartbeat = setInterval(() => {
          if (!closed && !signal.aborted)
            stream.enqueue(encoder.encode(": keepalive\n\n"));
        }, 15000);
        try {
          await work(emit, signal);
        } catch (e) {
          emit({
            type: "error",
            message: e instanceof Error ? e.message : "Unexpected error",
          });
        } finally {
          clearInterval(heartbeat);
          if (!closed) {
            closed = true;
            stream.close();
          }
        }
      },
      cancel() {
        closed = true;
        controller.abort();
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    },
  );
}
