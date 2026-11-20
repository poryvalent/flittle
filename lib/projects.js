// The portfolio. One entry per project; the ring repeats them in this order until it is full, so
// a short list still reads as a continuous loop. A click on a card brings the project into focus,
// with its story decoded in a terminal-style column: the summary, the paragraphs, the tags (as the
// stack) and the links (as "[label] ↗"). `kicker` is the hover caption and the focus footer.
// `image` is the card's cover, a screenshot of the project in `assets/work/`.
export const PROJECTS = [
  {
    title: 'AcreSync',
    kicker: 'Tokenization · interface prototype',
    summary: 'An experimental web interface for a real-estate tokenization concept.',
    body: [
      'A prototype exploring the presentation of property information and token-based participation in a web application.',
      'The work shown here focuses on the product interface and concept presentation. The linked preview is an experimental prototype.',
    ],
    tags: ['Interface prototype', 'Tokenization', 'Web app'],
    links: [{ label: 'Open AcreSync', url: 'https://realestate-tokenization-framework.vercel.app/' }],
    image: 'assets/work/realestate-tokenization.jpg',
  },
  {
    title: 'Trumio website',
    kicker: 'Website design · frontend preview',
    summary: 'A website design and frontend example for Trumio, presented through a standalone preview.',
    body: [
      'Work on the website experience: content structure, page layouts and frontend interactions for presenting Trumio.',
      'The link opens the project preview, showing the design and frontend implementation.',
    ],
    tags: ['Website', 'Design', 'Front end'],
    links: [{ label: 'Visit the site', url: 'https://trumio-website.vercel.app/' }],
    image: 'assets/work/trumio.jpg',
  },
  {
    title: 'Vivian Blackwood, AI streamer',
    kicker: 'Interactive AI · experimental project',
    summary: 'An experimental AI character project connecting chat, voice and a streaming avatar.',
    body: [
      'The source repository documents chat responses, synthesized speech, Live2D avatar control and reactions to browser games.',
      'The project is presented as an interactive AI experiment, with source code on GitHub and a linked Twitch channel.',
    ],
    tags: ['AI experiment', 'Interactive character', 'Streaming'],
    links: [
      { label: 'Watch on Twitch', url: 'https://www.twitch.tv/vivianblackwood' },
      { label: 'Code on GitHub', url: 'https://github.com/aquaphoenix69-prog/Ai-Streamer' },
    ],
    image: 'assets/work/ai-streamer.png',
  },
  {
    title: 'BidFair',
    kicker: 'Ticketing concept · website',
    summary: 'A concept website introducing a bidding-based model for event tickets.',
    body: [
      'Explores a ticketing concept in which buyers submit bids instead of choosing a fixed ticket price.',
      'The website presents the proposed experience for event organizers and ticket buyers.',
    ],
    tags: ['Concept website', 'Ticketing', 'Product design'],
    links: [{ label: 'See BidFair', url: 'https://unnamed-bidding-platform.vercel.app/' }],
    image: 'assets/work/bidding-platform.jpg',
  },
];
