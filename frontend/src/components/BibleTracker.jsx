import { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, ChevronDown, CheckCircle2,
  Scale, Scroll, Music, Flame, Volume2, Sparkles, Globe, Mail, Heart, Crown
} from 'lucide-react';
import * as devotionals from '../services/devotionals';
import { BIBLE_VERSE_COUNTS } from '../data/bibleVerseCounts';

const BIBLE_DATA = [
  { name: 'Genesis', chapters: 50, testament: 'OT' },
  { name: 'Exodus', chapters: 40, testament: 'OT' },
  { name: 'Leviticus', chapters: 27, testament: 'OT' },
  { name: 'Numbers', chapters: 36, testament: 'OT' },
  { name: 'Deuteronomy', chapters: 34, testament: 'OT' },
  { name: 'Joshua', chapters: 24, testament: 'OT' },
  { name: 'Judges', chapters: 21, testament: 'OT' },
  { name: 'Ruth', chapters: 4, testament: 'OT' },
  { name: '1 Samuel', chapters: 31, testament: 'OT' },
  { name: '2 Samuel', chapters: 24, testament: 'OT' },
  { name: '1 Kings', chapters: 22, testament: 'OT' },
  { name: '2 Kings', chapters: 25, testament: 'OT' },
  { name: '1 Chronicles', chapters: 29, testament: 'OT' },
  { name: '2 Chronicles', chapters: 36, testament: 'OT' },
  { name: 'Ezra', chapters: 10, testament: 'OT' },
  { name: 'Nehemiah', chapters: 13, testament: 'OT' },
  { name: 'Esther', chapters: 10, testament: 'OT' },
  { name: 'Job', chapters: 42, testament: 'OT' },
  { name: 'Psalms', chapters: 150, testament: 'OT' },
  { name: 'Proverbs', chapters: 31, testament: 'OT' },
  { name: 'Ecclesiastes', chapters: 12, testament: 'OT' },
  { name: 'Song of Solomon', chapters: 8, testament: 'OT' },
  { name: 'Isaiah', chapters: 66, testament: 'OT' },
  { name: 'Jeremiah', chapters: 52, testament: 'OT' },
  { name: 'Lamentations', chapters: 5, testament: 'OT' },
  { name: 'Ezekiel', chapters: 48, testament: 'OT' },
  { name: 'Daniel', chapters: 12, testament: 'OT' },
  { name: 'Hosea', chapters: 14, testament: 'OT' },
  { name: 'Joel', chapters: 3, testament: 'OT' },
  { name: 'Amos', chapters: 9, testament: 'OT' },
  { name: 'Obadiah', chapters: 1, testament: 'OT' },
  { name: 'Jonah', chapters: 4, testament: 'OT' },
  { name: 'Micah', chapters: 7, testament: 'OT' },
  { name: 'Nahum', chapters: 3, testament: 'OT' },
  { name: 'Habakkuk', chapters: 3, testament: 'OT' },
  { name: 'Zephaniah', chapters: 3, testament: 'OT' },
  { name: 'Haggai', chapters: 2, testament: 'OT' },
  { name: 'Zechariah', chapters: 14, testament: 'OT' },
  { name: 'Malachi', chapters: 4, testament: 'OT' },
  { name: 'Matthew', chapters: 28, testament: 'NT' },
  { name: 'Mark', chapters: 16, testament: 'NT' },
  { name: 'Luke', chapters: 24, testament: 'NT' },
  { name: 'John', chapters: 21, testament: 'NT' },
  { name: 'Acts', chapters: 28, testament: 'NT' },
  { name: 'Romans', chapters: 16, testament: 'NT' },
  { name: '1 Corinthians', chapters: 16, testament: 'NT' },
  { name: '2 Corinthians', chapters: 13, testament: 'NT' },
  { name: 'Galatians', chapters: 6, testament: 'NT' },
  { name: 'Ephesians', chapters: 6, testament: 'NT' },
  { name: 'Philippians', chapters: 4, testament: 'NT' },
  { name: 'Colossians', chapters: 4, testament: 'NT' },
  { name: '1 Thessalonians', chapters: 5, testament: 'NT' },
  { name: '2 Thessalonians', chapters: 3, testament: 'NT' },
  { name: '1 Timothy', chapters: 6, testament: 'NT' },
  { name: '2 Timothy', chapters: 4, testament: 'NT' },
  { name: 'Titus', chapters: 3, testament: 'NT' },
  { name: 'Philemon', chapters: 1, testament: 'NT' },
  { name: 'Hebrews', chapters: 13, testament: 'NT' },
  { name: 'James', chapters: 5, testament: 'NT' },
  { name: '1 Peter', chapters: 5, testament: 'NT' },
  { name: '2 Peter', chapters: 3, testament: 'NT' },
  { name: '1 John', chapters: 5, testament: 'NT' },
  { name: '2 John', chapters: 1, testament: 'NT' },
  { name: '3 John', chapters: 1, testament: 'NT' },
  { name: 'Jude', chapters: 1, testament: 'NT' },
  { name: 'Revelation', chapters: 22, testament: 'NT' }
];

