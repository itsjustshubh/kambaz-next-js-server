import AssignmentsDao from "./dao.js";
import { requireFaculty } from "../authz.js";

export default function AssignmentRoutes(app) {
  const dao = AssignmentsDao();

  const findAssignmentsForCourse = async (req, res) => {
    const { courseId } = req.params;
    const list = await dao.findAssignmentsForCourse(courseId);
    res.json(list);
  };

  const createAssignmentForCourse = async (req, res) => {
    if (!requireFaculty(req, res)) return;
    const { courseId } = req.params;
    const assignment = { ...req.body, course: courseId };
    const created = await dao.createAssignment(assignment);
    res.json(created);
  };

  const getAssignmentById = async (req, res) => {
    const assignment = await dao.findAssignmentById(req.params.assignmentId);
    if (!assignment) {
      res.sendStatus(404);
      return;
    }
    res.json(assignment);
  };

  const updateAssignment = async (req, res) => {
    if (!requireFaculty(req, res)) return;
    const { assignmentId } = req.params;
    const updated = await dao.updateAssignment(assignmentId, req.body);
    if (!updated) {
      res.sendStatus(404);
      return;
    }
    res.json(updated);
  };

  const deleteAssignment = async (req, res) => {
    if (!requireFaculty(req, res)) return;
    await dao.deleteAssignment(req.params.assignmentId);
    res.sendStatus(200);
  };

  app.get("/api/courses/:courseId/assignments", findAssignmentsForCourse);
  app.post("/api/courses/:courseId/assignments", createAssignmentForCourse);
  app.get("/api/assignments/:assignmentId", getAssignmentById);
  app.put("/api/assignments/:assignmentId", updateAssignment);
  app.delete("/api/assignments/:assignmentId", deleteAssignment);
}
