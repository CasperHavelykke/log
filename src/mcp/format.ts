export function jsonContent(value: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(value, null, 2) },
    ],
  };
}

export function textContent(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

export function errorContent(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}
