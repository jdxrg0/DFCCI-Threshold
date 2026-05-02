require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('./models/Thread');
const User = require('./models/User');

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const users = await User.find().limit(2);
    if (users.length < 2) {
      console.log('Not enough users');
      process.exit(1);
    }
    
    const sender = users[0];
    const receiver = users[1];
    
    const thread = new Thread({
      sender: sender._id,
      receiver: receiver._id,
      messages: [{
        authorType: 'Sender',
        isInitial: true,
        content: {
          concern: 'Test',
          impact: 'Test',
          desiredChange: 'Test',
          bibleVerse: 'Test'
        }
      }]
    });
    
    await thread.save();
    console.log('Thread saved');
    
    await thread.populate('receiver');
    console.log('Thread populated', thread.receiver.email);
    
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}
test();
