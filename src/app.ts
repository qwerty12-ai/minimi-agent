import Fastify, { type FastifyInstance } from "fastify";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "test" ? "silent" : "info",
    },
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "minimi-agent",
  }));

  return app;
}