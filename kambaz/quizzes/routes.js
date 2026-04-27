import { v4 as uuidv4 } from "uuid";
import QuizzesDao from "./dao.js";
import EnrollmentsDao from "../enrollments/dao.js";
import AssignmentsDao from "../assignments/dao.js";
import CoursesDao from "../courses/dao.js";
import { requireCurrentUser, requireFaculty, isFacultyRole } from "../authz.js";

function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function labelStudentAnswer(question, raw) {
  if (question.type === "MULTIPLE_CHOICE") {
    const idx = Number(raw);
    const c = question.choices?.[idx];
    return c?.text != null ? stripHtml(c.text) : `choice index ${raw}`;
  }
  if (question.type === "TRUE_FALSE") {
    const v =
      raw === true || raw === "true" || raw === "True" ? "True" : "False";
    return v;
  }
  return String(raw ?? "").trim() || "(blank)";
}

function labelCorrectAnswer(question) {
  if (question.type === "MULTIPLE_CHOICE") {
    return (question.choices || [])
      .filter((c) => c.isCorrect)
      .map((c) => stripHtml(c.text))
      .join("; ");
  }
  if (question.type === "TRUE_FALSE") {
    return question.correctTrueFalse ? "True" : "False";
  }
  return (question.correctBlanks || []).join("; ");
}

async function callPerplexity(system, user) {
  const key = process.env.PPLX_API_KEY;
  if (!key?.trim()) {
    const e = new Error("PPLX_API_KEY is not configured.");
    e.code = "NO_KEY";
    throw e;
  }
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(text || res.statusText);
    err.status = res.status;
    throw err;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const err = new Error("Invalid response from AI provider.");
    err.status = 502;
    throw err;
  }
  const out = data?.choices?.[0]?.message?.content?.trim();
  if (!out) {
    const err = new Error("Empty AI response.");
    err.status = 502;
    throw err;
  }
  return out;
}

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

  /**
   * Student-only: short study explanation for a question from the user's latest stored attempt.
   * Uses Perplexity when PPLX_API_KEY is set. API key never leaves the server.
   */
  const postAiExplain = async (req, res) => {
    const user = requireCurrentUser(req, res);
    if (!user) return;
    if (isFacultyRole(user.role)) {
      res.status(403).json({
        message:
          "AI explanations are tied to graded student attempts. Submit the quiz as a student account to try this.",
      });
      return;
    }
    const { quizId } = req.params;
    const { questionId } = req.body || {};
    if (!questionId || typeof questionId !== "string") {
      res.status(400).json({ message: "questionId is required." });
      return;
    }
    const quiz = await dao.findQuizById(quizId);
    if (!quiz) {
      res.sendStatus(404);
      return;
    }
    const access = await assertCourseAccess(req, res, quiz.course);
    if (!access) return;
    const enrolled = await enrollmentsDao.isUserEnrolledInCourse(
      user._id,
      quiz.course
    );
    if (!enrolled) {
      res.sendStatus(403);
      return;
    }
    const attempt = await dao.findLastAttemptForUser(quizId, user._id);
    if (!attempt) {
      res.status(400).json({ message: "Submit the quiz first to get an explanation." });
      return;
    }
    const question = (quiz.questions || []).find((q) => q._id === questionId);
    if (!question) {
      res.sendStatus(404);
      return;
    }
    const row = (attempt.perQuestion || []).find(
      (p) => p.questionId === questionId
    );
    if (!row) {
      res.status(400).json({ message: "That question was not part of your attempt." });
      return;
    }
    const rawAnswer = attempt.answers?.[questionId];
    const studentAns = labelStudentAnswer(question, rawAnswer);
    const correctAns = labelCorrectAnswer(question);
    const wasCorrect = !!row.correct;
    const concealExact =
      quiz.showCorrectAnswers === "Never" && !wasCorrect;

    const system =
      "You are a concise course tutor. Use plain language. Do not mention that you are an AI. " +
      "If asked to avoid revealing the exact answer, give a conceptual hint only (no letter/choice text that matches the keyed correct answer).";

    const userPrompt = [
      `Quiz: ${quiz.title}`,
      `Question title: ${question.title || "Question"}`,
      `Stem: ${stripHtml(question.questionHtml)}`,
      `Type: ${question.type}`,
      `Student answer: ${studentAns}`,
      `Correct answer (internal — ${concealExact ? "do not quote this to the student" : "you may use this"}): ${correctAns}`,
      `Student was ${wasCorrect ? "CORRECT" : "INCORRECT"}.`,
      `Quiz "show correct answers" setting: ${quiz.showCorrectAnswers}.`,
      concealExact
        ? "Write 2–4 sentences: help them think through the topic without stating the exact correct option or fill-in text."
        : wasCorrect
          ? "Write 2–3 sentences reinforcing the idea."
          : "Write 3–5 sentences explaining the idea and why the correct answer is right.",
    ].join("\n");

    try {
      const explanation = await callPerplexity(system, userPrompt);
      res.json({ explanation });
    } catch (e) {
      if (e.code === "NO_KEY") {
        res.status(503).json({
          message:
            "AI explanations are not configured. Set PPLX_API_KEY on the server (e.g. Render environment).",
        });
        return;
      }
      const status = e.status >= 400 && e.status < 600 ? e.status : 502;
      res.status(status).json({
        message: "Could not generate an explanation right now. Try again in a moment.",
      });
    }
  };

  app.get("/api/courses/:courseId/quizzes", findQuizzesForCourse);
  app.post("/api/courses/:courseId/quizzes", createQuizForCourse);
  app.get("/api/quizzes/:quizId", getQuizById);
  app.put("/api/quizzes/:quizId", updateQuizById);
  app.delete("/api/quizzes/:quizId", deleteQuizById);
  app.post("/api/quizzes/:quizId/attempts", submitAttempt);
  app.get("/api/quizzes/:quizId/attempts/me", getMyLastAttempt);
  app.get("/api/quizzes/:quizId/attempts/me/count", getMyAttemptCount);
  app.post("/api/quizzes/:quizId/ai/explain", postAiExplain);
}
