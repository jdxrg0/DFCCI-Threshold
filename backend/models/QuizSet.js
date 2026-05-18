const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  questionType: {
    type: String,
    enum: ['multiple_choice', 'true_false'],
    default: 'multiple_choice'
  },
  options: [{
    type: String,
    trim: true
  }],
  correctIndex: {
    type: Number,
    required: true
  },
  timeLimit: {
    type: Number,
    default: 15, // seconds per question
    min: 5,
    max: 60
  }
}, { _id: false });

const quizSetSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    default: 'General',
    trim: true
  },
  questions: {
    type: [questionSchema],
    validate: {
      validator: function(v) {
        return v.length > 0;
      },
      message: 'A quiz must have at least one question.'
    }
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  playCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('QuizSet', quizSetSchema);
