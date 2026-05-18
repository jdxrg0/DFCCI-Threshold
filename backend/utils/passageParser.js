const BIBLE_VERSE_COUNTS = require('./bibleVerseCounts');

/**
 * Parses a passage string and returns an object mapping chapter numbers to arrays of verses.
 * E.g. "1, 2:1-10" -> { 1: [1,2,3...maxV], 2: [1..10] }
 */
function parsePassage(book, passageStr) {
  const counts = BIBLE_VERSE_COUNTS[book];
  if (!counts) throw new Error('Invalid book');

  const result = {}; // map of chapter -> Set of verses

  const addVerses = (ch, vStart, vEnd) => {
    if (ch < 1 || ch > counts.length) throw new Error(`Chapter ${ch} is out of bounds for ${book} (max ${counts.length})`);
    const maxV = counts[ch - 1];
    if (vStart < 1) vStart = 1;
    if (vEnd > maxV) vEnd = maxV;
    if (vStart > vEnd) throw new Error(`Invalid verse range ${vStart}-${vEnd} in ${book} ${ch}`);

    if (!result[ch]) result[ch] = new Set();
    for (let i = vStart; i <= vEnd; i++) {
      result[ch].add(i);
    }
  };

  const addWholeChapter = (ch) => {
    if (ch < 1 || ch > counts.length) throw new Error(`Chapter ${ch} is out of bounds for ${book} (max ${counts.length})`);
    addVerses(ch, 1, counts[ch - 1]);
  };

  // Split by commas to handle "1, 2:1-5"
  const parts = passageStr.split(',').map(p => p.trim()).filter(Boolean);

  for (let part of parts) {
    if (part.includes('-')) {
      // Range: could be "1-2" or "1:5-10" or "1:5-2:10"
      const [startPart, endPart] = part.split('-').map(p => p.trim());

      let startCh, startV, endCh, endV;

      if (startPart.includes(':')) {
        const s = startPart.split(':');
        startCh = parseInt(s[0], 10);
        startV = parseInt(s[1], 10);
      } else {
        startCh = parseInt(startPart, 10);
        startV = 1;
      }

      if (endPart.includes(':')) {
        const e = endPart.split(':');
        endCh = parseInt(e[0], 10);
        endV = parseInt(e[1], 10);
      } else {
        // if end part has no colon, it could be a chapter if start had no colon ("1-2"), 
        // or it could be a verse if start had a colon ("1:5-10")
        if (startPart.includes(':')) {
          endCh = startCh;
          endV = parseInt(endPart, 10);
        } else {
          endCh = parseInt(endPart, 10);
          if (endCh < 1 || endCh > counts.length) throw new Error(`Chapter ${endCh} out of bounds`);
          endV = counts[endCh - 1]; // whole chapter
        }
      }

      if (isNaN(startCh) || isNaN(startV) || isNaN(endCh) || isNaN(endV)) {
         throw new Error(`Invalid range format: ${part}`);
      }

      // Fill verses from startCh:startV to endCh:endV
      for (let c = startCh; c <= endCh; c++) {
        const cMax = counts[c - 1];
        let v1 = (c === startCh) ? startV : 1;
        let v2 = (c === endCh) ? endV : cMax;
        addVerses(c, v1, v2);
      }
    } else {
      // Single item: could be "1" or "1:5"
      if (part.includes(':')) {
        const [c, v] = part.split(':').map(n => parseInt(n, 10));
        if (isNaN(c) || isNaN(v)) throw new Error(`Invalid format: ${part}`);
        addVerses(c, v, v); // Single verse
      } else {
        const c = parseInt(part, 10);
        if (isNaN(c)) throw new Error(`Invalid chapter: ${part}`);
        addWholeChapter(c);
      }
    }
  }

  // Convert Sets to Arrays
  const finalResult = {};
  for (const ch in result) {
    finalResult[ch] = Array.from(result[ch]).sort((a, b) => a - b);
  }

  return finalResult;
}

module.exports = { parsePassage };
