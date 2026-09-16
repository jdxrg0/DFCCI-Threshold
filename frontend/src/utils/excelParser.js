export const downloadExcelTemplate = async () => {
  const XLSX = await import('xlsx');
  const currentYear = new Date().getFullYear();
  const wsData = [
    [`Serving Schedule ${currentYear}`],
    [],
    ['JANUARY', 4, 11, 18, 25],
    ['Presider', 'John Doe', 'Jane Smith', 'Michael Johnson', 'Sarah Lee'],
    ['Song Leader', 'Alice Brown', 'Bob White', 'Charlie Green', 'Diana Black'],
    ['Opening Song', 'Eve Adams', 'Frank Clark', 'Grace Hall', 'Henry Ford'],
    [],
    ['FEBRUARY', 1, 8, 15, 22],
    ['Presider', 'Name', 'Name', 'Name', 'Name'],
    ['Song Leader', 'Name', 'Name', 'Name', 'Name'],
    ['Opening Song', 'Name', 'Name', 'Name', 'Name'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Make the columns a bit wider for readability
  ws['!cols'] = [
    { wch: 15 }, // Role name
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Schedule Template");
  XLSX.writeFile(wb, `Serving_Schedule_Template_${currentYear}.xlsx`);
};

export const parseExcelSchedule = async (file) => {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const assignments = parseScheduleLogic(rows);
        resolve(assignments);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

const parseScheduleLogic = (rows) => {
  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  let currentMonth = -1;
  let currentYear = new Date().getFullYear();
  let colToDate = {};
  const assignments = {}; // format: { "YYYY-MM-DD": { "Presider": "Name", "Opening Prayer": "Name" } }

  // Try to find year in the first few rows (e.g., "DFCCI 2026")
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const rowStr = (rows[i] || []).join(' ').toUpperCase();
    const match = rowStr.match(/(20\d{2})/);
    if (match) currentYear = parseInt(match[1]);
  }

  rows.forEach(row => {
    if (!row || row.length === 0) return;
    const firstCell = String(row[0] || '').trim().toUpperCase();

    // Is it a month header?
    if (months.includes(firstCell)) {
      currentMonth = months.indexOf(firstCell);
      colToDate = {}; // reset mapping for this block
      for (let c = 1; c < row.length; c++) {
        const dateNum = parseInt(row[c]);
        if (!isNaN(dateNum)) {
          // Format as YYYY-MM-DD
          const monthStr = String(currentMonth + 1).padStart(2, '0');
          const dayStr = String(dateNum).padStart(2, '0');
          const dateKey = `${currentYear}-${monthStr}-${dayStr}`;
          colToDate[c] = dateKey;

          if (!assignments[dateKey]) assignments[dateKey] = {};
        }
      }
    }
    // Otherwise, assume it's a role row if we have an active month mapping
    else if (firstCell && currentMonth !== -1 && Object.keys(colToDate).length > 0) {
      // Role name
      const roleName = String(row[0]).trim();
      if (roleName.toLowerCase() === 'date' || roleName === '') return; // Skip invalid

      // Get names for each date column
      for (let c = 1; c < row.length; c++) {
        if (colToDate[c] && row[c]) {
          const personName = String(row[c]).trim();
          assignments[colToDate[c]][roleName] = personName;
        }
      }
    }
  });

  return assignments;
};

export const generateQueueFromAssignments = (assignments, messageTemplate, codeTemplate = 'DFCCI-S-LU-{DATE}') => {
  const queue = [];

  // Sort dates
  const sortedDates = Object.keys(assignments).sort();

  sortedDates.forEach(dateKey => {
    const roles = assignments[dateKey];
    let generatedMessage = messageTemplate;

    // Replace {DATE_TODAY} / {DATE_TOMORROW} placeholders
    // For this queue, we'll format the targetDate into a human readable string if they use {DATE_TOMORROW}
    // E.g., if dateKey is "2026-07-05", that is the target date (Sunday).
    // The user's template might use {DATE_TOMORROW} because the cron runs on Saturday.
    // So we just replace {DATE_TOMORROW} with the formatted dateKey.
    /* 'YYYY-MM-DD' parses as UTC midnight, so reading it back with local getters
       shifts the whole lineup a day earlier for any admin west of UTC — the
       announced date and the confirmation code both drift, and the code stops
       matching the one the server generates. Stay in UTC on both ends. */
    const [dyear, dmonth, dday] = dateKey.split('-').map(Number);
    const dateObj = new Date(Date.UTC(dyear, dmonth - 1, dday));
    const dateFormatted = dateObj
      .toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: '2-digit', year: 'numeric' })
      .toUpperCase();

    generatedMessage = generatedMessage.replace(/{DATE_NEXT_SUNDAY}/gi, dateFormatted);

    // Replace role placeholders e.g., {Presider}
    Object.keys(roles).forEach(role => {
      const personName = roles[role];
      // Create regex for {Role Name} - escape regex chars just in case
      const safeRole = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`{${safeRole}}`, 'g');
      generatedMessage = generatedMessage.replace(regex, personName);
    });

    // Generate Semantic Code
    let semanticCode = codeTemplate;
    // Format {DATE} to MMDDYY (e.g. 071926)
    const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getUTCDate()).padStart(2, '0');
    const yy = String(dateObj.getUTCFullYear()).slice(-2);
    semanticCode = semanticCode.replace(/{DATE}/gi, `${mm}${dd}${yy}`);

    queue.push({
      targetDate: dateKey,
      messageText: generatedMessage,
      isSent: false,
      parsedRoles: roles,
      weeklyConfirmationCode: semanticCode
    });
  });

  return queue;
};
