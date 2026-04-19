import "dotenv/config";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "./app.js";

const port = process.env.PORT || 4000;
const defaultLocalUri = "mongodb://127.0.0.1:27017/kambaz";

async function start() {
  let mongoMemory = null;
  let connectionString =
    process.env.DATABASE_CONNECTION_STRING || defaultLocalUri;

  if (process.env.USE_MEMORY_MONGO === "true") {
    mongoMemory = await MongoMemoryServer.create();
    connectionString = mongoMemory.getUri();
    console.log(
      "USE_MEMORY_MONGO=true — using ephemeral in-memory MongoDB (data resets when the server stops)."
    );
  }

  try {
    await mongoose.connect(connectionString, { dbName: "kambaz" });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    if (mongoMemory) {
      await mongoMemory.stop();
    }
    if (
      connectionString.includes("127.0.0.1") ||
      connectionString.includes("localhost")
    ) {
      console.error(
        "\nTip: Install/start MongoDB on port 27017, set DATABASE_CONNECTION_STRING to Atlas,\n" +
          "or add USE_MEMORY_MONGO=true to your .env for in-memory Mongo (see env.example).\n"
      );
    }
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });

  const shutdown = async () => {
    await mongoose.disconnect();
    if (mongoMemory) {
      await mongoMemory.stop();
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void start();
