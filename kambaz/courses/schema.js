import mongoose from "mongoose";
import moduleSchema from "../modules/schema.js";

const courseSchema = new mongoose.Schema(
  {
    _id: String,
    name: String,
    number: String,
    credits: Number,
    description: String,
    startDate: String,
    endDate: String,
    department: String,
    image: String,
    facultyId: String,
    modules: [moduleSchema],
  },
  { collection: "courses" }
);

export default courseSchema;
