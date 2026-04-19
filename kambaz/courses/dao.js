import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function CoursesDao(enrollmentsDao, assignmentsDao) {
  function findAllCourses() {
    return model.find().select("-modules").lean();
  }

  function findCourseById(courseId) {
    return model.findById(courseId).lean();
  }

  function findCoursesByFaculty(facultyId) {
    return model.find({ facultyId }).select("-modules").lean();
  }

  async function createCourse(course) {
    const { _id, modules, ...rest } = course;
    const newCourse = {
      ...rest,
      _id: uuidv4(),
      modules: [],
    };
    const doc = await model.create(newCourse);
    return doc.toObject();
  }

  async function deleteCourse(courseId) {
    await enrollmentsDao.unenrollAllUsersFromCourse(courseId);
    await assignmentsDao.deleteAssignmentsForCourse(courseId);
    return model.deleteOne({ _id: courseId });
  }

  async function updateCourse(courseId, courseUpdates) {
    const { _id, modules, ...safe } = courseUpdates;
    return model.updateOne({ _id: courseId }, { $set: safe });
  }

  return {
    findAllCourses,
    findCourseById,
    findCoursesByFaculty,
    createCourse,
    deleteCourse,
    updateCourse,
  };
}
