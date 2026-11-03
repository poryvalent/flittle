// The portfolio. One entry per project; the ring repeats them in this order until it is full, so
// a short list still reads as a continuous loop. A click on a card brings the project into focus,
// with its story decoded in a terminal-style column: the summary, the paragraphs, the tags (as the
// stack) and the links (as "[label] ↗"). `kicker` is the hover caption and the focus footer.
// `image` is the card's cover, a screenshot of the project in `assets/work/`.
export const PROJECTS = [
  {
    title: 'AcreSync',
    kicker: 'Real-estate tokenisation · smart contracts',
    summary: 'Institutional real estate tokenised under SEBI’s SM-REIT framework, with the smart contracts behind it.',
    body: [
      'A framework for tokenising real estate: a property is represented by tokens issued and governed by smart contracts on Ethereum, so shares in it can be held and transferred on-chain instead of on paper.',
      'AcreSync is the console around it: investors bid on live SM-REIT offerings backed by verified bank liens, and operators run the schemes and their proofs.',
    ],
    tags: ['Blockchain', 'Smart contracts', 'Web app'],
    links: [{ label: 'Open AcreSync', url: 'https://realestate-tokenization-framework.vercel.app/' }],
    image: 'assets/work/realestate-tokenization.jpg',
  },
  {
    title: 'Trumio website',
    kicker: 'Company website · trumio.ai',
    summary: 'The public website for Trumio, a proof-of-work platform for engineering teams valued at $50M.',
    body: [
      'Design and build of the site that introduces trumio.ai: a platform that replaces certificates with verified evidence of what engineers can do, so delivery managers and clients deploy them on proof instead of hope.',
      'Fast, responsive and built to be edited as the company grows.',
    ],
    tags: ['Website', 'Design', 'Front end'],
    links: [{ label: 'Visit the site', url: 'https://trumio-website.vercel.app/' }],
    image: 'assets/work/trumio.jpg',
  },
  {
    title: 'Vivian Blackwood, AI streamer',
    kicker: 'AI · live on Twitch',
    summary: 'A fully functional AI VTuber that streams live on Twitch with nobody at the keyboard.',
    body: [
      'Vivian reads the chat and replies in a British voice, drives a Live2D avatar in real time, plays her own arcade games and reacts to how they go. The stream runs on its own.',
      'She streams as vivianblackwood on Twitch; the code is on GitHub.',
    ],
    tags: ['AI', 'Live video', 'Automation'],
    links: [
      { label: 'Watch on Twitch', url: 'https://www.twitch.tv/vivianblackwood' },
      { label: 'Code on GitHub', url: 'https://github.com/aquaphoenix69-prog/Ai-Streamer' },
    ],
    image: 'assets/work/ai-streamer.png',
  },
  {
    title: 'BidFair',
    kicker: 'Ticketing · bidding',
    summary: 'A ticketing system where tickets for live events go to bids instead of a fixed price.',
    body: [
      'An introduction to a bidding-based ticketing platform: instead of selling seats at a set price, BidFair takes bids and allocates the tickets fairly, so real fans get them and scalpers do not.',
      'The site presents how the model works and what it changes for organisers and buyers.',
    ],
    tags: ['Marketplace', 'Product', 'Web app'],
    links: [{ label: 'See BidFair', url: 'https://unnamed-bidding-platform.vercel.app/' }],
    image: 'assets/work/bidding-platform.jpg',
  },
];
