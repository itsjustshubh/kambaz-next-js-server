import "dotenv/config";
import mongoose from "mongoose";
import app from "../app.js";

const CONNECTION_STRING =
  process.env.DATABASE_CONNECTION_STRING || "mongodb://127.0.0.1:27017/kambaz";

if (mongoose.connection.readyState === 0) {
  mongoose.connect(CONNECTION_STRING).catch((err) => {
    console.error("MongoDB connection error:", err);
  });
}

export default app;
