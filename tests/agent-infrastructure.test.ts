import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  existsSync,
  mkdtempSync,
  rmSync,
} from "node:fs";

import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createAgentInfrastructure,
} from "../src/agent/create-agent-infrastructure.js";

import {
  openDatabase,
} from "../src/database/sqlite.js";

describe("Agent infrastructure", () => {
  let directory: string;

  afterEach(() => {
    if (directory) {
      rmSync(directory, {
        recursive: true,
        force: true,
      });
    }
  });

  function createTemporaryDirectory(): string {
    directory = mkdtempSync(
      join(tmpdir(), "minimi-agent-infrastructure-")
    );

    return directory;
  }

  it("initializes the database and memory store", () => {
    const databasePath = join(
      createTemporaryDirectory(),
      "data",
      "minimi-agent.db"
    );

    const infrastructure = createAgentInfrastructure({
      databasePath,
      searxngBaseUrl: "http://localhost:8080",
    });

    try {
      expect(existsSync(databasePath)).toBe(true);

      expect(infrastructure.database).toBeDefined();
      expect(infrastructure.memoryStore).toBeDefined();
      expect(infrastructure.memoryStore.conversations).toBeDefined();
      expect(infrastructure.memoryStore.memories).toBeDefined();
      expect(infrastructure.memoryStore.researchSnapshots).toBeDefined();
      expect(infrastructure.memoryStore.search).toBeDefined();
      expect(infrastructure.searchService).toBeDefined();

      const tables = infrastructure.database.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
      `).all() as Array<{ name: string }>;

      const tableNames = tables.map((table) => table.name);

      expect(tableNames).toContain("conversations");
      expect(tableNames).toContain("memory_records");
      expect(tableNames).toContain("research_snapshots");
    } finally {
      infrastructure.close();
    }
  });

  it("connects the search service to the SearXNG provider", async () => {
    const databasePath = join(
      createTemporaryDirectory(),
      "minimi-agent.db"
    );

    let capturedUrl = "";

    const searchFetch: typeof fetch = async (input) => {
      capturedUrl = String(input);

      return new Response(
        JSON.stringify({
          results: [
            {
              title: "TypeScript Documentation",
              url: "https://www.typescriptlang.org/",
              content: "Official TypeScript documentation.",
              engine: "test-engine",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    };

    const infrastructure = createAgentInfrastructure({
      databasePath,
      searxngBaseUrl: "http://localhost:8080",
      searchFetch,
    });

    try {
      const response = await infrastructure.searchService.search({
        query: "TypeScript",
      });

      expect(capturedUrl).toContain(
        "http://localhost:8080/search"
      );

      expect(response.provider).toBe("searxng");
      expect(response.query).toBe("TypeScript");
      expect(response.results).toHaveLength(1);
      expect(response.results[0]?.title).toBe(
        "TypeScript Documentation"
      );
    } finally {
      infrastructure.close();
    }
  });

  it("closes the database when infrastructure initialization fails", () => {
    const databasePath = join(
      createTemporaryDirectory(),
      "minimi-agent.db"
    );

    expect(() => {
      createAgentInfrastructure({
        databasePath,
        searxngBaseUrl: "invalid-url",
      });
    }).toThrow();

    expect(() => {
      const database = openDatabase(databasePath);
      database.close();
    }).not.toThrow();
  });

  it("allows infrastructure to be closed more than once", () => {
    const databasePath = join(
      createTemporaryDirectory(),
      "minimi-agent.db"
    );

    const infrastructure = createAgentInfrastructure({
      databasePath,
      searxngBaseUrl: "http://localhost:8080",
    });

    expect(() => {
      infrastructure.close();
      infrastructure.close();
    }).not.toThrow();
  });
});