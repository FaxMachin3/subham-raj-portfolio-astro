export const site = {
  name: 'Subham Raj',
  role: 'Senior Frontend Engineer',
  location: 'Bengaluru, India',
  email: 'subhamraj4114@gmail.com',
  url: 'https://subhamraj.dev',
  description:
    'Subham Raj, Senior Frontend Engineer. 8 years of React and TypeScript. Break this site, then watch him fix it: every number is measured live in your browser.',
  links: {
    linkedin: 'https://www.linkedin.com/in/subhamraj/',
    github: 'https://github.com/FaxMachin3',
    resumePdf: '/resume/Subham_Raj_Resume.pdf',
  },
} as const;

export const skills = [
  {
    group: 'Frontend',
    items: [
      'React',
      'Next.js',
      'TypeScript',
      'JavaScript',
      'HTML',
      'CSS',
      'Redux',
      'Zustand',
      'React Query',
      'Vite',
    ],
  },
  {
    group: 'UI systems',
    items: ['Radix UI', 'Tailwind CSS', 'Design systems', 'Storybook', 'micro-frontends'],
  },
  {
    group: 'Performance & accessibility',
    items: ['Code splitting', 'Virtualization', 'Profiling', 'WCAG', 'ARIA', 'i18n'],
  },
  { group: 'Data & APIs', items: ['KeyLines', 'D3', 'GraphQL', 'Apollo Client', 'REST', 'OpenAPI'] },
  {
    group: 'Quality & tooling',
    items: ['Jest', 'React Testing Library', 'Playwright', 'GitHub Actions', 'Cursor', 'Claude Code'],
  },
] as const;
