const express = require('express');
const router = express.Router();
const AppSetting = require('../models/AppSetting');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// These settings drive what the automation bot posts and where it posts it,
// so they are admin-only. The middleware was imported here from the start but
// never applied, which left the dispatch target open to anyone.
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

// Get Weekly Code Config
router.get('/weekly-code', async (req, res) => {
  try {
    let setting = await AppSetting.findOne({ key: 'weekly_code_config' });
    if (!setting) {
      // Default initialization
      setting = new AppSetting({
        key: 'weekly_code_config',
        value: {
          template: 'DFCCI-S-LU-{DATE}',
          currentCode: 'Pending Generation (Next Sunday)',
          lastGeneratedDate: null,
          dispatchUrl: '',
          dispatchCron: '0 13 * * 0',
          dispatchMessage: 'Here is the weekly code: {WeeklyCode}',
          enableDispatch: false
        }
      });
      await setting.save();
    }
    res.json(setting.value);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Update Weekly Code Config
router.put('/weekly-code', async (req, res) => {
  try {
    const { template, forceGenerate, dispatchUrl, dispatchCron, dispatchMessage, enableDispatch } = req.body;
    let setting = await AppSetting.findOne({ key: 'weekly_code_config' });
    
    if (!setting) {
      setting = new AppSetting({ key: 'weekly_code_config', value: {} });
    }

    const value = { ...setting.value };
    if (template !== undefined) value.template = template;
    if (dispatchUrl !== undefined) value.dispatchUrl = dispatchUrl;
    if (dispatchCron !== undefined) value.dispatchCron = dispatchCron;
    if (dispatchMessage !== undefined) value.dispatchMessage = dispatchMessage;
    if (enableDispatch !== undefined) value.enableDispatch = enableDispatch;

    if (forceGenerate) {
      // Calculate MMDDYY based on next Sunday's date. The code names a Manila
      // Sunday, so it is worked out on the Manila calendar and read back in UTC:
      // host-local getters drift a day on any server west of UTC.
      const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      const [year, month, day] = todayKey.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      const daysUntilNextSunday = date.getUTCDay() === 0 ? 7 : 7 - date.getUTCDay();
      date.setUTCDate(date.getUTCDate() + daysUntilNextSunday);
      
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(date.getUTCDate()).padStart(2, '0');
      const yy = String(date.getUTCFullYear()).slice(-2);
      const code = (value.template || 'DFCCI-S-LU-{DATE}').replace(/{DATE}/gi, `${mm}${dd}${yy}`);
      
      value.currentCode = code;
      value.lastGeneratedDate = new Date();
    }

    setting.value = value;
    setting.updatedAt = new Date();
    await setting.save();
    
    // Attempt to reload the automation scheduler to pick up changes
    try {
      const automationScheduler = require('../services/automationScheduler');
      await automationScheduler.reloadWeeklyCodeDispatch();
    } catch (e) {
      console.error('Failed to reload weekly code dispatch cron:', e.message);
    }

    res.json(setting.value);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
