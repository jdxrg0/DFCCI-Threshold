const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionIndex: {
    type: Number,
    required: true
  },
  selectedIndex: {
    type: Number,
    default: -1 // -1 means unanswered (timed out)
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  timeTakenMs: {
    type: Number,
    default: 0
  }
}, { _id: false });

const quizAttemptSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quizSet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuizSet',
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    required: true
  },
  timeTakenMs: {
    type: Number,
    default: 0
  },
  answers: [answerSchema]
}, { timestamps: true });

// Index for leaderboard queries
quizAttemptSchema.index({ quizSet: 1, percentage: -1, timeTakenMs: 1 });
quizAttemptSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