const CATEGORIES = [
  { id: 'law_ot', name: 'Law / Pentateuch', testament: 'OT', books: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'], color: '#d97706', icon: Scale },
  { id: 'history_ot', name: 'Old Testament History', testament: 'OT', books: ['Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther'], color: '#10b981', icon: Scroll },
  { id: 'poetry_ot', name: 'Poetry & Wisdom', testament: 'OT', books: ['Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon'], color: '#8b5cf6', icon: Music },
  { id: 'major_prophets_ot', name: 'Major Prophets', testament: 'OT', books: ['Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel'], color: '#ef4444', icon: Flame },
  { id: 'minor_prophets_ot', name: 'Minor Prophets', testament: 'OT', books: ['Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'], color: '#f97316', icon: Volume2 },
  { id: 'gospels_nt', name: 'Gospels', testament: 'NT', books: ['Matthew', 'Mark', 'Luke', 'John'], color: '#06b6d4', icon: Sparkles },
  { id: 'history_nt', name: 'New Testament History', testament: 'NT', books: ['Acts'], color: '#3b82f6', icon: Globe },
  { id: 'pauls_epistles_nt', name: "Paul's Epistles", testament: 'NT', books: ['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon'], color: '#6366f1', icon: Mail },
  { id: 'general_epistles_nt', name: 'General Epistles', testament: 'NT', books: ['Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude'], color: '#ec4899', icon: Heart },
  { id: 'prophecy_nt', name: 'Prophecy', testament: 'NT', books: ['Revelation'], color: '#f43f5e', icon: Crown }
];

const getVerseCounts = (bookName) => {
  if (BIBLE_VERSE_COUNTS[bookName]) return BIBLE_VERSE_COUNTS[bookName];
  if (bookName === 'Psalms' && BIBLE_VERSE_COUNTS['Psalm']) return BIBLE_VERSE_COUNTS['Psalm'];
  if (bookName === 'Psalm' && BIBLE_VERSE_COUNTS['Psalms']) return BIBLE_VERSE_COUNTS['Psalms'];
  return null;
};

const BookRow = ({ book, progress = {}, color, icon: BookIcon }) => {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  
  // Calculate completed chapters based on ALL verses read
  const chapterKeys = Object.keys(progress);
  let fullyReadCount = 0;
  const counts = getVerseCounts(book.name) || [];
  chapterKeys.forEach(ch => {
    if (counts[ch - 1] !== undefined && progress[ch] >= counts[ch - 1]) {
      fullyReadCount++;
    }
  });

  const isCompleted = fullyReadCount === book.chapters;
  const percentage = Math.round((fullyReadCount / book.chapters) * 100);

  const themeColor = color || 'var(--primary)';
  const IconComponent = BookIcon || BookOpen;

  // Generate array [1, 2, 3... chapters]
  const chaptersArray = Array.from({ length: book.chapters }, (_, i) => i + 1);

  return (
    <div 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        marginBottom: '0.6rem',
        backgroundColor: 'var(--card-bg)',
        border: `1px solid ${isCompleted ? themeColor : (hovered ? themeColor : 'var(--border-color)')}`,
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered ? `0 4px 12px color-mix(in srgb, ${themeColor} 8%, transparent)` : 'none',
      }}
    >
      {/* Header Row */}
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', backgroundColor: isCompleted ? `color-mix(in srgb, ${themeColor} 8%, transparent)` : 'transparent',
          transition: 'background-color 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ 
            width: '32px', height: '32px', borderRadius: '8px', 
            backgroundColor: isCompleted ? themeColor : `color-mix(in srgb, ${themeColor} 12%, transparent)`,
            color: isCompleted ? '#fff' : themeColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isCompleted ? <CheckCircle2 size={16} /> : <IconComponent size={16} />}
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: '800', color: isCompleted ? themeColor : 'var(--text-main)' }}>
              {book.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>
              {fullyReadCount} / {book.chapters} Chapters
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Progress Bar (mini) */}
          <div style={{ width: '60px', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: themeColor, borderRadius: '3px' }} />
          </div>
          <ChevronDown 
            size={18} 
            color="var(--text-muted)" 
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      {/* Expanded Chapters Grid */}
      <div style={{
        maxHeight: expanded ? '600px' : '0px',
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out, padding 0.3s ease',
        padding: expanded ? '0 1rem 1rem' : '0 1rem',
        borderTop: expanded ? '1px solid var(--border-color)' : '1px solid transparent',
      }}>
        <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: '0.4rem' }}>
          {chaptersArray.map(ch => {
            const versesRead = progress[ch] || 0;
            const totalVerses = counts[ch - 1] || 0;
            const fillPct = totalVerses > 0 ? Math.min(100, Math.round((versesRead / totalVerses) * 100)) : 0;
            
            return (
              <div key={ch} style={{
                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700',
                background: fillPct > 0 
                  ? `linear-gradient(to top, ${themeColor} ${fillPct}%, color-mix(in srgb, var(--text-muted) 10%, transparent) ${fillPct}%)` 
                  : 'color-mix(in srgb, var(--text-muted) 10%, transparent)',
                color: fillPct >= 50 ? '#fff' : 'var(--text-muted)',
                transition: 'transform 0.1s',
              }}>
                {ch}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const CategoryGroup = ({ category, progress }) => {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isCompleted = category.completedBooks === category.totalBooks;
  const CategoryIcon = category.icon || BookOpen;

  return (
    <div 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        marginBottom: '0.8rem',
        backgroundColor: 'var(--card-bg)',
        border: `1px solid ${isCompleted ? category.color : (hovered ? category.color : 'var(--border-color)')}`,
        borderRadius: '14px',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? `0 6px 16px color-mix(in srgb, ${category.color} 12%, transparent)` : '0 2px 6px rgba(0,0,0,0.02)',
      }}
    >
      {/* Category Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '0.9rem 1.1rem',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          backgroundColor: isCompleted 
            ? (hovered ? `color-mix(in srgb, ${category.color} 10%, transparent)` : `color-mix(in srgb, ${category.color} 6%, transparent)`)
            : (hovered ? `color-mix(in srgb, ${category.color} 8%, transparent)` : 'transparent'),
          userSelect: 'none',
          transition: 'background-color 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              backgroundColor: isCompleted ? category.color : `color-mix(in srgb, ${category.color} 12%, transparent)`,
              color: isCompleted ? '#fff' : category.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '0.85rem',
              transition: 'all 0.2s',
            }}>
              {isCompleted ? <CheckCircle2 size={16} /> : <CategoryIcon size={16} />}
            </div>
            <div>
              <div style={{
                fontSize: '0.95rem',
                fontWeight: '800',
                color: isCompleted ? category.color : 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}>
                {category.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', marginTop: '0.1rem' }}>
                {category.completedBooks} / {category.totalBooks} Books Completed ({category.readChapters} / {category.totalChapters} Ch.)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: '800',
              color: isCompleted ? category.color : 'var(--text-muted)',
              backgroundColor: `color-mix(in srgb, ${category.color} 8%, transparent)`,
              padding: '0.2rem 0.45rem',
              borderRadius: '6px',
            }}>
              {category.percentage}%
            </div>
            <ChevronDown 
              size={18} 
              color="var(--text-muted)" 
              style={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
        </div>

        {/* Category Progress Bar */}
        <div style={{
          height: '5px',
          backgroundColor: `color-mix(in srgb, ${category.color} 15%, transparent)`,
          borderRadius: '3px',
          overflow: 'hidden',
          marginTop: '0.2rem',
        }}>
          <div style={{
            width: `${category.percentage}%`,
            height: '100%',
            backgroundColor: category.color,
            borderRadius: '3px',
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </div>
      </div>

      {/* Books List Collapsible Section */}
      <div style={{
        maxHeight: expanded ? '2000px' : '0px',
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease-out, padding 0.35s ease',
        padding: expanded ? '0.6rem 0.9rem 0.2rem' : '0 0.9rem',
        borderTop: expanded ? '1px solid var(--border-color)' : '1px solid transparent',
        backgroundColor: 'color-mix(in srgb, var(--bg-color) 40%, transparent)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {category.booksList.map(book => (
          <BookRow 
            key={book.name} 
            book={book} 
            progress={progress[book.name] || {}} 
            color={category.color}
            icon={category.icon}
          />
        ))}
      </div>
    </div>
  );
};

const BibleTracker = ({ targetMemberId }) => {
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, OT, NT

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const data = await devotionals.getBibleProgress(targetMemberId);
        setProgress(data || {});
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, [targetMemberId]);

  const totalChapters = 1189;
  const readChaptersCount = useMemo(() => {
    let count = 0;
    Object.keys(progress).forEach(bookName => {
      const bookProgress = progress[bookName];
      const counts = getVerseCounts(bookName);
      if (!counts) return;
      Object.keys(bookProgress).forEach(ch => {
        if (bookProgress[ch] >= counts[ch - 1]) count++;
      });
    });
    return count;
  }, [progress]);

  const overallPercentage = Math.round((readChaptersCount / totalChapters) * 100);

  const filteredCategories = useMemo(() => {
    const activeCats = CATEGORIES.filter(cat => {
      if (filter === 'OT') return cat.testament === 'OT';
      if (filter === 'NT') return cat.testament === 'NT';
      return true;
    });

    return activeCats.map(cat => {
      const catBooks = cat.books.map(bookName => BIBLE_DATA.find(b => b.name === bookName)).filter(Boolean);

      let totalCategoryChapters = 0;
      let readCategoryChapters = 0;
      let completedBooksCount = 0;

      const booksWithProgress = catBooks.map(book => {
        const bookProg = progress[book.name] || {};
        const chapterKeys = Object.keys(bookProg);
        let fullyReadCount = 0;
        
        chapterKeys.forEach(ch => {
          const counts = getVerseCounts(book.name);
          if (counts && counts[ch - 1] !== undefined && bookProg[ch] >= counts[ch - 1]) {
            fullyReadCount++;
          }
        });

        totalCategoryChapters += book.chapters;
        readCategoryChapters += fullyReadCount;
        if (fullyReadCount === book.chapters) {
          completedBooksCount++;
        }

        return {
          ...book,
          fullyReadCount,
          isCompleted: fullyReadCount === book.chapters,
        };
      });

      const percentage = totalCategoryChapters > 0
        ? Math.round((readCategoryChapters / totalCategoryChapters) * 100)
        : 0;

      return {
        ...cat,
        booksList: booksWithProgress,
        totalChapters: totalCategoryChapters,
        readChapters: readCategoryChapters,
        completedBooks: completedBooksCount,
        totalBooks: catBooks.length,
        percentage
      };
    });
  }, [filter, progress]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading Bible tracker...</div>;
  }

  return (
    <div style={{ paddingBottom: '1rem' }}>
      {/* Overall Progress Card */}
      <div style={{
        marginBottom: '1rem', padding: '1.25rem', borderRadius: '16px',
        background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 60%, #000))',
        color: '#fff', boxShadow: '0 4px 15px color-mix(in srgb, var(--primary) 30%, transparent)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(255,255,255,0.8)' }}>
              Bible Reading Progress
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '900', lineHeight: 1, marginTop: '0.2rem' }}>
              {overallPercentage}%
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <BookOpen size={24} style={{ opacity: 0.8, marginBottom: '0.25rem' }} />
            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>
              {readChaptersCount} / {totalChapters} Ch.
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${overallPercentage}%`, height: '100%', backgroundColor: '#fff', borderRadius: '4px' }} />
        </div>
      </div>

      {/* Testament Filter Pills */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
        {['ALL', 'OT', 'NT'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1, padding: '0.5rem', borderRadius: '10px', border: 'none',
              fontSize: '0.75rem', fontWeight: '800', fontFamily: 'inherit', cursor: 'pointer',
              backgroundColor: filter === f ? 'var(--text-main)' : 'color-mix(in srgb, var(--text-muted) 10%, transparent)',
              color: filter === f ? 'var(--bg-color)' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            {f === 'ALL' ? 'Entire Bible' : f === 'OT' ? 'Old Testament' : 'New Testament'}
          </button>
        ))}
      </div>

      {/* Books List */}
      <div>
        {filteredCategories.map(category => (
          <CategoryGroup key={category.id} category={category} progress={progress} />
        ))}
      </div>
    </div>
  );
};

export default BibleTracker;
