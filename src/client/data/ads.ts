export interface Ad {
  id: number;
  name: string;
  description: string;
  link: string;
}

const ADS: Ad[] = [
  {
    id: 1,
    name: 'Plesk',
    description: 'Manage your websites without the server headache. Try Plesk.',
    link: 'https://try.plesk.com/ebg5klqiho1k',
  },
  {
    id: 2,
    name: 'Notion',
    description:
      'One workspace for docs, projects, and everything in between. Try Notion.',
    link: 'https://affiliate.notion.so/4dpo7kgnpmea',
  },
  {
    id: 3,
    name: 'Miro',
    description:
      'Turn ideas into visual plans, diagrams, and workflows. Try Miro.',
    link: 'https://ps.miro-affiliate.com/clyde',
  },
  {
    id: 4,
    name: 'Remote People',
    description:
      'Build your remote team without the hiring headache. Meet Remote People',
    link: 'https://remotepeople.partnerlinks.io/z2kc5lbltr5y-d33o6t',
  },
  {
    id: 5,
    name: 'Eleven Labs',
    description: 'Turn text into remarkably lifelike voice. Try ElevenLabs',
    link: 'https://try.elevenlabs.io/pricing278',
  },
  {
    id: 6,
    name: 'WebinarJam',
    description:
      'Host webinars that turn viewers into customers. Try WebinarJam',
    link: 'https://try.kartra.com/hvt9tfix4flp-26ysr',
  },
  {
    id: 7,
    name: 'Kartra',
    description:
      'Build your online business from one powerful platform. Explore Kartra',
    link: 'https://try.kartra.com/jmb014dsmhu6',
  },
  {
    id: 8,
    name: 'EverWebinar',
    description:
      'Turn your best webinar into an automated sales engine. Try EverWebinar',
    link: 'https://try.kartra.com/0wvsb6qduges-xvggcn',
  },
  {
    id: 9,
    name: 'Diginius',
    description:
      'Simplify digital marketing with smarter tools and automation. Explore Diginius',
    link: 'https://get.diginius.com/hnllvld5l7wj-zjmxj2',
  },
  {
    id: 10,
    name: 'Trainual',
    description:
      'Turn your know-how into repeatable processes your team can follow. Try Trainual',
    link: 'https://start.trainual.com/10b05oqgt3wk',
  },
  {
    id: 11,
    name: 'Emergent Labs Inc',
    description:
      'Build apps with AI instead of starting from scratch. Try Emergent',
    link: 'https://get.emergent.sh/8c7ldpre0gsz',
  },
  {
    id: 12,
    name: 'Switcher Studio',
    description:
      'Turn your iPhone into a multi-camera live production studio. Try Switcher Studio',
    link: 'https://start.switcherstudio.com/xnstg3okvc02-jmchsi',
  },
  {
    id: 13,
    name: 'WebCatalog',
    description:
      'Turn web apps into desktop apps. Keep your workspace organized. Try WebCatalog',
    link: 'https://try.webcatalog.io/kodw5aondsm3',
  },
  {
    id: 14,
    name: 'Kit',
    description:
      'Build your audience, send better emails, and grow your creator business. Try Kit',
    link: 'https://partners.kit.com/3ps2ymgzzky3',
  },
  {
    id: 15,
    name: 'Consensus',
    description:
      'Ask research questions. Get answers grounded in scientific papers. Try Consensus',
    link: 'https://get.consensus.app/09syso9x7xf8',
  },
  {
    id: 16,
    name: 'Spocket',
    description:
      'Find products to sell without the inventory headache. Explore Spocket',
    link: 'https://get.spocket.co/86ch1dbjatyj',
  },
  {
    id: 17,
    name: 'Alohi Sign Plus',
    description:
      'Sign documents online without the printing and scanning. Try Sign.Plus',
    link: 'https://ref.alohi.com/9o05cicjcnxp-cpthut',
  },
  {
    id: 18,
    name: 'Alohi Fax Plus',
    description:
      'Send and receive faxes online—no fax machine required. Try Fax.Plus',
    link: 'https://ref.alohi.com/3zq7gv94xhx0',
  },
  {
    id: 19,
    name: 'Bolt',
    description:
      'Manage rides, car sharing, and micromobility in one place. Try Bolt for Business',
    link: 'https://get.business.bolt.eu/w41gcqh2h4ha',
  },
  {
    id: 20,
    name: 'Vista Social',
    description:
      'Manage all your social media from one powerful dashboard. Try Vista Social',
    link: 'https://join.vistasocial.com/cq2ce9r6df99',
  },
  {
    id: 21,
    name: 'Circle',
    description:
      'Build your community, courses, and memberships in one place. Try Circle',
    link: 'https://try.circle.so/kta7tzaxsy0u',
  },
  {
    id: 22,
    name: 'Canva',
    description:
      'Design anything—presentations, posters, websites, t-shirts, logos—no experience needed. Try Canva',
    link: 'https://www.canva.com/join/goldfish-dices-knapsack',
  },
  {
    id: 23,
    name: 'Glide',
    description:
      'Turn your spreadsheet into a working business app in minutes. Try Glide',
    link: 'https://join.glideapps.com/gdkfz19nkzfc',
  },
  {
    id: 24,
    name: 'Glide Agentic AI',
    description:
      "Deploy AI agents that handle your team's busywork for you with human-level performance. Explore Glide Agentic AI",
    link: 'https://join.glideapps.com/agentic-ai',
  },
  {
    id: 25,
    name: "Clyde's Glide Templates",
    description:
      "Skip the build—copy ready-made Glide app templates instead. Browse Clyde's Templates",
    link: 'https://join.glideapps.com/templates-by-clyde',
  },
  {
    id: 26,
    name: 'Deel',
    description:
      'Hire and pay global talent without the payroll complexity. Explore Deel',
    link: 'https://get.deel.com/npzwes7107vh',
  },
  {
    id: 27,
    name: "Clyde's Canva Marketplace",
    description:
      'Bring my design assets into your Canva presentations, posters, and creative projects',
    link: 'https://www.canva.com/p/clydedsouza/',
  },
  {
    id: 28,
    name: 'Mama Tell Me A Story (Amazon)',
    description:
      "Twelve engaging bedtime stories designed to spark your child's imagination",
    link: 'https://bit.ly/MamaTellMeAStoryKindle',
  },
  {
    id: 29,
    name: 'Mama Tell Me A Story (Google)',
    description:
      "Twelve engaging bedtime stories designed to spark your child's imagination",
    link: 'http://bit.ly/MamaTellMeAStoryGoogleBooks',
  },
  {
    id: 30,
    name: 'Mama Tell Me A Story (Apple Books)',
    description:
      "Twelve engaging bedtime stories designed to spark your child's imagination",
    link: 'https://bit.ly/MamaTellMeAStoryApple',
  },
  {
    id: 31,
    name: 'AI Tell Me A Story (Amazon)',
    description:
      'Fifty captivating stories, each with a life lesson to inspire young imaginations',
    link: 'https://bit.ly/aitellmeastory',
  },
  {
    id: 32,
    name: "Clyde's YouTube Channel",
    description:
      'Follow along as I explore products, tools, and practical how-tos. Subscribe to my YouTube channel',
    link: 'https://www.youtube.com/@clydedz',
  },
  {
    id: 33,
    name: '4-7-8 Breathing',
    description:
      'A simple 4-7-8 breathing exercise, right in your new tab, whenever you need a moment to reset',
    link: 'https://bit.ly/478breathing-ext',
  },
  {
    id: 34,
    name: 'Figma Chrome Extension Template',
    description:
      'Design your Chrome extension assets faster with ready-made Figma frames and components',
    link: 'https://www.figma.com/community/file/1127061326249481158',
  },
  {
    id: 35,
    name: 'Retrospective in the Island of Golocans',
    description:
      'Take your team on a fun island adventure with this award-winning retrospective template',
    link: 'https://miro.com/miroverse/retrospective-in-the-island-of-golocans/',
  },
  {
    id: 36,
    name: 'Whatchya Looking At? Dot Grid Notebook',
    description:
      'A bold dotted notebook for writing, sketching, doodling, and capturing ideas. Buy my book from Amazon',
    link: 'https://www.amazon.com/Whatchya-Looking-Dot-Grid-Notebook/dp/B0948LNSWL',
  },
  {
    id: 37,
    name: 'The Ultimate Sudoku Book',
    description:
      'Challenge yourself with 240 Sudoku puzzles and earn badges as you level up. Buy my book from Amazon',
    link: 'https://www.amazon.com/Ultimate-Sudoku-Puzzles-Badges-After/dp/B088VYT3BH',
  },
  {
    id: 38,
    name: 'Tic-Tac-Toe 1,000 Games',
    description:
      'Keep the classic game going with 1,000 Tic-Tac-Toe games for friends and family. Buy my book from Amazon',
    link: 'https://www.amazon.com/Tic-Tac-Toe-Games-Play-Friends-Family/dp/B088N5HR9G',
  },
  {
    id: 39,
    name: 'A Coffee and Chocolate Sketchbook',
    description:
      'A blank canvas for drawing, sketching, doodling, writing, or painting. Buy my book from Amazon',
    link: 'https://www.amazon.com/Coffee-Chocolate-Sketchbook-Notebook-Sketching/dp/B088N93LDR',
  },
  {
    id: 40,
    name: 'Clyde on Amazon',
    description:
      'Explore my collection of bedtime stories, sketchbooks, activity books, colouring books, and more',
    link: 'http://bit.ly/clyde-amzn',
  },
  {
    id: 41,
    name: 'Loyalty Cards Template',
    description:
      'Simplify loyalty card management with a ready-to-use Glide app',
    link: 'https://www.glideapps.com/templates/loyalty-cards-ll',
  },
  {
    id: 42,
    name: 'Feedback Template',
    description:
      'Collect and organise valuable customer feedback with a ready-to-use Glide app',
    link: 'https://www.glideapps.com/templates/feedback-fy',
  },
  {
    id: 43,
    name: 'Ultimate Wealth Distribution Template',
    description:
      'Track your investments, assets, debts, and expenses in one powerful Glide app',
    link: 'https://www.glideapps.com/templates/ultimate-wealth-distribution-jd',
  },
  {
    id: 44,
    name: "Clyde's newsletter",
    description: 'Sign up for a freebie and get the occasional email from me',
    link: 'https://clyde-dsouza.kit.com/newsletter',
  },
  {
    id: 45,
    name: 'ThorData',
    description:
      'Access scalable proxy infrastructure for reliable global web data collection and AI data workflows. Try ThorData',
    link: 'https://affiliate.thordata.com/3d50l61160s0',
  },
  {
    id: 46,
    name: 'Wegic',
    description:
      'Build websites with conversational AI, payments, lead capture, and automated optimisation. Try Wegic',
    link: 'https://try.wegic.ai/8wlhdjr92v60',
  },
  {
    id: 47,
    name: 'X ClydeDz',
    description:
      "Follow me on X.com for thoughts, projects, and things I'm building.",
    link: 'https://x.com/ClydeDz',
  },
  {
    id: 48,
    name: "Ko-fi Clyde D'Souza",
    description:
      'Enjoyed my work? Buy me a coffee and help support the next project.',
    link: 'https://ko-fi.com/clydedsouza',
  },
  {
    id: 49,
    name: 'Udemy Demystifying Markdown',
    description:
      'Learn GitHub Flavored Markdown and explore markdown in the AI era. Buy my class from Udemy.',
    link: 'https://www.udemy.com/course/demystifying-markdown/?referralCode=094FC640B252651808D0',
  },
];

export default ADS;
