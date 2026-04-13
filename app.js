import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "cookie-session";
import Hello from "./Hello.js";
import Lab5 from "./Lab5/index.js";
import UserRoutes from "./kambaz/users/routes.js";
import CourseRoutes from "./kambaz/courses/routes.js";
import ModuleRoutes from "./kambaz/modules/routes.js";
import AssignmentRoutes from "./kambaz/assignments/routes.js";
import EnrollmentRoutes from "./kambaz/enrollments/routes.js";

const app = express();

if (process.env.SERVER_ENV !== "development") {
  app.set("trust proxy", 1);
}

const rawCors = process.env.CLIENT_URL || "http://localhost:3000";
const baseOrigins = rawCors.split(",").map((s) => s.trim());

const corsOriginFn = (origin, callback) => {
  if (!origin) return callback(null, true);
  const allowed = baseOrigins.some((base) => {
    if (origin === base) return true;
    try {
      const baseHost = new URL(base).hostname;
      const originHost = new URL(origin).hostname;
      return originHost === baseHost || originHost.endsWith("." + baseHost);
    } catch {
      return false;
    }
  });
  if (allowed) callback(null, true);
  else callback(new Error("Not allowed by CORS"));
};

app.use(
  cors({
    credentials: true,
    origin: corsOriginFn,
  })
);

const sessionOptions = {
  name: "session",
  keys: [process.env.SESSION_SECRET || "kambaz"],
};

if (process.env.SERVER_ENV !== "development") {
  sessionOptions.sameSite = "none";
  sessionOptions.secure = true;
  if (process.env.COOKIE_DOMAIN) {
    sessionOptions.domain = process.env.COOKIE_DOMAIN;
  }
}

app.use(session(sessionOptions));
app.use(express.json());

Hello(app);
UserRoutes(app);
CourseRoutes(app);
ModuleRoutes(app);
AssignmentRoutes(app);
EnrollmentRoutes(app);
Lab5(app);

export default app;
