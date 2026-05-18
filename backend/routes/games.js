const express = require('express');
const router = express.Router();
const QuizSet = require('../models/QuizSet');
const QuizAttempt = require('../models/QuizAttempt');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// ── Helper: strip correctIndex and explanations from questions for the player ────────────────
const sanitizeQuiz = (quiz) => {
  const obj = quiz.toObject();
  obj.questions = obj.questions.map(({ correctIndex, explanations, ...rest }) => rest);
  return obj;
};

// ── GET /quizzes — list all published quiz sets (or all for admin) ───────────
router.get('/quizzes', requireAuth, async (req, res) => {
  try {
    const filter = req.user.role === 'ADMIN' ? {} : { isPublished: true };
    const quizzes = await QuizSet.find(filter)
      .select('title description category isPublished playCount questions createdAt')
      .sort({ createdAt: -1 })
      .populate('createdBy', 'displayName');
    
    // Return question count, not full questions
    const result = quizzes.map(q => {
      const obj = q.toObject();
      obj.questionCount = obj.questions.length;
      delete obj.questions;
      return obj;
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /quizzes/:id — get full quiz for playing (correctIndex stripped) ─────
router.get('/quizzes/:id', requireAuth, async (req, res) => {
  try {
    const quiz = await QuizSet.findById(req.params.id).populate('createdBy', 'displayName');
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    // Admin can see unpublished quizzes; members can only see published
    if (!quiz.isPublished && req.user.role !== 'ADMIN') {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    // If admin requests with ?admin=true, return full quiz with answers for editing
    if (req.query.admin === 'true' && req.user.role === 'ADMIN') {
      return res.json(quiz);
    }
    
    // Strip correctIndex for players
    res.json(sanitizeQuiz(quiz));
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /quizzes — create a new quiz set (Admin only) ──────────────────────
router.post('/quizzes', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { title, description, category, questions, isPublished } = req.body;
    
    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Title and at least one question are required.' });
    }
    
    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText) {
        return res.status(400).json({ message: `Question ${i + 1} is missing text.` });
      }
      if (q.questionType === 'true_false') {
        q.options = ['True', 'False'];
        if (q.correctIndex !== 0 && q.correctIndex !== 1) {
          return res.status(400).json({ message: `Question ${i + 1} (True/False) must have correctIndex 0 or 1.` });
        }
      } else {
        if (!q.options || q.options.length < 2) {
          return res.status(400).json({ message: `Question ${i + 1} needs at least 2 options.` });
        }
        if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
          return res.status(400).json({ message: `Question ${i + 1} has an invalid correct answer index.` });
        }
      }
      // Populate explanations parallel to options length
      if (!q.explanations) {
        q.explanations = new Array(q.options.length).fill('');
      } else {
        while (q.explanations.length < q.options.length) {
          q.explanations.push('');
        }
        q.explanations = q.explanations.slice(0, q.options.length);
      }
    }
    
    const quiz = new QuizSet({
      title,
      description,
      category: category || 'General',
      questions,
      isPublished: isPublished || false,
      createdBy: req.user._id
    });
    
    await quiz.save();
    await quiz.populate('createdBy', 'displayName');
    res.status(201).json(quiz);
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PUT /quizzes/:id — update a quiz set (Admin only) ───────────────────────
router.put('/quizzes/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { title, description, category, questions, isPublished } = req.body;
    
    const quiz = await QuizSet.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    if (title !== undefined) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (category !== undefined) quiz.category = category;
    if (isPublished !== undefined) quiz.isPublished = isPublished;
    
    if (questions !== undefined) {
      if (questions.length === 0) {
        return res.status(400).json({ message: 'A quiz must have at least one question.' });
      }
      // Normalize true/false options and populate explanations parallel to options length
      for (const q of questions) {
        if (q.questionType === 'true_false') {
          q.options = ['True', 'False'];
        }
        if (!q.explanations) {
          q.explanations = new Array(q.options.length).fill('');
        } else {
          while (q.explanations.length < q.options.length) {
            q.explanations.push('');
          }
          q.explanations = q.explanations.slice(0, q.options.length);
        }
      }
      quiz.questions = questions;
    }
    
    await quiz.save();
    await quiz.populate('createdBy', 'displayName');
    res.json(quiz);
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /quizzes/:id — delete a quiz set (Admin only) ────────────────────
router.delete('/quizzes/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const quiz = await QuizSet.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    // Also delete all attempts for this quiz
    await QuizAttempt.deleteMany({ quizSet: quiz._id });
    await quiz.deleteOne();
    
    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /quizzes/:id/submit — submit quiz answers for server-side scoring ──
router.post('/quizzes/:id/submit', requireAuth, async (req, res) => {
  try {
    const { answers, timeTakenMs } = req.body;
    
    const quiz = await QuizSet.findById(req.params.id);
    if (!quiz || !quiz.isPublished) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    if (!answers || answers.length !== quiz.questions.length) {
      return res.status(400).json({ message: 'Invalid submission: answer count does not match question count.' });
    }
    
    // Server-side scoring
    let score = 0;
    const gradedAnswers = quiz.questions.map((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer.selectedIndex === question.correctIndex;
      if (isCorrect) score++;
      
      return {
        questionIndex: index,
        selectedIndex: userAnswer.selectedIndex,
        isCorrect,
        timeTakenMs: userAnswer.timeTakenMs || 0
      };
    });
    
    const totalQuestions = quiz.questions.length;
    const percentage = Math.round((score / totalQuestions) * 100);
    
    // Create attempt record
    const attempt = new QuizAttempt({
      user: req.user._id,
      quizSet: quiz._id,
      score,
      totalQuestions,
      percentage,
      timeTakenMs: timeTakenMs || 0,
      answers: gradedAnswers
    });
    
    await attempt.save();
    
    // Increment play count
    await QuizSet.findByIdAndUpdate(quiz._id, { $inc: { playCount: 1 } });
    
    // Return results with the correct answers revealed
    const results = quiz.questions.map((q, i) => ({
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options,
      explanations: q.explanations || [],
      correctIndex: q.correctIndex,
      selectedIndex: gradedAnswers[i].selectedIndex,
      isCorrect: gradedAnswers[i].isCorrect
    }));
    
    res.json({
      score,
      totalQuestions,
      percentage,
      timeTakenMs: attempt.timeTakenMs,
      results,
      attemptId: attempt._id
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /leaderboard — global leaderboard ───────────────────────────────────
router.get('/leaderboard', requireAuth, async (req, res) => {
  try {
    const leaderboard = await QuizAttempt.aggregate([
      {
        $group: {
          _id: '$user',
          totalScore: { $sum: '$score' },
          totalQuestions: { $sum: '$totalQuestions' },
          quizzesPlayed: { $sum: 1 },
          avgPercentage: { $avg: '$percentage' },
          bestPercentage: { $max: '$percentage' }
        }
      },
      { $sort: { totalScore: -1, avgPercentage: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          _id: 1,
          displayName: '$userInfo.displayName',
          totalScore: 1,
          quizzesPlayed: 1,
          avgPercentage: { $round: ['$avgPercentage', 1] },
          bestPercentage: 1
        }
      }
    ]);
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /leaderboard/:quizId — per-quiz leaderboard ─────────────────────────
router.get('/leaderboard/:quizId', requireAuth, async (req, res) => {
  try {
    // Get best attempt per user for this quiz
    const leaderboard = await QuizAttempt.aggregate([
      { $match: { quizSet: require('mongoose').Types.ObjectId.createFromHexString(req.params.quizId) } },
      { $sort: { percentage: -1, timeTakenMs: 1 } },
      {
        $group: {
          _id: '$user',
          bestAttempt: { $first: '$$ROOT' }
        }
      },
      { $replaceRoot: { newRoot: '$bestAttempt' } },
      { $sort: { percentage: -1, timeTakenMs: 1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          _id: 1,
          userId: '$user',
          displayName: '$userInfo.displayName',
          score: 1,
          totalQuestions: 1,
          percentage: 1,
          timeTakenMs: 1,
          createdAt: 1
        }
      }
    ]);
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching quiz leaderboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /my-stats — current user's stats ────────────────────────────────────
router.get('/my-stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const attempts = await QuizAttempt.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('quizSet', 'title');
    
    if (attempts.length === 0) {
      return res.json({
        quizzesPlayed: 0,
        totalScore: 0,
        avgPercentage: 0,
        bestPercentage: 0,
        currentStreak: 0,
        recentAttempts: []
      });
    }
    
    const totalScore = attempts.reduce((sum, a) => sum + a.score, 0);
    const avgPercentage = Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length);
    const bestPercentage = Math.max(...attempts.map(a => a.percentage));
    
    // Calculate streak: consecutive days with at least one quiz
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get unique dates of play
    const playDates = [...new Set(
      attempts.map(a => {
        const d = new Date(a.createdAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    )].sort((a, b) => b - a); // Sort descending (most recent first)
    
    if (playDates.length > 0) {
      const oneDayMs = 24 * 60 * 60 * 1000;
      // Check if user played today or yesterday (allow streak to continue until end of today)
      const mostRecentPlay = playDates[0];
      const diffFromToday = (today.getTime() - mostRecentPlay) / oneDayMs;
      
      if (diffFromToday <= 1) {
        currentStreak = 1;
        for (let i = 1; i < playDates.length; i++) {
          const diff = (playDates[i - 1] - playDates[i]) / oneDayMs;
          if (diff === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }
    
    res.json({
      quizzesPlayed: attempts.length,
      totalScore,
      avgPercentage,
      bestPercentage,
      currentStreak,
      recentAttempts: attempts.slice(0, 10).map(a => ({
        _id: a._id,
        quizTitle: a.quizSet?.title || 'Deleted Quiz',
        score: a.score,
        totalQuestions: a.totalQuestions,
        percentage: a.percentage,
        timeTakenMs: a.timeTakenMs,
        createdAt: a.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /my-attempts — current user's attempt history ───────────────────────
router.get('/my-attempts', requireAuth, async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('quizSet', 'title category');
    
    res.json(attempts);
  } catch (error) {
    console.error('Error fetching attempts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
