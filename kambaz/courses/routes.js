import CoursesDao from "./dao.js";
import EnrollmentsDao from "../enrollments/dao.js";
import AssignmentsDao from "../assignments/dao.js";
import QuizzesDao from "../quizzes/dao.js";
import { requireFaculty } from "../authz.js";

export default function CourseRoutes(app) {
  const enrollmentsDao = EnrollmentsDao();
  const assignmentsDao = AssignmentsDao();
  const quizzesDao = QuizzesDao();
  const dao = CoursesDao(enrollmentsDao, assignmentsDao);

  const findAllCourses = async (req, res) => {
    const courses = await dao.findAllCourses();
    res.json(courses);
  };

  const findCoursesForEnrolledUser = async (req, res) => {
    let { userId } = req.params;
    const sessionUser = req.session["currentUser"];
    if (userId === "current") {
      if (!sessionUser) {
        res.sendStatus(401);
        return;
      }
      userId = sessionUser._id;
      if (sessionUser.role === "FACULTY" || sessionUser.role === "ADMIN") {
        const courses = await dao.findCoursesByFaculty(userId);
        res.json(courses);
        return;
      }
      const courses = await enrollmentsDao.findCoursesForUser(userId);
      res.json(courses);
      return;
    }
    const courses = await enrollmentsDao.findCoursesForUser(userId);
    res.json(courses);
  };

  const findUsersForCourse = async (req, res) => {
    if (!req.session["currentUser"]) {
      res.sendStatus(401);
      return;
    }
    const { courseId } = req.params;
    const users = await enrollmentsDao.findUsersForCourse(courseId);
    res.json(users);
  };

  const createCourse = async (req, res) => {
    const currentUser = requireFaculty(req, res);
    if (!currentUser) return;
    const newCourse = await dao.createCourse({
      ...req.body,
      facultyId: currentUser._id,
    });
    await enrollmentsDao.enrollUserInCourse(currentUser._id, newCourse._id);
    res.json(newCourse);
  };

  const assertFacultyCourseEdit = async (req, res, courseId) => {
    const currentUser = requireFaculty(req, res);
    if (!currentUser) return null;
    const course = await dao.findCourseById(courseId);
    if (!course) {
      res.sendStatus(404);
      return null;
    }
    if (currentUser.role === "ADMIN") return currentUser;
    if (course.facultyId && course.facultyId !== currentUser._id) {
      res.sendStatus(403);
      return null;
    }
    return currentUser;
  };

  const deleteCourse = async (req, res) => {
    const { courseId } = req.params;
    const ok = await assertFacultyCourseEdit(req, res, courseId);
    if (!ok) return;
    await quizzesDao.deleteQuizzesForCourse(courseId);
    const status = await dao.deleteCourse(courseId);
    res.json(status);
  };

  const updateCourse = async (req, res) => {
    const { courseId } = req.params;
    const ok = await assertFacultyCourseEdit(req, res, courseId);
    if (!ok) return;
    const courseUpdates = req.body;
    await dao.updateCourse(courseId, courseUpdates);
    res.sendStatus(204);
  };

  app.get("/api/courses", findAllCourses);
  app.get("/api/courses/:courseId/users", findUsersForCourse);
  app.get("/api/users/:userId/courses", findCoursesForEnrolledUser);
  app.post("/api/users/current/courses", createCourse);
  app.delete("/api/courses/:courseId", deleteCourse);
  app.put("/api/courses/:courseId", updateCourse);
}
