import { v4 as uuidv4 } from "uuid";
import QuizzesDao from "./dao.js";
import EnrollmentsDao from "../enrollments/dao.js";
import AssignmentsDao from "../assignments/dao.js";
import CoursesDao from "../courses/dao.js";
import { requireCurrentUser, requireFaculty, isFacultyRole } from "../authz.js";

export default function QuizRoutes(app) {
  const dao = QuizzesDao();
  const enrollmentsDao = EnrollmentsDao();
  const coursesDao = CoursesDao(enrollmentsDao, AssignmentsDao());

  async function assertCourseAccess(req, res, courseId) {
    const user = requireCurrentUser(req, res);
    if (!user) return null;
    const course = await coursesDao.findCourseById(courseId);
    if (!course) {
      res.sendStatus(404);
      return null;
    }
    const owner = course.facultyId === user._id;
    const enrolled = await enrollmentsDao.isUserEnrolledInCourse(
      user._id,
      courseId
    );
    if (!owner && !enrolled) {
      res.sendStatus(403);
      return null;
    }
    return { user, course };
  }

  async function assertFacultyCanEditCourseQuiz(req, res, courseId) {
    const user = requireFaculty(req, res);
    if (!user) return null;
    const course = await coursesDao.findCourseById(courseId);
    if (!course) {
      res.sendStatus(404);
      return null;
    }
    if (user.role === "ADMIN") return { user, course };
    if (course.facultyId && course.facultyId !== user._id) {
      res.sendStatus(403);
      return null;
    }
    if (!course.facultyId) {
      const enrolled = await enrollmentsDao.isUserEnrolledInCourse(
        user._id,
        courseId
      );
      if (!enrolled) {
        res.sendStatus(403);
        return null;
      }
    }
    return { user, course };
  }

  function scoreAnswer(question, rawAnswer) {
    const pts = Number(question.points) || 0;
    if (question.type === "MULTIPLE_CHOICE") {
      const idx = Number(rawAnswer);
      const choice = question.choices?.[idx];
      return choice?.isCorrect ? pts : 0;
    }
    if (question.type === "TRUE_FALSE") {
      const v =
        rawAnswer === true ||
        rawAnswer === "true" ||
        rawAnswer === "True";
      return !!v === !!question.correctTrueFalse ? pts : 0;
    }
    if (question.type === "FILL_BLANK") {
      const a = String(rawAnswer ?? "").trim().toLowerCase();
      const blanks = question.correctBlanks || [];
      const ok = blanks.some((b) => String(b).trim().toLowerCase() === a);
      return ok ? pts : 0;
    }
    return 0;
  }

  const findQuizzesForCourse = async (req, res) => {
    const { courseId } = req.params;
    const access = await assertCourseAccess(req, res, courseId);
    if (!access) return;
    let list = await dao.findQuizzesForCourse(courseId);
    if (!isFacultyRole(access.user.role)) {
      list = list.filter((q) => q.published);
    }
    list = [...list].sort((a, b) => {
      const ad = String(a.availableDate ?? "").trim();
      const bd = String(b.availableDate ?? "").trim();
      if (!ad && !bd) return String(a.title ?? "").localeCompare(String(b.title ?? ""));
      if (!ad) return 1;
      if (!bd) return -1;
      const c = ad.localeCompare(bd);
      if (c !== 0) return c;
      return String(a.title ?? "").localeCompare(String(b.title ?? ""));
    });
    res.json(list);
  };

  const createQuizForCourse = async (req, res) => {
    const { courseId } = req.params;
    const ok = await assertFacultyCanEditCourseQuiz(req, res, courseId);
    if (!ok) return;
    const quiz = await dao.createQuiz({
      _id: uuidv4(),
      course: courseId,
      title: "Unnamed Quiz",
    });
    res.json(quiz);
  };

  const getQuizById = async (req, res) => {
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.sendStatus(404);
      return;
    }
    const access = await assertCourseAccess(req, res, quiz.course);
    if (!access) return;
    if (!isFacultyRole(access.user.role) && !quiz.published) {
      res.sendStatus(403);
      return;
    }
    res.json(quiz);
  };

  const updateQuizById = async (req, res) => {
    const { quizId } = req.params;
    const existing = await dao.findQuizById(quizId);
    if (!existing) {
      res.sendStatus(404);
      return;
    }
    const ok = await assertFacultyCanEditCourseQuiz(req, res, existing.course);
    if (!ok) return;
    const body = { ...req.body };
    delete body._id;
    const updated = await dao.updateQuiz(quizId, body);
    res.json(updated);
  };

  const deleteQuizById = async (req, res) => {
    const { quizId } = req.params;
    const existing = await dao.findQuizById(quizId);
    if (!existing) {
      res.sendStatus(404);
      return;
    }
    const ok = await assertFacultyCanEditCourseQuiz(req, res, existing.course);
    if (!ok) return;
    await dao.deleteAttemptsForQuiz(quizId);
    await dao.deleteQuiz(quizId);
    res.sendStatus(200);
  };

  const submitAttempt = async (req, res) => {
    const user = requireCurrentUser(req, res);
    if (!user) return;
    if (isFacultyRole(user.role)) {
      res.status(400).json({
        message: "Faculty preview attempts are not stored on the server.",
      });
      return;
    }
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.sendStatus(404);
      return;
    }
    if (!quiz.published) {
      res.sendStatus(403);
      return;
    }
    const enrolled = await enrollmentsDao.isUserEnrolledInCourse(
      user._id,
      quiz.course
    );
    if (!enrolled) {
      res.sendStatus(403);
      return;
    }
    const { answers, accessCode: code } = req.body || {};
    if ((quiz.accessCode || "") !== "" && code !== quiz.accessCode) {
      res.status(400).json({ message: "Invalid access code." });
      return;
    }
    const maxAttempts = quiz.multipleAttempts
      ? Math.max(1, Number(quiz.howManyAttempts) || 1)
      : 1;
    const prev = await dao.countUserAttempts(quizId, user._id);
    if (prev >= maxAttempts) {
      res.status(400).json({ message: "No attempts remaining." });
      return;
    }
    const perQuestion = [];
    let score = 0;
    let maxScore = 0;
    for (const q of quiz.questions || []) {
      const full = Number(q.points) || 0;
      maxScore += full;
      const earned = scoreAnswer(q, answers?.[q._id]);
      score += earned;
      perQuestion.push({
        questionId: q._id,
        correct: full > 0 && earned === full,
        pointsEarned: earned,
      });
    }
    const attempt = await dao.createAttempt({
      quiz: quizId,
      user: user._id,
      answers: answers || {},
      score,
      maxScore,
      perQuestion,
    });
    res.json(attempt);
  };

  const getMyLastAttempt = async (req, res) => {
    const user = requireCurrentUser(req, res);
    if (!user) return;
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.sendStatus(404);
      return;
    }
    const access = await assertCourseAccess(req, res, quiz.course);
    if (!access) return;
    const attempt = await dao.findLastAttemptForUser(quizId, user._id);
    res.json(attempt || null);
  };

  const getMyAttemptCount = async (req, res) => {
    const user = requireCurrentUser(req, res);
    if (!user) return;
    const { quizId } = req.params;
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.sendStatus(404);
      return;
    }
    const access = await assertCourseAccess(req, res, quiz.course);
    if (!access) return;
    const count = await dao.countUserAttempts(quizId, user._id);
    res.json({ count });
  };

  app.get("/api/courses/:courseId/quizzes", findQuizzesForCourse);
  app.post("/api/courses/:courseId/quizzes", createQuizForCourse);
  app.get("/api/quizzes/:quizId", getQuizById);
  app.put("/api/quizzes/:quizId", updateQuizById);
  app.delete("/api/quizzes/:quizId", deleteQuizById);
  app.post("/api/quizzes/:quizId/attempts", submitAttempt);
  app.get("/api/quizzes/:quizId/attempts/me", getMyLastAttempt);
  app.get("/api/quizzes/:quizId/attempts/me/count", getMyAttemptCount);
}
