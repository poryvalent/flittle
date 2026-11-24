// The portfolio. One entry per project; the ring repeats them in this order until it is full, so
// a short list still reads as a continuous loop. A click on a card brings the project into focus,
// with its story decoded in a terminal-style column: the summary, the paragraphs, the tags (as the
// stack) and the links (as "[label] ↗"). `kicker` is the hover caption and the focus footer.
// `image` is the card's cover, a screenshot of the project in `assets/work/`.
// Optional `imageFit` and `imagePosition` control its framing on desktop and mobile.
export const PROJECTS = [
  {
    title: 'LawIt',
    kicker: 'Client website · lawit.ai · live',
    summary: 'The live website for LawIt, which builds A.L.I.E, an AI platform for law firms, in-house legal teams and universities.',
    body: [
      'LawIt’s product is A.L.I.E, the Applied Legal Intelligence Emulator: AI shaped to the way each legal practice works.',
      'We designed and built the public site at lawit.ai, which presents the platform to firms, in-house teams and universities.',
    ],
    tags: ['Website', 'Design', 'Front end'],
    links: [{ label: 'Visit lawit.ai', url: 'https://lawit.ai/' }],
    image: 'assets/work/lawit.png',
    imageFit: 'contain',
    imagePosition: 'center center',
  },
  {
    title: 'Wealth Management CRM',
    kicker: 'Client work · custom ERP · wealth management',
    summary: 'A custom ERP and CRM we built for a wealth management firm.',
    body: [
      'We designed and built an internal system shaped around the wealth management firm\'s own workflows.',
      'It is a private, internal system, so there is no public link.',
    ],
    tags: ['Client work', 'ERP / CRM', 'Finance'],
    links: [],
    image: 'assets/work/wealth-management-crm-redacted.png',
    imagePosition: 'left top',
  },
  {
    title: 'AcreSync',
    kicker: 'Prototype · real-estate tokenisation',
    summary: 'A prototype for tokenising real estate with smart contracts, modelled on SEBI’s SM-REIT framework. Not a live or regulated product.',
    body: [
      'A framework for tokenising real estate: a property is represented by tokens issued and governed by smart contracts on Ethereum, so shares in it can be held and transferred on-chain instead of on paper.',
      'The prototype includes a console where investors bid on sample offerings and operators run the schemes and their proofs. It runs on test data, not real offerings.',
    ],
    tags: ['Prototype', 'Smart contracts', 'Web app'],
    links: [{ label: 'Open the prototype', url: 'https://realestate-tokenization-framework.vercel.app/' }],
    image: 'assets/work/realestate-tokenization.jpg',
  },
  {
    title: 'Trumio website',
    kicker: 'Previous version of trumio.ai',
    summary: 'A previous version of the public website for Trumio, a proof-of-work platform for engineering teams.',
    body: [
      'Design and build of an earlier version of the site that introduced trumio.ai: a platform that replaces certificates with verified evidence of what engineers can do.',
      'The live trumio.ai is no longer this version. The link opens our build as it was.',
    ],
    tags: ['Website', 'Design', 'Front end'],
    links: [{ label: 'See the previous version', url: 'https://trumio-website.vercel.app/' }],
    image: 'assets/work/trumio.jpg',
  },
  {
    title: 'BidFair',
    kicker: 'Built for a client · did not launch',
    summary: 'A bidding-based ticketing platform we built for a client. The product did not launch.',
    body: [
      'Instead of selling seats at a set price, BidFair takes bids and allocates tickets fairly, so real fans get them and scalpers do not.',
      'We built the site that presents how the model works for organisers and buyers. The client did not take the platform to launch.',
    ],
    tags: ['Client work', 'Product', 'Web app'],
    links: [{ label: 'See the build', url: 'https://unnamed-bidding-platform.vercel.app/' }],
    image: 'assets/work/bidding-platform.jpg',
  },
];
