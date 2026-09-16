const mongoose = require('mongoose');

// A malformed :id otherwise reaches findById and surfaces a CastError as a 500
// 'Server error', which tells the client the server is broken when the link it
// followed was simply stale.
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const badObjectId = (res, id, message = 'Invalid id') => {
  if (isValidObjectId(id)) return false;
  res.status(400).json({ message });
  return true;
};

module.exports = { isValidObjectId, badObjectId };