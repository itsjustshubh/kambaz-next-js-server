import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import Hello from "./Hello.js";
import Lab5 from "./Lab5/index.js";
import db from "./kambaz/database/index.js";
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
  secret: process.env.SESSION_SECRET || "kambaz",
  resave: false,
  saveUninitialized: false,
};

if (process.env.SERVER_ENV !== "development") {
  sessionOptions.proxy = true;
  sessionOptions.cookie = {
    sameSite: "none",
    secure: true,
  };
  if (process.env.COOKIE_DOMAIN) {
    sessionOptions.cookie.domain = process.env.COOKIE_DOMAIN;
  }
}

app.use(session(sessionOptions));
app.use(express.json());

Hello(app);
UserRoutes(app, db);
CourseRoutes(app, db);
ModuleRoutes(app, db);
AssignmentRoutes(app, db);
EnrollmentRoutes(app, db);
Lab5(app);

export default app;
