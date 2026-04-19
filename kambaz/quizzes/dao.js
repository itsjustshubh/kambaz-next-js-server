import { v4 as uuidv4 } from "uuid";
import quizModel from "./model.js";
import attemptModel from "../quizAttempts/model.js";

export default function QuizzesDao() {
  const findQuizzesForCourse = (courseId) =>
    quizModel.find({ course: courseId }).lean();

  const findQuizById = (quizId) => quizModel.findById(quizId).lean();

  const createQuiz = async (quiz) => {
    const doc = await quizModel.create(quiz);
    return doc.toObject();
  };

  const updateQuiz = async (quizId, updates) => {
    const clean = { ...updates };
    delete clean._id;
    await quizModel.updateOne({ _id: quizId }, { $set: clean });
    return findQuizById(quizId);
  };

  const deleteQuiz = (quizId) => quizModel.deleteOne({ _id: quizId });

  const deleteQuizzesForCourse = async (courseId) => {
    const quizzes = await quizModel
      .find({ course: courseId })
      .select("_id")
      .lean();
    for (const q of quizzes) {
      await attemptModel.deleteMany({ quiz: q._id });
    }
    return quizModel.deleteMany({ course: courseId });
  };

  const deleteAttemptsForQuiz = (quizId) =>
    attemptModel.deleteMany({ quiz: quizId });

  const countUserAttempts = (quizId, userId) =>
    attemptModel.countDocuments({ quiz: quizId, user: userId });

  const createAttempt = async (attempt) => {
    const doc = await attemptModel.create({
      _id: uuidv4(),
      ...attempt,
    });
    return doc.toObject();
  };

  const findLastAttemptForUser = (quizId, userId) =>
    attemptModel
      .findOne({ quiz: quizId, user: userId })
      .sort({ submittedAt: -1 })
      .lean();

  return {
    findQuizzesForCourse,
    findQuizById,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    deleteQuizzesForCourse,
    deleteAttemptsForQuiz,
    countUserAttempts,
    createAttempt,
    findLastAttemptForUser,
  };
}
