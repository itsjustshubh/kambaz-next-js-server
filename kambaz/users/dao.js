import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function UsersDao() {
  const createUser = async (user) => {
    const { _id, ...rest } = user;
    const newUser = { ...rest, _id: uuidv4() };
    const doc = await model.create(newUser);
    return doc.toObject();
  };

  const findAllUsers = () => model.find().lean();

  const findUsersByRole = (role) => model.find({ role }).lean();

  const findUsersByPartialName = (partialName) => {
    const regex = new RegExp(partialName, "i");
    return model
      .find({
        $or: [
          { firstName: { $regex: regex } },
          { lastName: { $regex: regex } },
        ],
      })
      .lean();
  };

  const findUserById = (userId) => model.findById(userId).lean();

  const findUserByUsername = (username) =>
    model.findOne({ username }).lean();

  const findUserByCredentials = (username, password) =>
    model.findOne({ username, password }).lean();

  const updateUser = (userId, user) =>
    model.updateOne({ _id: userId }, { $set: user });

  const deleteUser = (userId) => model.findByIdAndDelete(userId);

  return {
    createUser,
    findAllUsers,
    findUsersByRole,
    findUsersByPartialName,
    findUserById,
    findUserByUsername,
    findUserByCredentials,
    updateUser,
    deleteUser,
  };
}
