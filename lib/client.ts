export async function consume<T>(
  response: Response,
  onEvent: (event: T) => void,
) {
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Request failed");
  }
  if (!response.body) throw new Error("Response stream is unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let completed = false;
  function dispatch(frame: string) {
    const line = frame.split("\n").find((l) => l.startsWith("data: "));
    if (!line) return;
    const event = JSON.parse(line.slice(6));
    if (["done", "complete", "error"].includes(event.type)) completed = true;
    onEvent(event);
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const frames = pending.split("\n\n");
      pending = frames.pop() || "";
      for (const frame of frames) {
        dispatch(frame);
      }
      if (done) break;
    }
    if (pending.trim()) dispatch(pending);
    if (!completed)
      throw new Error("Connection ended before completion. Please retry.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export function isArabic(s: string) {
  return (
    (s.match(/[\u0600-\u06ff]/g)?.length || 0) >
    (s.match(/[a-z]/gi)?.length || 0) / 2
  );
}
export function displayName(name: string) {
  return name
    .replace(/^\d+[-_]/, "")
    .replace(/\.[^.]+$/, "")
    .replaceAll("-", " ");
}
