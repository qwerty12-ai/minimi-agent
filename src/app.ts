import Fastify, { type FastifyInstance } from "fastify";
import { createAgent } from "./agent/create-agent.js";
import { parseAgentExecutionRequest } from "./agent/orchestration-schema.js";
import { parseVerificationRequest } from "./agent/verification-schema.js";

export function buildApp(): FastifyInstance {
  const app: FastifyInstance = Fastify({
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

  // List persisted conversations.
  app.get("/api/conversations", async (request, reply) => {
    const query = request.query as { limit?: string };

    let limit = 50;

    if (query.limit !== undefined) {
      const parsedLimit = Number(query.limit);

      if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 100
      ) {
        return reply.status(400).send({
          error: "Invalid request",
          message: "limit must be an integer between 1 and 100.",
        });
      }

      limit = parsedLimit;
    }

    try {
      const conversations = await getAgent().listConversations(limit);

      return reply.status(200).send({
        conversations,
      });
    } catch (error) {
      request.log.error(error);

      return reply.status(500).send({
        error: "Conversation retrieval failed",
        message: "MiniMi could not retrieve conversation history.",
      });
    }
  });

  // Retrieve one conversation and its messages.
  app.get("/api/conversations/:id", async (request, reply) => {
    const params = request.params as { id: string };

    if (!params.id || params.id.trim().length === 0) {
      return reply.status(400).send({
        error: "Invalid request",
        message: "A valid conversation ID is required.",
      });
    }

    try {
      const result = await getAgent().getConversation(params.id);

      if (!result) {
        return reply.status(404).send({
          error: "Conversation not found",
          message: "The requested conversation does not exist.",
        });
      }

      return reply.status(200).send(result);
    } catch (error) {
      request.log.error(error);

      return reply.status(500).send({
        error: "Conversation retrieval failed",
        message: "MiniMi could not retrieve the requested conversation.",
      });
    }
  });

  // M7.7.3: List historical research snapshots.
  app.get("/api/research-snapshots", async (request, reply) => {
    const query = request.query as { limit?: string };

    let limit = 50;

    if (query.limit !== undefined) {
      const parsedLimit = Number(query.limit);

      if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 100
      ) {
        return reply.status(400).send({
          error: "Invalid request",
          message: "limit must be an integer between 1 and 100.",
        });
      }

      limit = parsedLimit;
    }

    try {
      const snapshots = await getAgent().listResearchSnapshots(limit);

      return reply.status(200).send({
        snapshots,
      });
    } catch (error) {
      request.log.error(error);

      return reply.status(500).send({
        error: "Research snapshot retrieval failed",
        message: "MiniMi could not retrieve historical research snapshots.",
      });
    }
  });

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
        ...(validatedRequest.conversationId
          ? { conversationId: validatedRequest.conversationId }
          : {}),
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

  app.post("/api/agent/verify", async (request, reply) => {
    let validatedRequest;

    try {
      validatedRequest = parseVerificationRequest(request.body);
    } catch {
      return reply.status(400).send({
        error: "Invalid request",
        message:
          "A valid historicalSnapshotId and optional conversationId/question are required.",
      });
    }

    try {
      const result = await getAgent().verify({
        historicalSnapshotId: validatedRequest.historicalSnapshotId,
        ...(validatedRequest.conversationId
          ? { conversationId: validatedRequest.conversationId }
          : {}),
        ...(validatedRequest.question
          ? { question: validatedRequest.question }
          : {}),
      });

      return reply.status(200).send(result);
    } catch (error) {
      request.log.error(error);

      return reply.status(500).send({
        error: "Verification failed",
        message: "MiniMi could not verify the historical research.",
      });
    }
  });

  app.addHook("onClose", async () => {
    agent?.close();
  });

  return app;
}