import Fastify, { type FastifyInstance } from "fastify";
import { createAgent } from "./agent/create-agent.js";
import { parseAgentExecutionRequest } from "./agent/orchestration-schema.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "test" ? "silent" : "info",
    },
  });

  let agent: ReturnType<typeof createAgent> | undefined;

  function getAgent() {
    agent ??= createAgent();
    return agent;
  }

  app.get("/health", async () => ({
    status: "ok",
    service: "minimi-agent",
  }));

  app.post("/api/agent/execute", async (request, reply) => {
    let validatedRequest;

    try {
      validatedRequest = parseAgentExecutionRequest(request.body);
    } catch {
      return reply.status(400).send({
        error: "Invalid request",
        message: "A valid message and optional conversationId are required.",
      });
    }

    try {
      const result = await getAgent().execute({
        message: validatedRequest.message,
        ...(validatedRequest.conversationId)
        ? {conversationId: validatedRequest.conversationId} : {},
      });

      return reply.status(200).send(result);
    } catch (error) {
      request.log.error(error);

      return reply.status(500).send({
        error: "Agent execution failed",
        message: "MiniMi could not complete the request.",
      });
    }
  });

  app.addHook("onClose", async () => {
    agent?.close();
  });

  return app;
}