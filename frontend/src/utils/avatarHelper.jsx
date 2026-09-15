

// ── Preset avatar catalog ──
// Flat-vector animal faces on pastel gradient discs. Every entry owns its id, display
// name and artwork. The ids preset-1 … preset-20 are stable, so avatars already saved
// on user records keep resolving (their artwork simply changes with the set).
const PRESET_DEFS = [
  {
    id: 'preset-1',
    name: 'Tabby Cat',
    gradient: (
      <linearGradient id="pa-grad-preset-1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A8E6CF" />
        <stop offset="100%" stopColor="#48B89F" />
      </linearGradient>
    ),
    art: (
      <>
        <path d="M28,42 L30,18 L47,31 Z" fill="#F2A25C" />
        <path d="M72,42 L70,18 L53,31 Z" fill="#F2A25C" />
        <path d="M32,38 L33,26 L42,33 Z" fill="#F7BFB2" />
        <path d="M68,38 L67,26 L58,33 Z" fill="#F7BFB2" />
        <ellipse cx="50" cy="53" rx="24" ry="21" fill="#F2A25C" />
        <path d="M44,36 v6 M50,34 v7 M56,36 v6" stroke="#C9773A" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <ellipse cx="50" cy="61" rx="13" ry="9" fill="#FFF3E2" />
        <ellipse cx="41" cy="51" rx="3.6" ry="4.4" fill="#3B2A20" />
        <ellipse cx="59" cy="51" rx="3.6" ry="4.4" fill="#3B2A20" />
        <circle cx="42.2" cy="49.6" r="1.2" fill="#ffffff" />
        <circle cx="60.2" cy="49.6" r="1.2" fill="#ffffff" />
        <path d="M50,56 l-3.4,2.8 h6.8 Z" fill="#E0796B" />
        <path d="M50,59 v2.6 M50,61.6 q-3.6,3 -6.6,0 M50,61.6 q3.6,3 6.6,0" stroke="#3B2A20" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <path d="M26,57 h10 M26,63 h10 M74,57 h-10 M74,63 h-10" stroke="#ffffff" strokeWidth="1.2" opacity="0.8" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-2',
    name: 'Puppy Pal',
    gradient: (
      <linearGradient id="pa-grad-preset-2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A9C7FF" />
        <stop offset="100%" stopColor="#5B7FE0" />
      </linearGradient>
    ),
    art: (
      <>
        <ellipse cx="26" cy="49" rx="8.5" ry="16" fill="#A8703F" transform="rotate(-12 26 49)" />
        <ellipse cx="74" cy="49" rx="8.5" ry="16" fill="#A8703F" transform="rotate(12 74 49)" />
        <ellipse cx="50" cy="52" rx="23" ry="20" fill="#D9A066" />
        <ellipse cx="50" cy="62" rx="14" ry="10" fill="#F6E2C6" />
        <ellipse cx="41" cy="47" rx="3.6" ry="4" fill="#3B2A20" />
        <ellipse cx="59" cy="47" rx="3.6" ry="4" fill="#3B2A20" />
        <circle cx="42.2" cy="45.7" r="1.2" fill="#ffffff" />
        <circle cx="60.2" cy="45.7" r="1.2" fill="#ffffff" />
        <ellipse cx="50" cy="58" rx="5" ry="4" fill="#3B2A20" />
        <path d="M50,62 v2.5 M50,64.5 q-4,3.4 -7,0 M50,64.5 q4,3.4 7,0" stroke="#3B2A20" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M47,68 q3,7 6,0 Z" fill="#EE8899" />
      </>
    )
  },
  {
    id: 'preset-3',
    name: 'Clever Fox',
    gradient: (
      <linearGradient id="pa-grad-preset-3" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#BEE3FF" />
        <stop offset="100%" stopColor="#5FA8DC" />
      </linearGradient>
    ),
    art: (
      <>
        <path d="M27,44 L25,13 L49,31 Z" fill="#E8703A" />
        <path d="M73,44 L75,13 L51,31 Z" fill="#E8703A" />
        <path d="M31,40 L30,22 L44,32 Z" fill="#3B2A26" />
        <path d="M69,40 L70,22 L56,32 Z" fill="#3B2A26" />
        <path d="M27,42 Q50,30 73,42 Q69,64 50,80 Q31,64 27,42 Z" fill="#E8703A" />
        <path d="M50,80 Q38,67 36,55 Q50,50 64,55 Q62,67 50,80 Z" fill="#FFF6EF" />
        <ellipse cx="40" cy="50" rx="3.4" ry="4" fill="#3B2A26" />
        <ellipse cx="60" cy="50" rx="3.4" ry="4" fill="#3B2A26" />
        <circle cx="41.1" cy="48.7" r="1.1" fill="#ffffff" />
        <circle cx="61.1" cy="48.7" r="1.1" fill="#ffffff" />
        <ellipse cx="50" cy="67" rx="3.8" ry="3" fill="#3B2A26" />
        <path d="M50,70 v2.5" stroke="#3B2A26" strokeWidth="1.4" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-4',
    name: 'Brown Bear',
    gradient: (
      <linearGradient id="pa-grad-preset-4" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C6EFB4" />
        <stop offset="100%" stopColor="#5FAF6D" />
      </linearGradient>
    ),
    art: (
      <>
        <circle cx="28" cy="29" r="10.5" fill="#8B5E3C" />
        <circle cx="72" cy="29" r="10.5" fill="#8B5E3C" />
        <circle cx="28" cy="29" r="5.5" fill="#C68B5E" />
        <circle cx="72" cy="29" r="5.5" fill="#C68B5E" />
        <ellipse cx="50" cy="54" rx="24" ry="21" fill="#8B5E3C" />
        <ellipse cx="50" cy="64" rx="13.5" ry="10" fill="#E3C39A" />
        <ellipse cx="41" cy="49" rx="3.4" ry="4" fill="#3A2A1E" />
        <ellipse cx="59" cy="49" rx="3.4" ry="4" fill="#3A2A1E" />
        <circle cx="42.1" cy="47.7" r="1.2" fill="#ffffff" />
        <circle cx="60.1" cy="47.7" r="1.2" fill="#ffffff" />
        <ellipse cx="50" cy="60" rx="4.6" ry="3.4" fill="#3A2A1E" />
        <path d="M50,63.5 v2.5 M50,66 q-4,3.2 -7,0 M50,66 q4,3.2 7,0" stroke="#3A2A1E" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-5',
    name: 'Panda Bear',
    gradient: (
      <linearGradient id="pa-grad-preset-5" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C9D4FE" />
        <stop offset="100%" stopColor="#7C86EA" />
      </linearGradient>
    ),
    art: (
      <>
        <circle cx="27" cy="28" r="10.5" fill="#23252B" />
        <circle cx="73" cy="28" r="10.5" fill="#23252B" />
        <ellipse cx="50" cy="54" rx="25" ry="22" fill="#FFFFFF" />
        <ellipse cx="39" cy="50" rx="8" ry="10" fill="#23252B" transform="rotate(-18 39 50)" />
        <ellipse cx="61" cy="50" rx="8" ry="10" fill="#23252B" transform="rotate(18 61 50)" />
        <circle cx="39" cy="50" r="3.4" fill="#FFFFFF" />
        <circle cx="61" cy="50" r="3.4" fill="#FFFFFF" />
        <circle cx="39" cy="50.4" r="1.8" fill="#23252B" />
        <circle cx="61" cy="50.4" r="1.8" fill="#23252B" />
        <ellipse cx="50" cy="62" rx="4.4" ry="3.2" fill="#23252B" />
        <path d="M50,65.5 v2.5 M50,68 q-4,3.2 -7,0 M50,68 q4,3.2 7,0" stroke="#23252B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-6',
    name: 'Lion Heart',
    gradient: (
      <linearGradient id="pa-grad-preset-6" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#9EC7FB" />
        <stop offset="100%" stopColor="#3B6FD4" />
      </linearGradient>
    ),
    art: (
      <>
        <circle cx="31" cy="37" r="7" fill="#E8A44E" />
        <circle cx="69" cy="37" r="7" fill="#E8A44E" />
        <g fill="#A65B27">
          <circle cx="50" cy="20" r="8" />
          <circle cx="71" cy="29" r="8" />
          <circle cx="80" cy="50" r="8" />
          <circle cx="71" cy="71" r="8" />
          <circle cx="50" cy="80" r="8" />
          <circle cx="29" cy="71" r="8" />
          <circle cx="20" cy="50" r="8" />
          <circle cx="29" cy="29" r="8" />
        </g>
        <circle cx="50" cy="50" r="28" fill="#C8752B" />
        <circle cx="50" cy="51" r="21" fill="#F0B860" />
        <ellipse cx="44" cy="60" rx="8" ry="6" fill="#FFF0D6" />
        <ellipse cx="56" cy="60" rx="8" ry="6" fill="#FFF0D6" />
        <ellipse cx="43" cy="47" rx="3.2" ry="3.8" fill="#4A3020" />
        <ellipse cx="57" cy="47" rx="3.2" ry="3.8" fill="#4A3020" />
        <circle cx="44.1" cy="45.8" r="1.1" fill="#ffffff" />
        <circle cx="58.1" cy="45.8" r="1.1" fill="#ffffff" />
        <path d="M50,53 l-4,3.4 h8 Z" fill="#8A4B2A" />
        <path d="M50,56.4 v3" stroke="#8A4B2A" strokeWidth="1.5" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-7',
    name: 'Tiger Cub',
    gradient: (
      <linearGradient id="pa-grad-preset-7" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A9F0CE" />
        <stop offset="100%" stopColor="#2FA97C" />
      </linearGradient>
    ),
    art: (
      <>
        <circle cx="29" cy="33" r="9.5" fill="#E8873A" />
        <circle cx="71" cy="33" r="9.5" fill="#E8873A" />
        <circle cx="29" cy="33" r="5" fill="#F8CBA8" />
        <circle cx="71" cy="33" r="5" fill="#F8CBA8" />
        <ellipse cx="50" cy="54" rx="24" ry="21" fill="#E8873A" />
        <path d="M44,36 v7 M50,34 v8 M56,36 v7" stroke="#2E2A28" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M28,48 h8 M28,57 h8 M72,48 h-8 M72,57 h-8" stroke="#2E2A28" strokeWidth="3" strokeLinecap="round" fill="none" />
        <ellipse cx="50" cy="63" rx="13" ry="9" fill="#FFF3E4" />
        <ellipse cx="41" cy="51" rx="3.4" ry="4" fill="#2E2A28" />
        <ellipse cx="59" cy="51" rx="3.4" ry="4" fill="#2E2A28" />
        <circle cx="42.1" cy="49.7" r="1.2" fill="#ffffff" />
        <circle cx="60.1" cy="49.7" r="1.2" fill="#ffffff" />
        <path d="M50,58 l-3.4,2.8 h6.8 Z" fill="#D06B5B" />
        <path d="M50,61 v2.4 M50,63.4 q-3.6,3 -6.6,0 M50,63.4 q3.6,3 6.6,0" stroke="#2E2A28" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-8',
    name: 'Bunny Hop',
    gradient: (
      <linearGradient id="pa-grad-preset-8" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FBD0E6" />
        <stop offset="100%" stopColor="#EC6FA9" />
      </linearGradient>
    ),
    art: (
      <>
        <ellipse cx="39" cy="26" rx="7" ry="18" fill="#F4F4F7" transform="rotate(-8 39 26)" />
        <ellipse cx="61" cy="26" rx="7" ry="18" fill="#F4F4F7" transform="rotate(8 61 26)" />
        <ellipse cx="39" cy="27" rx="3.4" ry="12" fill="#F8BFCE" transform="rotate(-8 39 27)" />
        <ellipse cx="61" cy="27" rx="3.4" ry="12" fill="#F8BFCE" transform="rotate(8 61 27)" />
        <ellipse cx="50" cy="59" rx="21" ry="18" fill="#F4F4F7" />
        <circle cx="36" cy="63" r="5" fill="#F8BFCE" opacity="0.7" />
        <circle cx="64" cy="63" r="5" fill="#F8BFCE" opacity="0.7" />
        <ellipse cx="42" cy="56" rx="3.2" ry="3.8" fill="#3B2A30" />
        <ellipse cx="58" cy="56" rx="3.2" ry="3.8" fill="#3B2A30" />
        <circle cx="43.1" cy="54.8" r="1.1" fill="#ffffff" />
        <circle cx="59.1" cy="54.8" r="1.1" fill="#ffffff" />
        <path d="M50,62 l-2.8,2.4 h5.6 Z" fill="#EF8AA0" />
        <path d="M50,64.4 v2.2 M50,66.6 q-3.2,2.8 -5.8,0 M50,66.6 q3.2,2.8 5.8,0" stroke="#3B2A30" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-9',
    name: 'Sleepy Koala',
    gradient: (
      <linearGradient id="pa-grad-preset-9" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#DED5FD" />
        <stop offset="100%" stopColor="#9174E8" />
      </linearGradient>
    ),
    art: (
      <>
        <circle cx="24" cy="43" r="13.5" fill="#9AA5AE" />
        <circle cx="76" cy="43" r="13.5" fill="#9AA5AE" />
        <circle cx="24" cy="43" r="8" fill="#CBD4DA" />
        <circle cx="76" cy="43" r="8" fill="#CBD4DA" />
        <ellipse cx="50" cy="52" rx="22" ry="20" fill="#9AA5AE" />
        <ellipse cx="50" cy="60" rx="8" ry="10" fill="#3B3B44" />
        <ellipse cx="47.6" cy="56" rx="2.4" ry="3" fill="#ffffff" opacity="0.3" />
        <ellipse cx="38" cy="47" rx="3.2" ry="3.8" fill="#2F2F38" />
        <ellipse cx="62" cy="47" rx="3.2" ry="3.8" fill="#2F2F38" />
        <circle cx="39.1" cy="45.8" r="1.1" fill="#ffffff" />
        <circle cx="63.1" cy="45.8" r="1.1" fill="#ffffff" />
        <path d="M43,71 q7,4 14,0" stroke="#3B3B44" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-10',
    name: 'Cheeky Monkey',
    gradient: (
      <linearGradient id="pa-grad-preset-10" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#BEE7FD" />
        <stop offset="100%" stopColor="#2FA8E0" />
      </linearGradient>
    ),
    art: (
      <>
        <circle cx="23" cy="50" r="10" fill="#A9713F" />
        <circle cx="77" cy="50" r="10" fill="#A9713F" />
        <circle cx="23" cy="50" r="5.5" fill="#E0AC7E" />
        <circle cx="77" cy="50" r="5.5" fill="#E0AC7E" />
        <circle cx="50" cy="51" r="22" fill="#A9713F" />
        <path d="M50,33 Q66,37 66,53 Q66,71 50,73 Q34,71 34,53 Q34,37 50,33 Z" fill="#F2CDA0" />
        <ellipse cx="43" cy="50" rx="3.2" ry="3.8" fill="#4A3020" />
        <ellipse cx="57" cy="50" rx="3.2" ry="3.8" fill="#4A3020" />
        <circle cx="44.1" cy="48.8" r="1.1" fill="#ffffff" />
        <circle cx="58.1" cy="48.8" r="1.1" fill="#ffffff" />
        <circle cx="46.6" cy="60" r="1.5" fill="#8A5A32" />
        <circle cx="53.4" cy="60" r="1.5" fill="#8A5A32" />
        <path d="M43,65 q7,5.5 14,0" stroke="#8A5A32" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-11',
    name: 'Night Owl',
    gradient: (
      <linearGradient id="pa-grad-preset-11" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4C3FA8" />
        <stop offset="100%" stopColor="#1E1B4B" />
      </linearGradient>
    ),
    art: (
      <>
        <path d="M28,32 L33,18 L43,29 Z" fill="#8B6A4F" />
        <path d="M72,32 L67,18 L57,29 Z" fill="#8B6A4F" />
        <path d="M50,24 C68,24 76,38 76,53 C76,69 64,81 50,81 C36,81 24,69 24,53 C24,38 32,24 50,24 Z" fill="#8B6A4F" />
        <ellipse cx="50" cy="71" rx="12.5" ry="9" fill="#F0DFC7" opacity="0.9" />
        <circle cx="39" cy="47" r="11.5" fill="#F5E7D3" />
        <circle cx="61" cy="47" r="11.5" fill="#F5E7D3" />
        <circle cx="39" cy="47" r="5.4" fill="#23252B" />
        <circle cx="61" cy="47" r="5.4" fill="#23252B" />
        <circle cx="40.8" cy="45.2" r="1.9" fill="#ffffff" />
        <circle cx="62.8" cy="45.2" r="1.9" fill="#ffffff" />
        <path d="M50,53 l-4.6,7.5 h9.2 Z" fill="#F0A93B" />
      </>
    )
  },
  {
    id: 'preset-12',
    name: 'Penguin Pal',
    gradient: (
      <linearGradient id="pa-grad-preset-12" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#BFE7FD" />
        <stop offset="100%" stopColor="#1B8FCB" />
      </linearGradient>
    ),
    art: (
      <>
        <ellipse cx="40" cy="81" rx="7" ry="3.4" fill="#F5A524" />
        <ellipse cx="60" cy="81" rx="7" ry="3.4" fill="#F5A524" />
        <ellipse cx="50" cy="53" rx="26" ry="28" fill="#2B2F38" />
        <ellipse cx="50" cy="60" rx="17" ry="21" fill="#FFFFFF" />
        <ellipse cx="50" cy="43" rx="14.5" ry="12.5" fill="#FFFFFF" />
        <circle cx="44" cy="43" r="3" fill="#2B2F38" />
        <circle cx="56" cy="43" r="3" fill="#2B2F38" />
        <circle cx="45" cy="41.9" r="1.1" fill="#ffffff" />
        <circle cx="57" cy="41.9" r="1.1" fill="#ffffff" />
        <path d="M43.5,50 h13 L50,58 Z" fill="#F5A524" />
      </>
    )
  },
  {
    id: 'preset-13',
    name: 'Happy Frog',
    gradient: (
      <linearGradient id="pa-grad-preset-13" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE9A0" />
        <stop offset="100%" stopColor="#F0B429" />
      </linearGradient>
    ),
    art: (
      <>
        <circle cx="32" cy="34" r="12.5" fill="#5BAE4A" />
        <circle cx="68" cy="34" r="12.5" fill="#5BAE4A" />
        <ellipse cx="50" cy="57" rx="27" ry="23" fill="#5BAE4A" />
        <ellipse cx="50" cy="68" rx="17" ry="10" fill="#C5E8AE" opacity="0.65" />
        <circle cx="32" cy="33" r="7" fill="#FFFFFF" />
        <circle cx="68" cy="33" r="7" fill="#FFFFFF" />
        <circle cx="32" cy="33.6" r="3.4" fill="#23252B" />
        <circle cx="68" cy="33.6" r="3.4" fill="#23252B" />
        <circle cx="33.2" cy="32.2" r="1.2" fill="#ffffff" />
        <circle cx="69.2" cy="32.2" r="1.2" fill="#ffffff" />
        <circle cx="45" cy="51" r="1.6" fill="#2F7A2A" />
        <circle cx="55" cy="51" r="1.6" fill="#2F7A2A" />
        <path d="M33,58 q17,14 34,0" stroke="#2F7A2A" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-14',
    name: 'Gentle Deer',
    gradient: (
      <linearGradient id="pa-grad-preset-14" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#DFF5B0" />
        <stop offset="100%" stopColor="#7FB53F" />
      </linearGradient>
    ),
    art: (
      <>
        <path d="M37,32 L31,15 M37,32 L21,22 M31,15 L26,9 M63,32 L69,15 M63,32 L79,22 M69,15 L74,9" stroke="#8B5E3C" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <ellipse cx="26" cy="46" rx="8.5" ry="5.5" fill="#C08A5E" transform="rotate(-25 26 46)" />
        <ellipse cx="74" cy="46" rx="8.5" ry="5.5" fill="#C08A5E" transform="rotate(25 74 46)" />
        <ellipse cx="50" cy="57" rx="20" ry="21" fill="#D19A63" />
        <circle cx="40" cy="42" r="2" fill="#F5DEC4" opacity="0.75" />
        <circle cx="60" cy="43" r="1.7" fill="#F5DEC4" opacity="0.75" />
        <circle cx="50" cy="38" r="1.6" fill="#F5DEC4" opacity="0.75" />
        <ellipse cx="50" cy="69" rx="11" ry="8" fill="#F5DEC4" />
        <ellipse cx="42" cy="53" rx="3.2" ry="3.8" fill="#4A3728" />
        <ellipse cx="58" cy="53" rx="3.2" ry="3.8" fill="#4A3728" />
        <circle cx="43.1" cy="51.8" r="1.1" fill="#ffffff" />
        <circle cx="59.1" cy="51.8" r="1.1" fill="#ffffff" />
        <ellipse cx="50" cy="66" rx="4" ry="3" fill="#4A3728" />
        <path d="M50,69 v2" stroke="#4A3728" strokeWidth="1.3" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-15',
    name: 'Grey Wolf',
    gradient: (
      <linearGradient id="pa-grad-preset-15" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#D7DEFB" />
        <stop offset="100%" stopColor="#5B60D6" />
      </linearGradient>
    ),
    art: (
      <>
        <path d="M27,42 L26,15 L46,30 Z" fill="#7A8794" />
        <path d="M73,42 L74,15 L54,30 Z" fill="#7A8794" />
        <path d="M31,38 L30,22 L42,31 Z" fill="#4A535D" />
        <path d="M69,38 L70,22 L58,31 Z" fill="#4A535D" />
        <path d="M28,42 Q50,32 72,42 Q70,64 50,80 Q30,64 28,42 Z" fill="#7A8794" />
        <path d="M50,80 Q39,68 38,56 Q50,52 62,56 Q61,68 50,80 Z" fill="#DCE3E9" />
        <ellipse cx="41" cy="50" rx="3.4" ry="3.8" fill="#E9A93C" />
        <ellipse cx="59" cy="50" rx="3.4" ry="3.8" fill="#E9A93C" />
        <circle cx="41" cy="50.2" r="1.7" fill="#2B2F38" />
        <circle cx="59" cy="50.2" r="1.7" fill="#2B2F38" />
        <ellipse cx="50" cy="68" rx="4.2" ry="3.2" fill="#2B2F38" />
        <path d="M50,71.2 v2.4" stroke="#2B2F38" strokeWidth="1.4" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-16',
    name: 'Little Pig',
    gradient: (
      <linearGradient id="pa-grad-preset-16" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C3F5D3" />
        <stop offset="100%" stopColor="#3FB86E" />
      </linearGradient>
    ),
    art: (
      <>
        <path d="M31,36 L26,18 L45,29 Z" fill="#EE9AB0" />
        <path d="M69,36 L74,18 L55,29 Z" fill="#EE9AB0" />
        <ellipse cx="50" cy="54" rx="24" ry="21" fill="#F7B8C8" />
        <circle cx="34" cy="60" r="5" fill="#EE9AB0" opacity="0.7" />
        <circle cx="66" cy="60" r="5" fill="#EE9AB0" opacity="0.7" />
        <ellipse cx="41" cy="48" rx="3.2" ry="3.8" fill="#5A3540" />
        <ellipse cx="59" cy="48" rx="3.2" ry="3.8" fill="#5A3540" />
        <circle cx="42.1" cy="46.8" r="1.1" fill="#ffffff" />
        <circle cx="60.1" cy="46.8" r="1.1" fill="#ffffff" />
        <ellipse cx="50" cy="63" rx="12" ry="9" fill="#EE9AB0" />
        <ellipse cx="45.6" cy="63" rx="2.2" ry="3.2" fill="#C96C86" />
        <ellipse cx="54.4" cy="63" rx="2.2" ry="3.2" fill="#C96C86" />
      </>
    )
  },
  {
    id: 'preset-17',
    name: 'Dairy Cow',
    gradient: (
      <linearGradient id="pa-grad-preset-17" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#B8F0F7" />
        <stop offset="100%" stopColor="#22A9C4" />
      </linearGradient>
    ),
    art: (
      <>
        <ellipse cx="23" cy="45" rx="9.5" ry="6" fill="#E9E9EF" transform="rotate(-20 23 45)" />
        <ellipse cx="77" cy="45" rx="9.5" ry="6" fill="#E9E9EF" transform="rotate(20 77 45)" />
        <ellipse cx="50" cy="53" rx="24" ry="22" fill="#F4F4F7" />
        <path d="M27,46 Q32,29 47,33 Q43,46 33,52 Z" fill="#3A3A44" />
        <ellipse cx="66" cy="40" rx="9.5" ry="7.5" fill="#3A3A44" transform="rotate(22 66 40)" />
        <ellipse cx="41" cy="50" rx="3.2" ry="3.8" fill="#3A3A44" />
        <ellipse cx="59" cy="50" rx="3.2" ry="3.8" fill="#3A3A44" />
        <circle cx="42.1" cy="48.8" r="1.1" fill="#ffffff" />
        <circle cx="60.1" cy="48.8" r="1.1" fill="#ffffff" />
        <ellipse cx="50" cy="65" rx="14" ry="10" fill="#F7B8C8" />
        <ellipse cx="45" cy="64" rx="2.2" ry="3" fill="#D4788E" />
        <ellipse cx="55" cy="64" rx="2.2" ry="3" fill="#D4788E" />
        <path d="M44,70 q6,3.4 12,0" stroke="#D4788E" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </>
    )
  },
  {
    id: 'preset-18',
    name: 'Gentle Elephant',
    gradient: (
      <linearGradient id="pa-grad-preset-18" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FED2DA" />
        <stop offset="100%" stopColor="#EE6C86" />
      </linearGradient>
    ),
    art: (
      <>
        <circle cx="24" cy="50" r="16" fill="#94A3B8" />
        <circle cx="76" cy="50" r="16" fill="#94A3B8" />
        <circle cx="24" cy="50" r="10" fill="#B9C5D3" />
        <circle cx="76" cy="50" r="10" fill="#B9C5D3" />
        <ellipse cx="50" cy="50" rx="21" ry="20" fill="#A7B4C4" />
        <path d="M50,58 C50,72 45,78 47,84 C48,88 54,88 56,83" stroke="#A7B4C4" strokeWidth="9.5" fill="none" strokeLinecap="round" />
        <path d="M42,67 q-3.5,5 -5.5,8.5" stroke="#F7F7FA" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M58,67 q3.5,5 5.5,8.5" stroke="#F7F7FA" strokeWidth="4" strokeLinecap="round" fill="none" />
        <ellipse cx="41" cy="47" rx="3.2" ry="3.8" fill="#3B4250" />
        <ellipse cx="59" cy="47" rx="3.2" ry="3.8" fill="#3B4250" />
        <circle cx="42.1" cy="45.8" r="1.1" fill="#ffffff" />
        <circle cx="60.1" cy="45.8" r="1.1" fill="#ffffff" />
      </>
    )
  },
  {
    id: 'preset-19',
    name: 'Fluffy Sheep',
    gradient: (
      <linearGradient id="pa-grad-preset-19" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C4DDFE" />
        <stop offset="100%" stopColor="#4A8BE8" />
      </linearGradient>
    ),
    art: (
      <>
        <g fill="#F8F8FB">
          <circle cx="34" cy="38" r="12.5" />
          <circle cx="50" cy="31" r="13.5" />
          <circle cx="66" cy="38" r="12.5" />
          <circle cx="28" cy="53" r="11.5" />
          <circle cx="72" cy="53" r="11.5" />
          <circle cx="50" cy="47" r="15" />
        </g>
        <ellipse cx="32" cy="59" rx="7.5" ry="4.8" fill="#3F3F52" transform="rotate(-22 32 59)" />
        <ellipse cx="68" cy="59" rx="7.5" ry="4.8" fill="#3F3F52" transform="rotate(22 68 59)" />
        <ellipse cx="50" cy="62" rx="14.5" ry="15" fill="#3F3F52" />
        <circle cx="44.5" cy="59" r="2.8" fill="#FFFFFF" />
        <circle cx="55.5" cy="59" r="2.8" fill="#FFFFFF" />
        <circle cx="44.5" cy="59.4" r="1.4" fill="#23252B" />
        <circle cx="55.5" cy="59.4" r="1.4" fill="#23252B" />
        <path d="M45,69 q5,3.4 10,0" stroke="#FFFFFF" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.8" />
      </>
    )
  },
  {
    id: 'preset-20',
    name: 'Masked Raccoon',
    gradient: (
      <linearGradient id="pa-grad-preset-20" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDF0A6" />
        <stop offset="100%" stopColor="#E8B92C" />
      </linearGradient>
    ),
    art: (
      <>
        <circle cx="28" cy="32" r="9.5" fill="#8A93A0" />
        <circle cx="72" cy="32" r="9.5" fill="#8A93A0" />
        <circle cx="28" cy="32" r="5" fill="#C7CCD4" />
        <circle cx="72" cy="32" r="5" fill="#C7CCD4" />
        <ellipse cx="50" cy="54" rx="24" ry="21" fill="#9AA3AF" />
        <path d="M50,42 Q42,36 33,40 Q26,45 29,53 Q34,60 42,56 Q48,52 50,48 Q52,52 58,56 Q66,60 71,53 Q74,45 67,40 Q58,36 50,42 Z" fill="#3A3F4A" />
        <circle cx="39" cy="49" r="3.6" fill="#FFFFFF" />
        <circle cx="61" cy="49" r="3.6" fill="#FFFFFF" />
        <circle cx="39" cy="49.4" r="1.9" fill="#23252B" />
        <circle cx="61" cy="49.4" r="1.9" fill="#23252B" />
        <ellipse cx="50" cy="65" rx="11" ry="8" fill="#F2F2F5" />
        <ellipse cx="50" cy="61.5" rx="3.8" ry="2.9" fill="#2B2F38" />
        <path d="M50,64.4 v2.2 M50,66.6 q-3.4,2.8 -6,0 M50,66.6 q3.4,2.8 6,0" stroke="#2B2F38" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </>
    )
  }
];

// ── Public catalog exports ──
export const PRESET_META = PRESET_DEFS.map(({ id, name }) => ({ id, name }));
export const PRESETS = PRESET_DEFS.map((preset) => preset.id);
export const getPresetName = (presetId) =>
  PRESET_DEFS.find((preset) => preset.id === presetId)?.name || 'Preset Avatar';

// ── Render the custom vector SVG preset avatar inline ──
export const renderPresetSvg = (presetId, size = 32, style = {}) => {
  const def = PRESET_DEFS.find((preset) => preset.id === presetId);
  if (!def) return null;

  const finalStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    display: 'block',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    ...style
  };

  const clipId = `pa-clip-${def.id}`;

  return (
    <svg viewBox="0 0 100 100" style={finalStyle} role="img" aria-label={def.name}>
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
        {def.gradient}
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#pa-grad-${def.id})`} />
      <g clipPath={`url(#${clipId})`}>{def.art}</g>
    </svg>
  );
};

// ── Unified rendering utility for Avatars ──
export const renderAvatarHelper = (user, size = 32, style = {}) => {
  const name = user?.displayName || user?.email || '?';
  const initial = name.charAt(0).toUpperCase();

  if (user?.profilePicture) {
    // If it's one of the vector presets, render natively
    if (PRESETS.includes(user.profilePicture)) {
      return renderPresetSvg(user.profilePicture, size, style);
    }

    // Otherwise render custom uploaded image
    return (
      <img
        src={user.profilePicture}
        alt={name}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid var(--primary)',
          boxShadow: '0 0 10px rgba(var(--primary-rgb), 0.2)',
          transition: 'all 0.3s ease',
          display: 'block',
          ...style
        }}
        className="navbar-avatar"
      />
    );
  }

  // Fallback to beautiful gradient initials circle
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: `${size * 0.45}px`,
        border: '2px solid var(--border-color)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        textShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease',
        ...style
      }}
      className="navbar-avatar"
    >
      {initial}
    </div>
  );
};
