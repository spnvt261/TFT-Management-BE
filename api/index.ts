import type { IncomingMessage, ServerResponse } from "node:http";

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const module = await import("../apps/api/src/vercel.js");
  await module.default(request, response);
}
