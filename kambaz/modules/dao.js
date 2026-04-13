import { v4 as uuidv4 } from "uuid";
import courseModel from "../courses/model.js";

export default function ModulesDao() {
  async function findModulesForCourse(courseId) {
    const course = await courseModel.findById(courseId).lean();
    if (!course) return [];
    return course.modules ?? [];
  }

  async function createModule(courseId, module) {
    const { course: _drop, _id, ...rest } = module;
    const newModule = {
      ...rest,
      _id: uuidv4(),
      lessons: module.lessons ?? [],
    };
    await courseModel.updateOne(
      { _id: courseId },
      { $push: { modules: newModule } }
    );
    return newModule;
  }

  async function deleteModule(courseId, moduleId) {
    return courseModel.updateOne(
      { _id: courseId },
      { $pull: { modules: { _id: moduleId } } }
    );
  }

  async function updateModule(courseId, moduleId, moduleUpdates) {
    const { _id, ...updates } = moduleUpdates;
    const course = await courseModel.findById(courseId);
    if (!course) return null;
    const mod = course.modules.find((m) => m._id === moduleId);
    if (!mod) return null;
    Object.assign(mod, updates);
    await course.save();
    return mod.toObject ? mod.toObject() : mod;
  }

  return {
    findModulesForCourse,
    createModule,
    deleteModule,
    updateModule,
  };
}
