export const moduleDocs = {
  'gentle-mirror': {
    en: {
      title: 'Gentle Mirror',
      description: 'A structured, safe space to share concerns, encourage growth, and reflect together. It uses intentional constraints to promote deep understanding rather than endless arguments.',
      whatIsIt: 'Gentle Mirror is not just a messaging tool; it is a guided reflection platform. It slows down communication by limiting replies, requiring structured reflections, and focusing on mutual understanding and positive change.',
      howToUse: [
        'Send a mirror anonymously or with your name to provide constructive feedback.',
        'If you receive a mirror, you can choose to "Accept" it immediately if you agree with the feedback, ending the discussion.',
        'If you choose to reply, you must fill out a 5-part reflection: Clarification, Feelings, Acknowledgment, Hoped Understanding, and a supporting Bible Verse.',
        'After a message is read, there is a mandatory 1-hour reflection cooldown before a reply can be sent to prevent impulsive responses.',
        'To prevent endless debates, each person is limited to a maximum of 3 replies.',
        'The sender can mark the thread as "Resolved" once they observe actual, positive change in the receiver.',
        'If the conversation becomes unproductive, either party can request counselor support, which requires mutual consent.',
        'If necessary, the sender can request the admin to delete the thread. Once approved, it will be held in a recovery bin for 60 days before permanent deletion.'
      ],
      rules: [
        'Maintain a respectful, growth-oriented tone.',
        'Think deeply before replying—you only get 3 chances.',
        'Use the 5-part reply structure honestly to foster true understanding.',
        'Respect anonymity if the sender chooses to remain hidden.'
      ],
      templates: [
        {
          title: "Template: Sending a Gentle Mirror",
          description: "Use this guide to ensure your feedback is constructive and focused on growth.",
          structure: [
            { label: "Topic", text: "A short, neutral title for the mirror." },
            { label: "Concern", text: "Describe the specific behavior or action." },
            { label: "Impact", text: "Explain how it affected you or the community." },
            { label: "Desired Change", text: "What positive change do you hope to see?" },
            { label: "Bible Verse", text: "A verse that anchors your feedback." }
          ],
          example: "Topic: Tardiness to team meetings\nConcern: I noticed you were late to the last three meetings.\nImpact: It delayed our discussions and affected the team's momentum.\nDesired Change: I hope you can adjust your schedule to arrive on time next week.\nBible Verse: Philippians 2:4 - 'Let each of you look not only to his own interests, but also to the interests of others.'"
        },
        {
          title: "Template: Replying to a Mirror",
          description: "Use this 5-part structure for your thoughtful reply.",
          structure: [
            { label: "Clarification", text: "What do you understand they are trying to say?" },
            { label: "Feelings", text: "How did receiving this feedback make you feel?" },
            { label: "Acknowledgment", text: "What part of their perspective do you acknowledge?" },
            { label: "Hoped Understanding", text: "What do you want them to understand about you?" },
            { label: "Bible Verse", text: "A verse that anchors your response." }
          ],
          example: "Clarification: I understand you feel my tardiness disrupted the team.\nFeelings: I felt embarrassed, but I appreciate you telling me.\nAcknowledgment: I admit I haven't managed my time well recently.\nHoped Understanding: I hope you understand I had unexpected family matters, but I am working on it.\nBible Verse: Ephesians 5:15-16 - 'Be very careful, then, how you live—not as unwise but as wise, making the most of every opportunity.'"
        }
      ]
    },
  },
  'system-requests': {
    en: {
      title: 'System Requests',
      description: 'A built-in helpdesk for submitting bug reports, feature suggestions, and modification requests directly to the platform administrators.',
      whatIsIt: 'System Requests is a one-way ticket system between members and the administrator. When you encounter a problem, have a feature idea, or want something in the platform changed, you create a ticket here. Administrators review all submitted tickets, update their status as work progresses, and may post an official response. You cannot edit or delete a ticket once submitted — this ensures a clear, unmodified record for the admin to review.',
      howToUse: [
        'From the Main Dashboard, open the System Requests module to see your "My Requests" list.',
        'Click "Create Request" to open the submission form.',
        'Enter a clear, specific title for your request.',
        'Select the correct type: "Bug Report" for something broken, "Feature Request" for a new idea, or "Modification Request" for a change to an existing feature.',
        'Write a detailed description. For bugs, include the steps to reproduce them. For features and modifications, explain the expected behavior.',
        'Submit your request. It is immediately saved with an "Open" status.',
        'Click any request in your list to open the Ticket View and see its full details, current status, and any admin response.',
        'You do not need to follow up — the admin updates the status and posts a response directly on your ticket.'
      ],
      rules: [
        'Tickets are final. Once submitted, you cannot edit or delete a ticket.',
        'One issue per ticket. Do not bundle multiple problems or ideas into a single submission.',
        'Only three types are accepted: Bug Report, Feature Request, or Modification Request.',
        'Your ticket can have one of four statuses: Open (waiting), In Progress (being worked on), Resolved (completed), or Closed (no further action).',
        'Only administrators can change the status or post a response — you are in a read-only role after submitting.',
        'For interpersonal or community concerns, use the Gentle Mirror module instead.'
      ]
    },
  },
  'shining-light': {
    en: {
      title: 'Shining Light',
      description: 'A platform for publicly celebrating, affirming, and recognizing what is right in a person. Instead of correcting a wrong, you are shining a light on their good deeds and character.',
      whatIsIt: 'Shining Light is the affirmative opposite of Gentle Mirror. It is completely anonymous for the sender. It is a space to send a heartfelt message of appreciation, impact, and encouragement. It also features a "Fruit of the Spirit" endorsement system to recognize the spiritual growth of others.',
      howToUse: [
        'Send a Shining Light to a fellow member to express appreciation.',
        'Your identity is hidden from the recipient — they will only see that it came from "Anonymous".',
        'Fill out the form with your Appreciation, the Impact they had, your Encouragement, and a supporting Bible verse.',
        'Use the "Endorse" tab to anonymously recognize members for displaying any of the 9 Fruits of the Holy Spirit.',
        'Check your "My Fruits" tab to see an aggregated summary of the fruits others see in you. The numbers update in real-time.',
        'When submitting an affirmation or endorsement, you will be prompted to pause and reflect on a Bible verse during a short countdown before it is sent.',
        'The recipient can respond to an affirmation with a single, brief thank-you reply and mark it as "Received with Gratitude".',
        'Shining Lights and Endorsements are never deleted. They remain as a permanent record of the good in our community.'
      ],
      rules: [
        'Be sincere. Send this to uplift, not to flatter.',
        'Focus on character, good deeds, and positive impact.',
        'Endorse fruits honestly based on observed behavior.',
        'Keep the thank-you reply brief and heartfelt.'
      ],
      templates: [
        {
          title: "Template: Sending a Shining Light",
          description: "Use this guide to ensure your affirmation is meaningful and specific.",
          structure: [
            { label: "Topic", text: "A short, celebratory title." },
            { label: "Appreciation", text: "What do you appreciate about this person?" },
            { label: "Impact", text: "How did their actions positively affect you or the community?" },
            { label: "Encouragement", text: "What do you hope they continue doing?" },
            { label: "Bible Verse", text: "A verse that grounds your praise." }
          ],
          example: "Topic: Thank you for your leadership!\nAppreciation: I really appreciate how you stepped up to lead the team project last week.\nImpact: Your clear communication kept us all calm and focused, and we met the deadline stress-free.\nEncouragement: Please keep using your gift of leadership and administration—it makes a huge difference.\nBible Verse: Matthew 5:16 - 'Let your light shine before others, that they may see your good deeds...'"
        }
      ],
      fruits: [
        { name: 'Love', description: 'Unconditional care and sacrifice for others.' },
        { name: 'Joy', description: 'Deep-seated happiness that persists regardless of circumstances.' },
        { name: 'Peace', description: 'Tranquility and harmony rooted in trust in God.' },
        { name: 'Patience', description: 'Endurance and forbearance under provocation or hardship.' },
        { name: 'Kindness', description: 'Being friendly, generous, and considerate.' },
        { name: 'Goodness', description: 'Moral excellence and virtue in action.' },
        { name: 'Faithfulness', description: 'Being reliable, loyal, and steadfast in commitments.' },
        { name: 'Gentleness', description: 'Mildness of manner and humble strength.' },
        { name: 'Self-control', description: 'Mastery over one\'s desires and impulses.' }
      ]
    },
  },
  'fund-tracker': {
    en: {
      title: 'Treasury & Fund Tracker',
      description: 'A centralized system for transparency and financial management, allowing the Youth Treasurer and Administrators to maintain the community\'s ledger and weekly dues.',
      whatIsIt: 'The Fund Tracker is a complete ledger system that tracks income, expenses, and weekly member dues. It provides real-time transparency for the entire community while giving the Youth Treasurer dedicated tools to automate record-keeping, track arrears, and generate event reports.',
      howToUse: [
        'Use the "Overview" tab to view the community\'s financial health. Everyone can see the transactions, but only management can add or change them.',
        'If you are the Treasurer, use the "Add Transaction" button for general income/expenses, or the "Fellowship Exp." button for group events.',
        'The "Fellowship Exp." tool lets you select participants from the roster, automatically calculates total fees, and generates a detailed breakdown for the ledger.',
        'For recorded events, click the "Copy" icon to generate a professionally formatted announcement—perfect for sharing the financial report with your group chats.',
        'Switch to the "Weekly Dues" tab to see the contribution matrix. It shows exactly who is updated (green check), in advance (positive balance), or in arrears (red negative balance).',
        'Treasurers can click any cell in the dues grid to record a payment. The system handles the background accounting automatically.',
        'Roster management (adding or removing members from the dues list) is found at the bottom of the Weekly Dues tab for authorized users.'
      ],
      rules: [
        'All verified members have read-only access to promote transparency.',
        'Only Administrators and the Youth Treasurer can Create, Edit, or Delete records.',
        'Deleting a transaction from the Overview will automatically clear any linked payments in the Weekly Dues grid.',
        'The baseline weekly dues is ₱10 per Sunday, starting from May 1, 2026.'
      ]
    },
  },
  'resource-center': {
    en: {
      title: 'Resource Center',
      description: 'A premium digital library and reading experience for sharing research papers, documents, and essential materials.',
      whatIsIt: 'The Resource Center is more than a file repository; it features a magazine-style reading interface with rich-text abstracts. It allows administrators to upload documents (PDF, DOCX) which members can browse, search, and download with proper filenames based on their title.',
      howToUse: [
        'Open the Resource Center from the Main Dashboard.',
        'Use the search bar or category dropdown to find resources by title, author, or tags.',
        'Click on a resource card to open its dedicated reading page.',
        'If a resource has a long abstract or description, the app automatically bookmarks your scroll position so you can resume exactly where you left off.',
        'Click the "Download File" button in the top right of the reading page to download the original document.',
        'If you are an Administrator, click the "Upload Resource" button to add new documents using the rich text editor.'
      ],
      rules: [
        'Only Administrators can upload, edit, and delete resources.',
        'Ensure uploaded documents are relevant and correctly categorized.',
        'Respect the intellectual property and copyright of the authors.'
      ]
    },
  },
  'games': {
    en: {
      title: 'Threshold Games',
      description: 'A Bible quiz platform where you can test your knowledge, compete on leaderboards, and build daily streaks with your community.',
      whatIsIt: 'Threshold Games is a quiz hub designed for the youth group. Administrators create quiz sets with curated Bible questions (multiple choice or true/false), and all verified members can play them at any time. Each quiz is timed per question, and your answers are scored server-side to keep things fair. Your scores feed into a global leaderboard, and consecutive days of play build your streak.',
      howToUse: [
        'Open Threshold Games from the Main Dashboard to see all available quizzes.',
        'Click on any quiz card to see its preview — including the number of questions and estimated time.',
        'Hit "Start Quiz" to begin. Each question has its own countdown timer displayed as an animated ring.',
        'Select your answer before time runs out. If the timer expires, it counts as unanswered.',
        'After the final question, the server scores your answers and presents your results with a detailed review of each question.',
        'Switch to the "Leaderboard" tab to see how you rank against other members by total score and average percentage.',
        'Check "My Stats" to view your quiz history, average performance, best score, and current day streak.',
        'Administrators can create new quizzes using the "+" button, choosing between Multiple Choice and True/False question types with configurable time limits per question.'
      ],
      rules: [
        'All verified members can play any published quiz.',
        'Answers are scored server-side — the correct answers are never sent to your device until after you submit.',
        'Each question has an individual timer (default 15 seconds). Unanswered questions count as incorrect.',
        'You can replay any quiz as many times as you want. All attempts are recorded.',
        'Only Administrators can create, edit, publish/unpublish, or delete quizzes.',
        'Streaks are counted by consecutive calendar days with at least one quiz played.'
      ]
    },
  },
  'devotional-tracker': {
    en: {
      title: 'Devotional Tracker',
      description: 'A personal daily quiet time tracker to build a consistent scripture reading habit, trace Bible reading progress, and stay accountable with your leaders.',
      whatIsIt: 'The Devotional Tracker is a dedicated quiet time journal and accountability module. It helps members log their daily time in God\'s Word, track streaks, map out scripture reading, and receive encouraging feedback from leaders. The built-in Bible Tracker automatically visualizes reading progress, showing exactly which parts of the Bible you have read so far.',
      howToUse: [
        'Open the Devotional Tracker from the main dashboard to view your personal stats, calendar, and recent entries.',
        'Click the "Submit Devotional" button in the top right to log a new entry.',
        'Select the Date of Devotion. You can only pick 2 days ago, yesterday, or today to help you build a timely, consistent habit.',
        'Select the Bible Book from the dropdown and type the chapters and verses (supports chapters like 1, ranges like 1-3, specific verses like 1:1-10, or complex lists).',
        'Write a detailed Summary of the key takeaways and an actionable personal Application of the scripture.',
        'Add an optional Prayer Focus if there are specific prayer requests or struggles you want your leaders to be aware of and pray for.',
        'Check the pledge checkbox to confirm your genuine quiet time and submit your entry.',
        'View your color-coded Mini Calendar Heatmap to see your consistency. Green days represent Submitted entries, while purple/blue days represent entries Acknowledged by a leader.',
        'Switch to the "Bible Tracker" tab to see a visual map of the entire Bible showing the chapters and verses you have read and tracked.',
        'If you are a Leader (Admin/Counselor), use the "Leader View" tab to access Member Folders, view real-time pending badges, review member entries, leave encouraging notes, and view their individual Bible reading progress.'
      ],
      rules: [
        'Timely submission: Entries must be submitted within a 3-day window (2 days ago, yesterday, or today) to prevent massive backlog dumping.',
        'Authenticity pledge: Every submission requires a pledge that your reflection is a genuine product of your own quiet time, free from AI-generated text or plagiarism.',
        'Locked upon acknowledgment: You can freely edit or delete your devotional entries, but ONLY before a leader acknowledges it. Once acknowledged, the entry is locked.',
        'Streak continuity: Your active day streak is calculated by consecutive calendar days with at least one devotional entry. If you miss a day, your streak will reset to 0.',
        'Streak reminders: Automated email reminders will be sent 3 hours and 1 hour before the day ends (UTC time) if your streak is at risk.'
      ],
      templates: [
        {
          title: "SOAP Devotional Method",
          description: "A structured, time-tested approach to daily quiet time to help you study, reflect, and apply God's Word.",
          structure: [
            { label: "Passage", text: "Select the book and input chapter/verse range." },
            { label: "Summary", text: "Describe what the passage is about and key takeaways." },
            { label: "Application", text: "How will you apply this to your life today? Make it personal, specific, and actionable." },
            { label: "Prayer Focus", text: "A brief prayer or request related to your reflection or current needs." }
          ],
          example: "Passage: Psalm 23:1-6\nSummary: David describes the Lord as our Shepherd who provides, guides, restores, and protects us even in the shadow of death.\nApplication: Instead of stressing over my weekly tasks, I will trust the Shepherd to guide my schedule and give me rest today.\nPrayer Focus: Lord, help me rest in Your presence. Please pray for peace amidst my busy week."
        }
      ]
    },
  }
  ,
  'automation-hub': {
    en: {
      title: 'Automation Hub',
      description: 'The admin console for scheduled Messenger dispatches: recurring group announcements, role reminders pulled from the serving calendar, and the weekly confirmation code.',
      whatIsIt: "The Automation Hub schedules messages so nobody has to remember to send them. Every schedule owns a GitHub Actions workflow; the server fires it on a UTC cron with a fully resolved message. A schedule either posts to one fixed group chat, or looks up the serving calendar and messages whoever is assigned to a role that week. Placeholders such as {Presider} and {WeeklyCode} are replaced at send time, so one template covers the whole year.",
      howToUse: [
        'Open the Automation Hub from the admin dashboard. The status rail across the top shows how many schedules are running, when the next dispatch fires, how many lineups are queued, and the current weekly code.',
        'Click "New schedule", give it a name, then choose who receives it: a group chat (one fixed Messenger URL) or whoever holds a role (resolved from the serving calendar).',
        'Set the time and the days it repeats. Times are entered in your own timezone and stored as UTC, and the editor shows the exact next run before you save.',
        'Write the message. Use the placeholder buttons to insert {Date}, {WeeklyCode} or any role from the calendar, and check the live preview underneath, which fills in the next real lineup.',
        'Optionally enable the confirmation code broadcast, which posts the lineup code for the week as a separate message on its own schedule.',
        'Use the eye icon on any card to preview exactly what the next dispatch would send, resolved by the same code the cron uses. Nothing is sent by a preview.',
        'Use the play icon to send immediately, the list icon to edit the per-date message queue, and the history icon to see every past run with its outcome.',
        'Use the switch on a card to pause a schedule. It keeps everything but stops firing, which is safer than deleting.',
        'Keep the Member Directory up to date: a role reminder can only be delivered if the name on the calendar matches a member with a Facebook chat URL.'
      ],
      rules: [
        'Admin only. Every route in this module requires an ADMIN account.',
        'Names must match exactly. The serving calendar name and the Member Directory name are matched case-insensitively but otherwise literally, so a nickname or an extra initial breaks delivery.',
        'Pause before you delete. Deleting a schedule also deletes its GitHub workflow file and cannot be undone; pausing is reversible.',
        'Preview before you send. "Send now" dispatches real messages immediately.',
        'A duplicate always starts paused, so a copy can never double-post by accident.',
        'Role schedules skip silently when there is no upcoming lineup for that role. Check the run history if a message did not arrive.',
        'The weekly code regenerates every Sunday at 12:00 PM Manila time, and any message using {WeeklyCode} picks up the new value automatically.'
      ],
      templates: [
        {
          title: "Template: Weekly lineup announcement",
          description: "A group chat post that names the whole serving team for the coming Sunday.",
          structure: [
            { label: "Greeting", text: "Who the message is for." },
            { label: "Date", text: "Use {Date} — it becomes the lineup date." },
            { label: "Assignments", text: "One line per role, using the role placeholders." },
            { label: "Code", text: "Use {WeeklyCode} if the team confirms by replying with it." }
          ],
          example: "Good day, family! Here is our lineup for {Date}:\n\nPresider: {Presider}\nSong Leader: {Song Leader}\nOpening Song: {Opening Song}\n\nPlease reply with {WeeklyCode} to confirm."
        },
        {
          title: "Template: Personal role reminder",
          description: "A direct message to whoever holds one role, sent through a role-targeted schedule.",
          structure: [
            { label: "Name", text: "Address the assigned person with their role placeholder." },
            { label: "Assignment", text: "State the role and the date." },
            { label: "Confirmation", text: "Ask for a reply containing the code so the reader bot can verify it." }
          ],
          example: "Hi {Presider}! A gentle reminder that you are presiding on {Date}.\n\nPlease confirm by replying with {WeeklyCode}. Thank you and God bless!"
        }
      ]
    },
  }
};
