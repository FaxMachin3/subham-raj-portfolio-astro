export const site = {
  name: 'Subham Raj',
  role: 'Senior Frontend Engineer',
  /** Homepage <title>: name first, then the searches it should be found for (≤ 60 characters). */
  title: 'Subham Raj · Senior Frontend Engineer, React & Performance',
  location: 'Bhubaneswar, India',
  workMode: 'Remote · open to relocation',
  availability: 'Available immediately',
  /** Titles vary by company for the same level; the role above stays the one actually held. */
  seeking: 'senior, staff or lead frontend roles',
  email: 'subhamraj4114@gmail.com',
  url: 'https://subhamraj.dev',
  description:
    'Subham Raj is a senior frontend engineer: 8 years of React and TypeScript, building data-heavy and AI product interfaces that are fast and accessible. Break this site, then watch him fix it.',
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
