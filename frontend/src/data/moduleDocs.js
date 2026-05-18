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
    fil: {
      title: 'Gentle Mirror',
      description: 'Isang ligtas at maayos na espasyo para magbahagi ng mga alalahanin, humikayat ng pag-unlad, at mag-reflect. Gumagamit ito ng mga tiyak na panuntunan upang isulong ang malalim na pag-unawa kaysa sa walang katapusang pagtatalo.',
      whatIsIt: 'Ang Gentle Mirror ay hindi lamang isang chat app; ito ay isang guided reflection platform. Binabagalan nito ang usapan sa pamamagitan ng paglimita sa mga tugon at pag-obliga ng pagninilay-nilay upang nakatuon ito sa pag-unawa at positibong pagbabago.',
      howToUse: [
        'Magpadala ng mirror nang anonymous o nakapangalan para magbigay ng constructive feedback.',
        'Kung makatanggap ka ng mirror, maaari mo itong "Tanggapin" agad kung sumasang-ayon ka, upang tapusin na ang usapan.',
        'Kung pipiliin mong sumagot, kailangan mong sagutan ang 5 bahagi ng pagninilay: Nililinaw (Clarification), Nararamdaman (Feelings), Kinikilala (Acknowledgment), Inaasahang Maunawaan (Hoped Understanding), at Talata sa Bibliya.',
        'Pagkatapos mabasa ang mensahe, mayroong sapilitang 1-oras na pagninilay (cooldown) bago makasagot upang maiwasan ang pabigla-biglang reaksyon.',
        'Upang maiwasan ang mahabang away, limitado lamang sa 3 ang pwedeng isagot ng bawat isa.',
        'Maaaring markahan ng sender ang usapan bilang "Nagbago Na" kapag nakita na nila ang tunay na positibong pagbabago.',
        'Kung hindi na maganda ang patutunguhan ng usapan, maaaring humingi ng tulong sa counselor, ngunit kailangan itong sang-ayunan ng magkabilang panig.',
        'Kung kinakailangan, maaaring humiling ang sender na burahin ang thread. Kapag naaprubahan ng admin, mapupunta ito sa recovery bin nang 60 araw bago tuluyang mabura.'
      ],
      rules: [
        'Laging panatilihin ang marespeto at constructive na tono.',
        'Mag-isip nang mabuti bago sumagot—3 beses ka lang pwedeng mag-reply.',
        'Maging tapat sa pagsagot sa 5-bahaging pormularyo upang magkaunawaan.',
        'Igalang ang pagkapribado kung pinili ng sender na maging anonymous.'
      ],
      templates: [
        {
          title: "Gabay: Pagpapadala ng Gentle Mirror",
          description: "Gamitin itong gabay para masigurong maayos at nakakatulong ang iyong feedback.",
          structure: [
            { label: "Paksa (Topic)", text: "Maikli at neutral na pamagat para sa mirror." },
            { label: "Alalahanin (Concern)", text: "Ilarawan ang partikular na nakakaalalang kilos o sitwasyon." },
            { label: "Epekto (Impact)", text: "Paano ito nakaapekto sa iyo o sa komunidad?" },
            { label: "Inaasahang Pagbabago (Desired Change)", text: "Anong magandang pagbabago ang gusto mong makita?" },
            { label: "Talata sa Bibliya (Bible Verse)", text: "Talata na gagabay sa iyong feedback." }
          ],
          example: "Paksa: Pagkahuli sa mga meeting natin\nAlalahanin: Napansin kong nahuli ka sa huling tatlong meeting natin.\nEpekto: Naantala ang ating mga talakayan at naapektuhan ang oras ng team.\nInaasahang Pagbabago: Sana ay mas maayos mo ang iyong oras para makaabot sa susunod.\nTalata sa Bibliya: Filipos 2:4 - 'Huwag lamang ang sarili ninyong kapakanan ang inyong isipin, kundi ang kapakanan din ng iba.'"
        },
        {
          title: "Gabay: Pagsagot sa Mirror",
          description: "Gamitin ang 5-bahaging estruktura na ito para sa iyong pagninilay.",
          structure: [
            { label: "Nililinaw", text: "Ano ang naiintindihan mo sa nais nilang iparating?" },
            { label: "Nararamdaman", text: "Ano ang naramdaman mo nang matanggap ito?" },
            { label: "Kinikilala", text: "Anong bahagi ng kanilang pananaw ang tinatanggap mo?" },
            { label: "Inaasahang Maunawaan", text: "Ano ang nais mong maintindihan nila sa iyong panig?" },
            { label: "Talata sa Bibliya", text: "Talata na gagabay sa iyong tugon." }
          ],
          example: "Nililinaw: Naiintindihan ko na naapektuhan ang team sa pagkahuli ko.\nNararamdaman: Nahiya ako, pero salamat sa pagsasabi mo.\nKinikilala: Inaamin kong hindi naging maayos ang pag-manage ko ng oras ko kamakailan.\nInaasahang Maunawaan: Sana maintindihan mo na may hindi inaasahang problema sa pamilya, pero inaayos ko na ito.\nTalata sa Bibliya: Efeso 5:15-16 - 'Kaya't mag-ingat kayo kung paano kayo namumuhay... samantalahin ninyo ang bawat pagkakataon.'"
        }
      ]
    },
    conyo: {
      title: 'Gentle Mirror',
      description: 'A super safe space to share concerns and reflect together. It has strict rules so we focus on deep understanding instead of, like, arguing non-stop.',
      whatIsIt: 'So basically, Gentle Mirror isn\'t just for chatting; it\'s a guided reflection tool. It slows things down by capping your replies and making you fill out structured answers so we can focus on actual character development.',
      howToUse: [
        'Send a mirror (anon or namedrop yourself) to give constructive feedback.',
        'If you get a mirror and you agree, just click "Accept" to end the thread on a good note.',
        'If you wanna reply, you gotta fill out 5 things: Clarification, Feelings, Acknowledgment, Hoped Understanding, and a Bible Verse.',
        'After you open the message, there\'s a mandatory 1-hour reflection cooldown before you can reply. This literally stops you from sending impulsive answers.',
        'To avoid endless drama, you literally only get 3 replies max per person.',
        'The sender can mark it as "Resolved" (Nagbago Na) once they see actual, real-life character growth from you.',
        'If the thread is giving bad vibes, either of you can request a counselor, but both of you have to agree to it.',
        'If you really need to delete the thread, the sender can request it from the admin. It stays in the bin for 60 days just in case you wanna restore it.'
      ],
      rules: [
        'Keep the vibes respectful and focused on growth.',
        'Think carefully before you hit send—you only have 3 replies.',
        'Fill out the 5-part form honestly so there\'s real understanding.',
        'Respect the anon status if they choose to hide their name, literally.'
      ],
      templates: [
        {
          title: "Template: Sending a Gentle Mirror",
          description: "Use this guide to make sure your feedback is like, constructive and growth-focused.",
          structure: [
            { label: "Topic", text: "A short, neutral title so they know what's up." },
            { label: "Concern", text: "Spill the tea but nicely. What specific thing did they do?" },
            { label: "Impact", text: "How did it affect the vibes or the community?" },
            { label: "Desired Change", text: "What character development do you wanna see?" },
            { label: "Bible Verse", text: "A verse to anchor your message." }
          ],
          example: "Topic: Being late to our meetings\nConcern: I noticed you were late to the last three meetings.\nImpact: It kinda messed up the schedule and delayed the whole team.\nDesired Change: I hope you can adjust your time management next week so we can start on time.\nBible Verse: Philippians 2:4 - 'Let each of you look not only to his own interests, but also to the interests of others.'"
        },
        {
          title: "Template: Replying to a Mirror",
          description: "Use this 5-part structure to reflect before you hit reply.",
          structure: [
            { label: "Clarification", text: "What's your takeaway from their message?" },
            { label: "Feelings", text: "How did it make you feel? Be honest but respectful." },
            { label: "Acknowledgment", text: "Take accountability for your actions." },
            { label: "Hoped Understanding", text: "What do you want them to get about your side?" },
            { label: "Bible Verse", text: "A verse to keep you grounded." }
          ],
          example: "Clarification: I get that my being late disrupted the team's flow.\nFeelings: I felt kinda called out, but I appreciate you being real with me.\nAcknowledgment: I admit my time management has been kinda off lately.\nHoped Understanding: I hope you get that I had some unexpected fam stuff, but I'm working on it.\nBible Verse: Ephesians 5:15-16 - 'Be very careful, then, how you live... making the most of every opportunity.'"
        }
      ]
    }
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
    fil: {
      title: 'System Requests',
      description: 'Isang built-in na helpdesk para mag-submit ng mga ulat ng bug, mungkahi ng feature, at kahilingan ng pagbabago direkta sa mga administrator ng platform.',
      whatIsIt: 'Ang System Requests ay isang one-way na ticket system sa pagitan ng mga miyembro at ng administrator. Kapag may natuklasang problema, may mungkahi para sa bagong feature, o nais mong baguhin ang isang bahagi ng platform, dito ka gumagawa ng tiket. Sinusuri ng mga administrator ang lahat ng isinumiteng tiket, ina-update ang status habang nagtatrabaho sila, at maaaring mag-post ng opisyal na tugon. Hindi mo maaaring baguhin o burahin ang tiket pagkatapos itong isumite — ito ay upang masiguro ang malinaw at hindi nabagong rekord para sa admin.',
      howToUse: [
        'Mula sa Main Dashboard, buksan ang System Requests module para makita ang iyong listahan ng "Aking mga Kahilingan".',
        'I-click ang "Gumawa ng Kahilingan" para buksan ang form.',
        'Maglagay ng malinaw at tiyak na pamagat para sa iyong kahilingan.',
        'Piliin ang tamang uri: "Ulat ng Bug" para sa sirang feature, "Feature Request" para sa bagong ideya, o "Modification Request" para sa pagbabago ng kasalukuyang feature.',
        'Sumulat ng detalyadong paglalarawan. Para sa mga bug, isama ang mga hakbang para ma-reproduce ito. Para sa mga feature at pagbabago, ipaliwanag ang inaasahang resulta.',
        'I-submit ang iyong kahilingan. Agad itong mase-save na may status na "Open".',
        'I-click ang anumang tiket sa iyong listahan para makita ang buong detalye, kasalukuyang status, at tugon ng admin.',
        'Hindi na kailangan pang mag-follow up — ina-update ng admin ang status at nagpo-post ng tugon direkta sa iyong tiket.'
      ],
      rules: [
        'Ang mga tiket ay pinal. Hindi mo maaaring baguhin o burahin ang tiket pagkatapos itong isumite.',
        'Isang isyu lamang sa bawat tiket. Huwag pagsamahin ang maraming problema o ideya sa iisang submission.',
        'Tatlong uri lamang ang tinatanggap: Ulat ng Bug, Feature Request, o Modification Request.',
        'Ang iyong tiket ay maaaring magkaroon ng isa sa apat na status: Open (naghihintay), In Progress (inaayos), Resolved (natapos), o Closed (walang karagdagang aksyon).',
        'Ang mga administrator lamang ang maaaring magbago ng status o mag-post ng tugon — ikaw ay nasa read-only na papel pagkatapos mag-submit.',
        'Para sa mga personal o interpersonal na usapin, gamitin ang Gentle Mirror module.'
      ]
    },
    conyo: {
      title: 'System Requests',
      description: 'Basically the in-app helpdesk where you submit bug reports, feature ideas, or requests to change something in the platform — straight to the admins.',
      whatIsIt: 'So System Requests is a one-way ticket system between you and the admin. If something is broken, you have an idea, or you want a feature tweaked, you create a ticket here. The admin sees everything, updates the status as they work on it, and can post a reply directly on your ticket. Once you submit, you literally cannot edit or delete it — which is intentional so the admin gets an unmodified record to work from.',
      howToUse: [
        'From the Main Dashboard, open System Requests to see your "My Requests" list.',
        'Hit "Create Request" to pull up the submission form.',
        'Give it a clear, specific title — not just "it\'s broken."',
        'Pick the right type: "Bug Report" if something is broken, "Feature Request" if you have a new idea, or "Modification Request" if you want an existing feature changed.',
        'Write a super detailed description. For bugs, include the exact steps to reproduce it. For features and mods, explain what you want it to do.',
        'Submit it. It gets saved instantly with an "Open" status.',
        'Click any ticket in your list to open the full Ticket View — you can see the details, current status, and any admin reply there.',
        'No need to DM anyone — the admin updates the status and replies directly on your ticket.'
      ],
      rules: [
        'Tickets are final, period. You cannot edit or delete after submitting.',
        'One topic per ticket. Don\'t dump multiple bugs or ideas into one submission.',
        'Only three types are valid: Bug Report, Feature Request, or Modification Request.',
        'Your ticket moves through four statuses: Open → In Progress → Resolved or Closed.',
        'Only admins can change the status or post a response. Your role is read-only after you submit.',
        'For people issues or interpersonal stuff, use the Gentle Mirror module — not this one.'
      ]
    }
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
    fil: {
      title: 'Shining Light',
      description: 'Isang plataporma para ipagdiwang, pahalagahan, at kilalanin ang kabutihan ng isang tao. Sa halip na magtama ng mali, pinaliliwanag nito ang kanilang mabubuting gawa at pagkatao.',
      whatIsIt: 'Ang Shining Light ay ang kabaligtaran ng Gentle Mirror. Ito ay ganap na anonymous para sa nagpadala. Ito ay isang espasyo para magpadala ng taos-pusong mensahe ng pagpapahalaga, epekto, at pagpapalakas-loob. Nagtatampok din ito ng "Fruit of the Spirit" endorsement system upang kilalanin ang espirituwal na paglago ng iba.',
      howToUse: [
        'Magpadala ng Shining Light sa kapwa miyembro para ipahayag ang iyong pagpapahalaga.',
        'Nakatago ang iyong pagkakakilanlan mula sa tatanggap — makikita lamang nila na galing ito kay "Anonymous".',
        'Sagutan ang form kasama ang iyong Pagpapahalaga, ang Epekto nila, ang iyong Pagpapalakas-loob, at isang pansuportang talata sa Bibliya.',
        'Gamitin ang "Endorse" tab para kilalanin nang anonymous ang mga miyembro na nagpapakita ng 9 na Bunga ng Espiritu Santo.',
        'Tingnan ang iyong "My Fruits" tab para makita ang buod ng mga bungang nakikita ng iba sa iyo. Ang mga numero ay kusang nagbabago (real-time).',
        'Sa pagpapadala ng affirmation o endorsement, bibigyan ka ng maikling oras (countdown) para magnilay sa isang talata sa Bibliya bago ito maipadala.',
        'Maaaring sumagot ang tatanggap ng isang maikling pasasalamat at markahan ito bilang "Natanggap nang may Pasasalamat".',
        'Ang mga Shining Light at Endorsement ay hindi kailanman binubura. Nananatili itong permanenteng talaan ng kabutihan sa ating komunidad.'
      ],
      rules: [
        'Maging tapat. Ipadala ito para magpalakas ng loob, hindi para pumuri nang walang kabuluhan.',
        'Tumutok sa pagkatao, mabubuting gawa, at positibong epekto.',
        'Maging totoo sa pag-endorso base sa iyong nakikita.',
        'Panatilihing maikli at taos-puso ang pasasalamat na tugon.'
      ],
      templates: [
        {
          title: "Gabay: Pagpapadala ng Shining Light",
          description: "Gamitin ang gabay na ito para matiyak na ang iyong affirmation ay makabuluhan at tiyak.",
          structure: [
            { label: "Paksa", text: "Maikli at masayang pamagat." },
            { label: "Pagpapahalaga", text: "Ano ang pinahahalagahan mo sa taong ito?" },
            { label: "Epekto", text: "Paano nakabuti sa iyo o sa komunidad ang kanilang mga ginawa?" },
            { label: "Pagpapalakas-loob", text: "Ano ang inaasahan mong ipagpatuloy nila?" },
            { label: "Talata sa Bibliya", text: "Talata na sumusuporta sa iyong papuri." }
          ],
          example: "Paksa: Salamat sa iyong pamumuno!\nPagpapahalaga: Talagang pinahahalagahan ko kung paano ka nanguna sa proyekto ng team natin noong nakaraang linggo.\nEpekto: Ang iyong malinaw na komunikasyon ay nagpanatiling kalmado sa amin, at natapos namin ito nang walang stress.\nPagpapalakas-loob: Sana ay patuloy mong gamitin ang iyong talento sa pamumuno—malaking tulong ito.\nTalata sa Bibliya: Mateo 5:16 - 'Gayon din naman, magliwanag ang inyong ilaw sa harap ng mga tao...'"
        }
      ],
      fruits: [
        { name: 'Pag-ibig', description: 'Walang kondisyong pagmamalasakit at sakripisyo para sa iba.' },
        { name: 'Kagalakan', description: 'Malalim na kaligayahan na nananatili anuman ang sitwasyon.' },
        { name: 'Kapayapaan', description: 'Katahimikan at pagkakasundo na nagmumula sa pagtitiwala sa Diyos.' },
        { name: 'Katiyagaan', description: 'Pagtitiis at pagpapanatili ng kalmado sa gitna ng hirap o pagsubok.' },
        { name: 'Kabaitan', description: 'Pagiging palakaibigan, mapagbigay, at maalalahanin.' },
        { name: 'Kabutihan', description: 'Kahusayang moral at paggawa ng tama sa lahat ng pagkakataon.' },
        { name: 'Katapatan', description: 'Pagiging maaasahan at matatag sa mga pangako at tungkulin.' },
        { name: 'Kahinahunan', description: 'Pagiging mabini at pagkakaroon ng mapagpakumbabang lakas.' },
        { name: 'Pagpipigil sa sarili', description: 'Pagkakaroon ng kontrol sa sariling mga pagnanasa at udyok.' }
      ]
    },
    conyo: {
      title: 'Shining Light',
      description: 'A platform to celebrate and hype up the good in a person. Instead of calling out a wrong, you are literally shining a light on their good deeds and character.',
      whatIsIt: 'Shining Light is the positive vibes version of Gentle Mirror. It is completely anon for the sender. It is a safe space to drop a heartfelt message of appreciation, and it also has a "Fruit of the Spirit" endorsement system to lowkey recognize other people\'s spiritual growth.',
      howToUse: [
        'Drop a Shining Light to a fellow member to express your appreciation.',
        'Your identity is hidden from them — they\'ll only see that it came from "Anonymous".',
        'Fill out the form with your Appreciation, the Impact they made, your words of Encouragement, and a supporting Bible verse.',
        'Use the "Endorse" tab to anon-endorse people for showing any of the 9 Fruits of the Holy Spirit.',
        'Check your "My Fruits" tab to flex your aggregated fruit counts. The numbers update in real-time, literally.',
        'When sending an affirmation or endorsement, you gotta pause and reflect on a Bible verse during a quick countdown before it sends.',
        'The receiver can drop a single, quick thank-you reply and mark it as "Received with Gratitude".',
        'Shining Lights and Endorsements are never deleted. They stay as a permanent flex of the good vibes in our community.'
      ],
      rules: [
        'Be genuine. Send this to uplift, not just to suck up.',
        'Focus on character development, good deeds, and positive impact.',
        'Endorse fruits honestly based on what you literally see in them.',
        'Keep the thank-you reply short and sweet.'
      ],
      templates: [
        {
          title: "Template: Sending a Shining Light",
          description: "Use this guide to make sure your affirmation is literally so meaningful and specific.",
          structure: [
            { label: "Topic", text: "A short, hype title." },
            { label: "Appreciation", text: "What do you love about this person?" },
            { label: "Impact", text: "How did their actions bring positive vibes to you or the community?" },
            { label: "Encouragement", text: "What do you want them to keep slaying at?" },
            { label: "Bible Verse", text: "A verse to ground your praise." }
          ],
          example: "Topic: Thank you for stepping up!\nAppreciation: I literally appreciate how you took the lead on the project last week.\nImpact: Your clear comms kept everyone sane and we met the deadline with zero stress.\nEncouragement: Please keep flexing your leadership skills—it makes such a huge difference.\nBible Verse: Matthew 5:16 - 'Let your light shine before others...'"
        }
      ],
      fruits: [
        { name: 'Love', description: 'Literal na unconditional care and sacrifice for others, bes.' },
        { name: 'Joy', description: 'That deep-seated happiness that stays even when things are, like, super messy.' },
        { name: 'Peace', description: 'Inner chill and harmony because you totally trust God.' },
        { name: 'Patience', description: 'Staying calm and enduring even when things are taking forever or people are annoying.' },
        { name: 'Kindness', description: 'Being friendly and generous — basically spreading good vibes.' },
        { name: 'Goodness', description: 'Doing what\'s right and being a literal saint in your actions.' },
        { name: 'Faithfulness', description: 'Being super reliable and loyal to your commitments.' },
        { name: 'Gentleness', description: 'Having that humble strength and being mild in your approach.' },
        { name: 'Self-control', description: 'Not letting your impulses and cravings take over. You\'re the boss of you!' }
      ]
    }
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
    fil: {
      title: 'Treasury & Fund Tracker',
      description: 'Isang sentralisadong sistema para sa transparency at financial management, kung saan ang Youth Treasurer at mga Administrator ay nagpapanatili ng ledger at lingguhang ambagan.',
      whatIsIt: 'Ang Fund Tracker ay isang kumpletong ledger system na nagtatala ng pondo, gastos, at lingguhang ambagan ng mga miyembro. Nagbibigay ito ng real-time transparency sa buong komunidad habang binibigyan ang Youth Treasurer ng mga tool para i-automate ang record-keeping at gumawa ng mga event report.',
      howToUse: [
        'Gamitin ang "Overview" tab upang makita ang kalagayang pinansyal ng komunidad. Lahat ay pwedeng makakita, pero management lang ang pwedeng mag-edit.',
        'Kung ikaw ang Treasurer, gamitin ang "Add Transaction" para sa pangkalahatang pondo, o ang "Fellowship Exp." para sa mga group event.',
        'Sa "Fellowship Exp.", pipili ka lang ng mga kasali mula sa roster at ang system na ang mag-uulat ng kabuuang gastos at detalye nito.',
        'Para sa mga event, i-click ang "Copy" icon para makakuha ng maayos na format ng announcement na pwede mong i-post sa inyong mga group chat.',
        'Pumunta sa "Weekly Dues" tab para makita ang matrix ng ambagan. Makikita rito kung sino ang updated (green check), abanse (positive), o may utang (red negative).',
        'Ang mga Treasurer ay pwedeng mag-click sa anumang cell sa grid para mag-record ng bayad. Ang system na ang bahala sa accounting sa background.',
        'Ang roster management (pagdagdag o pagtanggal ng miyembro) ay nasa ibaba ng Weekly Dues tab para sa mga authorized users.'
      ],
      rules: [
        'Lahat ng miyembro ay may read-only access para sa transparency.',
        'Tanging mga Administrator at Youth Treasurer lamang ang pwedeng mag-Create, Edit, o Delete ng records.',
        'Ang pagbura ng transaksyon sa Overview ay awtomatikong magbubura rin sa anumang kaugnay na bayad sa Weekly Dues grid.',
        'Ang baseline na ambagan ay ₱10 kada Linggo, simula Mayo 1, 2026.'
      ]
    },
    conyo: {
      title: 'Treasury & Fund Tracker',
      description: 'The ultimate finance hub for transparency. It lets the Youth Treasurer and Admins manage the community\'s funds, weekly dues, and expenses while everyone else watches the flex.',
      whatIsIt: 'The Fund Tracker is an all-in-one ledger system for the transparency vibes. Everyone can see where the money goes, but the Youth Treasurer gets the special tools to automate the roster, track who\'s in arrears, and generate professional event reports.',
      howToUse: [
        'Check the "Overview" tab to literally see the financial health. Everyone can view the transactions, but only the management can touch them.',
        'If you\'re the Treasurer, use "Add Transaction" for random stuff, or "Fellowship Exp." to record group events in one go.',
        'The "Fellowship Exp." tool is so clutch—just pick the members from the roster and it literally computes the total damage and writes the description for you.',
        'For event transactions, hit the "Copy" icon to get a professionally formatted announcement. Super perfect for pasting in the GC, literally.',
        'Go to the "Weekly Dues" tab to see the matrix. It shows who is updated (green check), who paid in advance (positive), and who is in arrears (red negative).',
        'Treasurers can just tap any cell in the grid to record a payment. The system does the background accounting for you, no sweat.',
        'Roster management is at the bottom of the Weekly Dues tab if you have the permission to add or drop members.'
      ],
      rules: [
        'All verified members have read-only access for the transparency vibes.',
        'Strictly Admins and the Youth Treasurer only for the Create, Edit, and Delete powers.',
        'If you delete a transaction in Overview, it cascades and clears the entry in the Weekly Dues grid too.',
        'Weekly dues are pegged at ₱10 per Sunday, starting exactly on May 1, 2026.'
      ]
    }
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
    fil: {
      title: 'Resource Center',
      description: 'Isang premium na digital library para sa pagbabahagi at pag-access ng mga research paper, dokumento, at mahahalagang materyales nang may maayos na reading interface.',
      whatIsIt: 'Ang Resource Center ay hindi lamang imbakan ng file; mayroon itong magazine-style na reading interface. Nagbibigay-daan ito sa mga administrator na mag-upload ng mga dokumento (PDF, DOCX) na madaling mahanap, mabasa, at ma-download ng mga miyembro na may tamang pangalan (filename).',
      howToUse: [
        'Buksan ang Resource Center mula sa Main Dashboard.',
        'Gamitin ang search bar o category dropdown upang maghanap ng resources gamit ang pamagat, may-akda, o tags.',
        'I-click ang resource card upang buksan ang dedicated na pahina para dito.',
        'Kung mahaba ang babasahin, awtomatikong isine-save ng app ang iyong pwesto (scroll position) para makabalik ka kung saan ka huminto.',
        'I-click ang "Download File" button sa kanang itaas ng pahina para i-download ang orihinal na dokumento.',
        'Kung ikaw ay isang Administrator, i-click ang "Upload Resource" upang magdagdag ng bagong dokumento gamit ang rich text editor.'
      ],
      rules: [
        'Tanging mga Administrator lamang ang maaaring mag-upload, mag-edit, at magbura ng resources.',
        'Tiyaking ang mga dokumento ay may kaugnayan at nasa tamang kategorya.',
        'Igalang ang intellectual property at copyright ng mga may-akda.'
      ]
    },
    conyo: {
      title: 'Resource Center',
      description: 'A premium digital library for all your research papers and must-read materials, complete with a super aesthetic reading experience.',
      whatIsIt: 'Basically, the Resource Center isn\'t just a file dump; it\'s a magazine-style reading platform. Admins can drop PDF and DOCX files, and you can browse, read the rich-text abstracts, and download the actual files with properly slugified filenames.',
      howToUse: [
        'Open the Resource Center from the dashboard, bes.',
        'Just type in the search bar or use the category dropdown to find what you need.',
        'Click on a resource card to open its own aesthetic reading page.',
        'The app literally auto-bookmarks your scroll position. If you leave the page and come back, it drops you right where you stopped reading!',
        'Hit the "Download File" button at the top right to download the actual document.',
        'If you\'re an Admin, you get the exclusive "Upload Resource" button to drop new files using the rich text editor.'
      ],
      rules: [
        'Strictly Admins only for uploading, editing, and deleting stuff.',
        'Make sure the docs you drop are actually relevant and categorized properly.',
        'Respect the copyright, literally.'
      ]
    }
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
    fil: {
      title: 'Threshold Games',
      description: 'Isang Bible quiz platform kung saan maaari mong subukin ang iyong kaalaman, makipagkumpitensya sa leaderboard, at bumuo ng daily streak kasama ang iyong komunidad.',
      whatIsIt: 'Ang Threshold Games ay isang quiz hub na dinisenyo para sa youth group. Gumagawa ang mga Administrator ng mga quiz set na may mga tanong mula sa Bibliya (multiple choice o true/false), at lahat ng mga verified na miyembro ay maaaring maglaro anumang oras. Ang bawat quiz ay may timer sa bawat tanong, at ang iyong mga sagot ay ni-score sa server para sa patas na resulta. Ang mga score mo ay nakapasok sa global leaderboard, at ang sunod-sunod na araw ng paglalaro ay bumubuo ng iyong streak.',
      howToUse: [
        'Buksan ang Threshold Games mula sa Main Dashboard para makita ang lahat ng available na quiz.',
        'I-click ang anumang quiz card para makita ang preview — kasama ang bilang ng mga tanong at estimated na oras.',
        'Pindutin ang "Simulan ang Quiz" para magsimula. Ang bawat tanong ay may sariling countdown timer na ipinapakita bilang animated ring.',
        'Piliin ang iyong sagot bago maubusan ng oras. Kung mag-expire ang timer, ituturing itong hindi nasagot.',
        'Pagkatapos ng huling tanong, isi-score ng server ang iyong mga sagot at ipapakita ang mga resulta kasama ang detalyadong review ng bawat tanong.',
        'Pumunta sa "Leaderboard" tab para makita kung paano ka naka-rank kumpara sa ibang miyembro.',
        'Tingnan ang "Aking Stats" para sa iyong quiz history, average performance, pinakamataas na score, at kasalukuyang day streak.',
        'Ang mga Administrator ay maaaring gumawa ng bagong quiz gamit ang "+" button, pumipili sa pagitan ng Multiple Choice at True/False na uri ng tanong.'
      ],
      rules: [
        'Lahat ng verified na miyembro ay maaaring maglaro ng anumang published na quiz.',
        'Ang mga sagot ay ini-score sa server — ang mga tamang sagot ay hindi ipinapadala sa iyong device hangga\'t hindi ka pa nag-submit.',
        'Ang bawat tanong ay may sariling timer (default 15 segundo). Ang hindi nasagot na tanong ay ituturing na mali.',
        'Maaari mong i-replay ang anumang quiz nang maraming beses. Lahat ng mga attempt ay naitala.',
        'Ang mga Administrator lamang ang maaaring gumawa, mag-edit, mag-publish/unpublish, o magbura ng mga quiz.',
        'Ang mga streak ay binibilang batay sa sunod-sunod na araw na may kahit isang quiz na nilaro.'
      ]
    },
    conyo: {
      title: 'Threshold Games',
      description: 'A Bible quiz platform where you can literally test your knowledge, compete on the leaderboard, and build your daily streak with the community.',
      whatIsIt: 'So basically, Threshold Games is a quiz hub made for the youth group. Admins create quiz sets with Bible questions (multiple choice or true/false), and all verified members can play them anytime. Each question has its own timer, and your answers get scored server-side so it\'s literally cheat-proof. Your scores show up on the global leaderboard, and playing every day builds your streak.',
      howToUse: [
        'Open Threshold Games from the Dashboard to see all the quizzes available.',
        'Click any quiz card to preview it — you\'ll see the question count and estimated time.',
        'Hit "Start na!" to begin. Each question has its own animated countdown timer, so don\'t zone out.',
        'Pick your answer before the time runs out. If you don\'t, it literally counts as wrong.',
        'After the last question, the server scores everything and shows you a full review of what you got right and wrong.',
        'Go to the "Leaderboard" tab to flex your rank against everyone else by total score and average percentage.',
        'Check "My Stats" to see your quiz history, average performance, best score, and current day streak. The fire emoji is everything.',
        'If you\'re an Admin, hit the "+" button to create new quizzes with Multiple Choice or True/False questions and custom time limits.'
      ],
      rules: [
        'All verified members can play any published quiz, literally.',
        'Answers are scored server-side — the correct answers literally never touch your device until after you submit.',
        'Each question has its own timer (default 15 seconds). If you don\'t answer, it\'s marked wrong.',
        'You can replay any quiz as many times as you want. All attempts get tracked.',
        'Only Admins can create, edit, publish/unpublish, or delete quizzes.',
        'Streaks are based on consecutive calendar days with at least one quiz played. Don\'t break the streak, bes!'
      ]
    }
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
        'Streak reminders: Automated notifications will be sent to your email and in-app notifications 3 hours and 1 hour before the day ends (UTC time) if your streak is at risk.'
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
    fil: {
      title: 'Devotional Tracker',
      description: 'Isang personal na quiet time tracker upang bumuo ng pare-parehong ugali sa pagbabasa ng Bibliya, subaybayan ang iyong pag-unlad, at manatiling accountable sa iyong mga lider.',
      whatIsIt: 'Ang Devotional Tracker ay isang journal at accountability module. Tinutulungan nito ang mga miyembro na i-record ang kanilang araw-araw na pagbabasa ng Bibliya, bumuo ng streak, makita ang natapos na basahin, at makatanggap ng encouraging feedback mula sa mga lider. Ang built-in na Bible Tracker ay awtomatikong nagpapakita ng porsyento ng iyong pagbabasa sa buong Bibliya.',
      howToUse: [
        'Buksan ang Devotional Tracker mula sa main dashboard upang makita ang iyong stats, calendar, at mga nakaraang entry.',
        'I-click ang "Isumite ang Debosyon" button sa kanang itaas upang magdagdag ng bagong entry.',
        'Piliin ang Petsa ng Debosyon. Maaari lamang pumili ng kahapon, ngayon, o 2 araw ang nakalipas upang masanay sa regular na pag-aaral.',
        'Piliin ang Aklat sa Bibliya mula sa dropdown at ilagay ang chapter at talata (hal. chapter 1, range na 1-3, partikular na talata tulad ng 1:1-10, o iba pang listahan).',
        'Sumulat ng detalyadong Buod ng iyong natutunan at isang tiyak na Aplikasyon para sa iyong buhay.',
        'Magdagdag ng opsyonal na Prayer Focus kung may mga partikular na kahilingan sa panalangin na nais mong ipagdasal ng iyong mga lider.',
        'Markahan ang pledge checkbox upang kumpirmahin ang iyong personal na oras sa Salita at i-submit ang iyong entry.',
        'Tingnan ang iyong Mini Calendar Heatmap: ang berdeng araw ay para sa mga na-submit, at ang ube/asul na araw ay para sa mga tinanggap (acknowledged) na ng lider.',
        'Pumunta sa "Bible Tracker" tab para makita ang visual map ng buong Bibliya at ang mga chapters na iyong nabasa.',
        'Kung ikaw ay Lider (Admin/Counselor), gamitin ang "Tingin ng Lider" tab para buksan ang Member Folders, makita ang pending badges, suriin ang mga entry ng miyembro, mag-iwan ng nota, at tingnan ang kanilang sariling Bible progress.'
      ],
      rules: [
        'Napapanahong submission: Maaari lamang mag-submit ng entry sa loob ng 3-araw na window (2 araw ang nakalipas, kahapon, o ngayon) upang maiwasan ang tambak na pag-log.',
        'Tapat na pangako: Ang bawat submission ay nangangailangan ng tapat na pangako na ang reflection ay galing sa iyong sariling quiet time, hindi gawa ng AI o kinopya.',
        'Naka-lock kapag tinanggap na: Maaari mong i-edit o burahin ang iyong entry, ngunit kapag ito ay tinanggap na ng lider, hindi na ito pwedeng baguhin.',
        'Streak ng Araw: Ang iyong active streak ay binibilang base sa sunod-sunod na araw na may kahit isang submission. Kapag may lumipas na araw, babalik ito sa 0.',
        'Alerto at paalala: May awtomatikong email at in-app reminder na ipapadala 3 oras at 1 oras bago matapos ang araw (UTC) kung nanganganib maputol ang iyong streak.'
      ],
      templates: [
        {
          title: "Paraang SOAP sa Devotional",
          description: "Isang maayos at subok na paraan ng quiet time upang matulungan kang mag-aral, magnilay, at maglapat ng Salita ng Diyos.",
          structure: [
            { label: "Talata (Passage)", text: "Piliin ang aklat at ilagay ang chapter/talata." },
            { label: "Buod (Summary)", text: "Ilarawan ang pangunahing mensahe ng talata at iyong mga natutunan." },
            { label: "Aplikasyon", text: "Paano mo ito ilalapat sa iyong buhay ngayon? Gawin itong personal, tiyak, at praktikal." },
            { label: "Prayer Focus", text: "Maikling panalangin o hiling na may kaugnayan sa iyong binasa o kasalukuyang pinagdadaanan." }
          ],
          example: "Talata: Awit 23:1-6\nBuod: Inilalarawan ni David ang Panginoon bilang ating Mabuting Pastol na nagbibigay ng ating pangangailangan, gumagabay, nagpapanumbalik ng lakas, at nagtatanggol sa atin sa gitna ng panganib.\nAplikasyon: Sa halip na mag-alala sa aking mga gawain ngayong linggo, magtitiwala ako sa aking Pastol na gagabayan ang aking oras at bibigyan ako ng kapayapaan.\nPrayer Focus: Panginoon, tulungan Mo akong magpahinga sa Iyong piling. Ipanalangin po ang kapayapaan sa aking abalang linggo."
        }
      ]
    },
    conyo: {
      title: 'Devotional Tracker',
      description: 'Your personal daily quiet time tracker to build a consistent QT habit, keep tabs on your Bible reading journey, and stay accountable with your leaders, bes!',
      whatIsIt: 'The Devotional Tracker is basically your quiet time journal and accountability buddy. It helps members log their daily time in God\'s Word, build those fire streaks, map out Bible chapters, and get nice encouraging feedback from leaders. The Bible Tracker automatically colors the books you\'ve read, which is super satisfying, promise!',
      howToUse: [
        'Open the Devotional Tracker from the main dashboard to flex your stats, calendar, and recent entries.',
        'Hit the "Submit Devotional" button in the top right to log a new reflection.',
        'Choose the Date of Devotion. You can only pick 2 days ago, yesterday, or today so you don\'t accumulate a mountain of backlog, literally.',
        'Pick the Bible Book from the dropdown, then type the chapters and verses (supports single chapters, ranges like 1-3, specific verses like 1:1-10, or list-style ranges).',
        'Write your Key Takeaways in the Summary box, and write an actionable personal Application.',
        'Drop a Prayer Focus if you have struggles or prayer requests you want your leaders to be aware of and pray for, bes.',
        'Tick the pledge checkbox to confirm it\'s your own real-life QT, then hit submit.',
        'Check your Mini Calendar Heatmap: green is for Submitted, and purple/blue means your leader Acknowledged it already.',
        'Go to the "Bible Tracker" tab to see the map of the whole Bible. Watch it light up as you read and track chapters!',
        'If you\'re a Leader, go to the "Leader View" tab to open Member Folders, see real-time pending badges, review their entries, drop encouraging notes, and check their Bible Tracker progress.'
      ],
      rules: [
        'Timely logging: You only have a 3-day window (2 days ago, yesterday, or today) to submit. No massive backlog dumping allowed, bes!',
        'Sincerity pledge: You gotta tick that pledge box to verify that this is your own genuine reflection, not AI-generated or copy-pasted.',
        'Lock on acknowledgment: You can edit or delete your entry anytime, but ONLY before a leader acknowledges it. Once they acknowledge, it\'s locked forever!',
        'Streak protection: Your streak counts consecutive calendar days. Miss a day, and it\'s back to zero. Keep the fire burning, bes!',
        'Streak reminders: Automated notifications will slide into your email and in-app alerts 3 hours and 1 hour before the day ends (UTC) to warn you if your streak is at risk.'
      ],
      templates: [
        {
          title: "SOAP Quiet Time Method",
          description: "A structured, super easy approach to daily quiet time to help you study, reflect, and apply God's Word, literally.",
          structure: [
            { label: "Passage", text: "Select the book and type the chapter/verse range." },
            { label: "Summary", text: "What's the passage about? Spill the tea on your key takeaways." },
            { label: "Application", text: "How will you apply this today? Make it real, specific, and super actionable, bes." },
            { label: "Prayer Focus", text: "A quick prayer or request about your reflection or current life vibes." }
          ],
          example: "Passage: Psalm 23:1-6\nSummary: David describes the Lord as our Shepherd who provides, guides, restores, and protects us even when things are super messy or scary.\nApplication: Instead of stressing over my school projects, I will trust the Shepherd to guide my schedule and give me rest today.\nPrayer Focus: Lord, help me rest in Your presence. Please pray for peace amidst my super busy week, bes."
        }
      ]
    }
  }
};
