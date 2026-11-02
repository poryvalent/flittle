// The portfolio. One entry per project on the orbit; the order here is the order around the ring.
// Fill in the real titles, clients, years and links; `url` left empty keeps a card from opening
// anything. PLACEHOLDERS: the names below are invented and the images are Unsplash stock photos
// until the real project shots arrive.
const IMAGES = [
  'https://plus.unsplash.com/premium_photo-1750075345490-1d9d908215c3?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwxfHx8ZW58MHx8fHx8',
  'https://images.unsplash.com/photo-1758445048994-d337f97acf4c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwyfHx8ZW58MHx8fHx8',
  'https://images.unsplash.com/photo-1758637612244-08a79efb7cb7?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwzfHx8ZW58MHx8fHx8',
  'https://images.unsplash.com/photo-1758621518225-9248e65dbaee?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw2fHx8ZW58MHx8fHx8',
  'https://images.unsplash.com/photo-1758640920711-8ad5dbcb5214?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwxMXx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1728419694854-7848ad37e9e5?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwxM3x8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1741134773975-19908121ae11?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwzNXx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1755609342539-a58d8d6a3e59?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw0M3x8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1758566486732-c6bcc1d080e1?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw0N3x8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1728406970237-bc699733f027?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw1Mnx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1758506972145-fdcac3daba97?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw1OXx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1757435755336-f715ff8896d8?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw2NXx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1758478648528-61a41d58944b?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw3NHx8fGVufDB8fHx8fA%3D%3D',
  'https://plus.unsplash.com/premium_photo-1757913782298-7255e6a5213e?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw3Nnx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1758513305697-8be64c4817a5?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw4Mnx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1741514230333-d6a6a89c4a40?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw4Nnx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1755183312704-f29e5ad3a544?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw5MHx8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1754769440490-2eb64d715775?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHw5N3x8fGVufDB8fHx8fA%3D%3D',
  'https://images.unsplash.com/photo-1758289863455-f5b1c8c76857?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwxMDJ8fHxlbnwwfHx8fHw%3D',
  'https://plus.unsplash.com/premium_photo-1686727103139-2824d4fa46a3?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwxMTZ8fHxlbnwwfHx8fHw%3D',
  'https://images.unsplash.com/photo-1758654307777-58463b34b4df?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwxMTR8fHxlbnwwfHx8fHw%3D',
  'https://images.unsplash.com/photo-1757482270431-a17f90bad2ce?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwxMTd8fHxlbnwwfHx8fHw%3D',
  'https://images.unsplash.com/photo-1758396629698-914f06bf8b27?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxmZWF0dXJlZC1waG90b3MtZmVlZHwxMTl8fHxlbnwwfHx8fHw%3D',
];

const NAMES = [
  ['Core banking migration', 'Northwind Capital', '2026'],
  ['Retail data platform', 'Harbor & Co.', '2026'],
  ['Fleet telemetry cloud', 'Meridian Logistics', '2025'],
  ['Patient portal rebuild', 'Alder Health', '2025'],
  ['Checkout at scale', 'Lumen Market', '2025'],
  ['Zero-trust rollout', 'Vantage Energy', '2025'],
  ['Design system and web', 'Orbit Studio', '2025'],
  ['Warehouse robotics API', 'Kestrel Supply', '2024'],
  ['Analytics on Kubernetes', 'Saltwater Media', '2024'],
  ['Mobile banking app', 'Crescent Bank', '2024'],
  ['Payments reconciliation', 'Tidal Pay', '2024'],
  ['Learning platform', 'Bright Academy', '2024'],
  ['Observability overhaul', 'Pinecrest Software', '2024'],
  ['Carbon reporting suite', 'Greenline Utilities', '2023'],
  ['Booking engine', 'Summit Travel', '2023'],
  ['Inventory forecasting', 'Marrow Foods', '2023'],
  ['Identity and SSO', 'Quill Legal', '2023'],
  ['Streaming backend', 'Nocturne Audio', '2023'],
  ['Claims automation', 'Beacon Insurance', '2023'],
  ['Marketplace launch', 'Atlas Goods', '2022'],
  ['ERP integration', 'Ironwood Manufacturing', '2022'],
  ['Edge CDN migration', 'Pulse Gaming', '2022'],
  ['Clinical trials data', 'Helix Research', '2022'],
  ['Customer support AI', 'Fathom Telecom', '2022'],
];

export const PROJECTS = NAMES.map(([title, client, year], i) => ({
  title, client, year, url: '', image: IMAGES[i % IMAGES.length],
}));
