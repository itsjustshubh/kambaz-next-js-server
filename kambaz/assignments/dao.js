import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function AssignmentsDao() {
  function findAssignmentsForCourse(courseId) {
    return model.find({ course: courseId }).lean();
  }

  function findAssignmentById(assignmentId) {
    return model.findById(assignmentId).lean();
  }

  async function createAssignment(assignment) {
    const { _id, ...rest } = assignment;
    const newAssignment = { ...rest, _id: uuidv4() };
    const doc = await model.create(newAssignment);
    return doc.toObject();
  }

  function deleteAssignment(assignmentId) {
    return model.findByIdAndDelete(assignmentId);
  }

  function deleteAssignmentsForCourse(courseId) {
    return model.deleteMany({ course: courseId });
  }

  async function updateAssignment(assignmentId, updates) {
    const { _id, ...rest } = updates;
    await model.updateOne({ _id: assignmentId }, { $set: rest });
    return model.findById(assignmentId).lean();
  }

  return {
    findAssignmentsForCourse,
    findAssignmentById,
    createAssignment,
    deleteAssignment,
    deleteAssignmentsForCourse,
    updateAssignment,
  };
}
