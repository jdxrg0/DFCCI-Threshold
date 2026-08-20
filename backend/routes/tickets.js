const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { recordAudit, AUDIT_ACTIONS } = require('../utils/auditLog');
const auth = requireAuth;
const adminAuth = [requireAuth, requireRole(['ADMIN'])];

// Create a new ticket
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, type } = req.body;

    if (!title || !description || !type) {
      return res.status(400).json({ msg: 'Please provide title, description, and type' });
    }

    const newTicket = new Ticket({
      title,
      description,
      type,
      createdBy: req.user._id
    });

    const savedTicket = await newTicket.save();
    res.status(201).json(savedTicket);
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get user's tickets
router.get('/my-tickets', auth, async (req, res) => {
  try {
    const tickets = await Ticket.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    console.error('Fetch tickets error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all tickets (Admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .populate('createdBy', 'displayName email')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    console.error('Admin fetch tickets error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get single ticket by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('createdBy', 'displayName email');
    
    if (!ticket) {
      return res.status(404).json({ msg: 'Ticket not found' });
    }

    // Ensure the user owns the ticket or is an admin
    if (ticket.createdBy._id.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    res.json(ticket);
  } catch (err) {
    console.error('Fetch ticket error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update ticket status and admin response (Admin only)
router.patch('/:id/admin', adminAuth, async (req, res) => {
  try {
    const { status, adminResponse } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ msg: 'Ticket not found' });
    }

    const prevStatus = ticket.status;
    const prevResponse = ticket.adminResponse;

    if (status) ticket.status = status;
    if (adminResponse !== undefined) ticket.adminResponse = adminResponse;

    await ticket.save();

    // Comparing the saved doc against the captured values, rather than against the request
    // body, is what keeps a no-op PATCH from writing a row that says nothing changed.
    if (ticket.status !== prevStatus) {
      await recordAudit(req, {
        action: AUDIT_ACTIONS.TICKET_STATUS,
        targetType: 'TICKET',
        target: ticket._id,
        targetLabel: ticket.title,
        before: { status: prevStatus },
        after: { status: ticket.status },
        summary: `Moved ticket "${ticket.title}" from ${prevStatus} to ${ticket.status}`,
      });
    }

    if (ticket.adminResponse !== prevResponse) {
      await recordAudit(req, {
        action: AUDIT_ACTIONS.TICKET_RESPONSE,
        targetType: 'TICKET',
        target: ticket._id,
        targetLabel: ticket.title,
        before: { adminResponse: prevResponse },
        after: { adminResponse: ticket.adminResponse },
        summary: `${prevResponse ? 'Updated' : 'Added'} the admin response on ticket "${ticket.title}"`,
      });
    }
    
    // Fetch updated ticket with populated user
    const updatedTicket = await Ticket.findById(req.params.id).populate('createdBy', 'displayName email');
    res.json(updatedTicket);
  } catch (err) {
    console.error('Update ticket error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
