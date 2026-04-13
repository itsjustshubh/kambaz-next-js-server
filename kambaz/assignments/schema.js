import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    _id: String,
    title: String,
    course: String,
    description: String,
    points: Number,
    dueDate: String,
    availableFrom: String,
    availableUntil: String,
  },
  { collection: "assignments" }
);

export default assignmentSchema;
