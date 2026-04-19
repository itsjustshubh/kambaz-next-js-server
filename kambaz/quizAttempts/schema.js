import mongoose from "mongoose";

const perQuestionSchema = new mongoose.Schema(
  {
    questionId: String,
    correct: Boolean,
    pointsEarned: Number,
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    quiz: { type: String, required: true },
    user: { type: String, required: true },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    perQuestion: [perQuestionSchema],
    submittedAt: { type: Date, default: Date.now },
  },
  { collection: "quizAttempts" }
);

export default quizAttemptSchema;
