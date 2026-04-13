import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema({
  _id: String,
  name: String,
  description: String,
  module: String,
});

const moduleSchema = new mongoose.Schema({
  _id: String,
  name: String,
  description: String,
  lessons: [lessonSchema],
});

export default moduleSchema;
