/**
 * Loads users, courses (with modules embedded), enrollments, and assignments
 * from kambaz/database/*.json into MongoDB. Replaces existing documents in
 * those collections. Run after Mongo is up: npm run seed
 */
import "dotenv/config";
import mongoose from "mongoose";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dbDir = join(root, "kambaz", "database");

const CONNECTION_STRING =
  process.env.DATABASE_CONNECTION_STRING || "mongodb://127.0.0.1:27017/kambaz";

const users = JSON.parse(readFileSync(join(dbDir, "users.json"), "utf8"));
const courses = JSON.parse(readFileSync(join(dbDir, "courses.json"), "utf8"));
const modules = JSON.parse(readFileSync(join(dbDir, "modules.json"), "utf8"));
const enrollments = JSON.parse(
  readFileSync(join(dbDir, "enrollments.json"), "utf8")
);
const assignments = JSON.parse(
  readFileSync(join(dbDir, "assignments.json"), "utf8")
);

try {
  await mongoose.connect(CONNECTION_STRING);
} catch (err) {
  console.error("Could not connect to MongoDB:", err.message);
  console.error("Start MongoDB or set DATABASE_CONNECTION_STRING (e.g. Atlas).");
  process.exit(1);
}

const { default: userModel } = await import("../kambaz/users/model.js");
const { default: courseModel } = await import("../kambaz/courses/model.js");
const { default: enrollmentModel } = await import(
  "../kambaz/enrollments/model.js"
);
const { default: assignmentModel } = await import(
  "../kambaz/assignments/model.js"
);

const coursesWithModules = courses.map((c) => ({
  ...c,
  modules: modules
    .filter((m) => m.course === c._id)
    .map(({ course: _drop, ...m }) => ({
      ...m,
      lessons: m.lessons ?? [],
    })),
}));

await enrollmentModel.deleteMany({});
await assignmentModel.deleteMany({});
await courseModel.deleteMany({});
await userModel.deleteMany({});

await userModel.insertMany(users);
await courseModel.insertMany(coursesWithModules);
await enrollmentModel.insertMany(enrollments);
await assignmentModel.insertMany(assignments);

console.log(
  `Seeded ${users.length} users, ${coursesWithModules.length} courses, ${enrollments.length} enrollments, ${assignments.length} assignments.`
);
await mongoose.disconnect();
process.exit(0);
