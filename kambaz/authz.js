export function requireCurrentUser(req, res) {
  const user = req.session["currentUser"];
  if (!user) {
    res.sendStatus(401);
    return null;
  }
  return user;
}

export function requireFaculty(req, res) {
  const user = requireCurrentUser(req, res);
  if (!user) return null;
  if (user.role !== "FACULTY" && user.role !== "ADMIN") {
    res.sendStatus(403);
    return null;
  }
  return user;
}

export function isFacultyRole(role) {
  return role === "FACULTY" || role === "ADMIN";
}
