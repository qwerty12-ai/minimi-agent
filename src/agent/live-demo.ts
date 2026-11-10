import { createAgent } from "./create-agent.js";

async function main() {
    const agent = createAgent();

    const message = "Find the latest pricing of Neon.";

    console.log("\nSending message to Qwen...\n");
    console.log("User:", message);

    try {
        const plan = await agent.plan(message);
        console.log("\nGenerated Execution Plan:\n");
        console.log(JSON.stringify(plan, null, 2));
    } catch (error) {
        console.error("\nAgent execution failed:");
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}

main();