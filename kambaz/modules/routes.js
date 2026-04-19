import ModulesDao from "./dao.js";
import { requireFaculty } from "../authz.js";

export default function ModuleRoutes(app) {
  const dao = ModulesDao();

  const findModulesForCourse = async (req, res) => {
    const { courseId } = req.params;
    const modules = await dao.findModulesForCourse(courseId);
    res.json(modules);
  };

  const createModuleForCourse = async (req, res) => {
    if (!requireFaculty(req, res)) return;
    const { courseId } = req.params;
    const module = { ...req.body };
    const newModule = await dao.createModule(courseId, module);
    res.json(newModule);
  };

  const deleteModule = async (req, res) => {
    if (!requireFaculty(req, res)) return;
    const { courseId, moduleId } = req.params;
    const status = await dao.deleteModule(courseId, moduleId);
    res.json(status);
  };

  const updateModule = async (req, res) => {
    if (!requireFaculty(req, res)) return;
    const { courseId, moduleId } = req.params;
    const moduleUpdates = req.body;
    const updated = await dao.updateModule(courseId, moduleId, moduleUpdates);
    res.json(updated);
  };

  app.get("/api/courses/:courseId/modules", findModulesForCourse);
  app.post("/api/courses/:courseId/modules", createModuleForCourse);
  app.delete("/api/courses/:courseId/modules/:moduleId", deleteModule);
  app.put("/api/courses/:courseId/modules/:moduleId", updateModule);
}
