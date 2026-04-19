import mongoose from "mongoose";

const choiceSchema = new mongoose.Schema(
  {
    text: { type: String, default: "" },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    type: {
      type: String,
      enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_BLANK"],
      default: "MULTIPLE_CHOICE",
    },
    title: { type: String, default: "" },
    points: { type: Number, default: 1 },
    questionHtml: { type: String, default: "" },
    choices: [choiceSchema],
    correctTrueFalse: { type: Boolean, default: true },
    correctBlanks: [{ type: String }],
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    course: { type: String, required: true, ref: "CourseModel" },
    title: { type: String, default: "Unnamed Quiz" },
    description: { type: String, default: "" },
    quizType: {
      type: String,
      enum: ["GRADED_QUIZ", "PRACTICE_QUIZ", "GRADED_SURVEY", "UNGRADED_SURVEY"],
      default: "GRADED_QUIZ",
    },
    assignmentGroup: {
      type: String,
      enum: ["Quizzes", "Exams", "Assignments", "Project"],
      default: "Quizzes",
    },
    shuffleAnswers: { type: Boolean, default: true },
    timeLimitMinutes: { type: Number, default: 20 },
    multipleAttempts: { type: Boolean, default: false },
    howManyAttempts: { type: Number, default: 1 },
    showCorrectAnswers: {
      type: String,
      enum: ["Never", "Immediately", "AfterLastAttempt"],
      default: "Immediately",
    },
    accessCode: { type: String, default: "" },
    oneQuestionAtATime: { type: Boolean, default: true },
    webcamRequired: { type: Boolean, default: false },
    lockQuestionsAfterAnswering: { type: Boolean, default: false },
    dueDate: { type: String, default: "" },
    availableDate: { type: String, default: "" },
    untilDate: { type: String, default: "" },
    published: { type: Boolean, default: false },
    questions: [questionSchema],
  },
  { collection: "quizzes" }
);

export default quizSchema;
