const supportsGzip = () => typeof DecompressionStream !== "undefined";

export const parseJsonlFile = async (file, { onProgress, maxRows = 100000 } = {}) => {
  const isJson = file.name.endsWith(".json");
  if (isJson) {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const truncated = items.length > maxRows;
      const finalItems = truncated ? items.slice(0, maxRows) : items;
      if (onProgress) {
        onProgress(finalItems.length);
      }
      return { items: finalItems, truncated };
    } catch (err) {
      throw new Error("Invalid JSON file. Check format.");
    }
  }

  const isGzip = file.name.endsWith(".gz");

  if (isGzip && !supportsGzip()) {
    throw new Error("Gzip decompression is not supported in this browser.");
  }

  let stream = file.stream();
  if (isGzip) {
    stream = stream.pipeThrough(new DecompressionStream("gzip"));
  }

  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  const items = [];
  let done = false;

  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
    if (chunk.value) {
      buffer += chunk.value;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        try {
          items.push(JSON.parse(trimmed));
        } catch (err) {
          throw new Error("Invalid JSONL detected. Check line formatting.");
        }

        if (items.length >= maxRows) {
          return { items, truncated: true };
        }
      }

      if (onProgress) {
        onProgress(items.length);
      }
    }
  }

  const tail = buffer.trim();
  if (tail) {
    items.push(JSON.parse(tail));
  }

  return { items, truncated: false };
};
