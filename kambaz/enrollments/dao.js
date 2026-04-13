import model from "./model.js";

export default function EnrollmentsDao() {
  async function findCoursesForUser(userId) {
    const enrollments = await model
      .find({ user: userId })
      .populate({
        path: "course",
        select: "_id name description number credits department startDate endDate",
      })
      .lean();
    return enrollments.map((e) => e.course).filter(Boolean);
  }

  async function findUsersForCourse(courseId) {
    const enrollments = await model
      .find({ course: courseId })
      .populate({ path: "user", select: "-password" })
      .lean();
    return enrollments.map((e) => e.user).filter(Boolean);
  }

  async function enrollUserInCourse(userId, courseId) {
    const exists = await model.findOne({ user: userId, course: courseId });
    if (exists) return exists.toObject();
    const doc = await model.create({
      _id: `${userId}-${courseId}`,
      user: userId,
      course: courseId,
    });
    return doc.toObject();
  }

  function unenrollUserFromCourse(userId, courseId) {
    return model.deleteOne({ user: userId, course: courseId });
  }

  function unenrollAllUsersFromCourse(courseId) {
    return model.deleteMany({ course: courseId });
  }

  return {
    findCoursesForUser,
    findUsersForCourse,
    enrollUserInCourse,
    unenrollUserFromCourse,
    unenrollAllUsersFromCourse,
  };
}
