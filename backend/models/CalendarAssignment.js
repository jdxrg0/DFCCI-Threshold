const mongoose = require('mongoose');

const calendarAssignmentSchema = new mongoose.Schema({
  targetDate: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    unique: true
  },
  roles: {
    type: Map,
    of: String, // Maps RoleName -> MemberName
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
calendarAssignmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CalendarAssignment', calendarAssignmentSchema);
