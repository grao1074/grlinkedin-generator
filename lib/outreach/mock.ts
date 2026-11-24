import type { Deps } from './deps';
import type { SheetRow } from './google';
import { buildMime } from './mime';

/**
 * Demo mode (OUTREACH_MOCK=1). Made-up people and companies so you can try
 * the whole flow, and so automated tests run without any keys. Nothing here
 * calls Apify, Google or an AI service, and no email is sent.
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DELAY = Number(process.env.OUTREACH_MOCK_DELAY_MS ?? 400);

const SHEET: string[][] = [
  ['First Name', 'Last Name', 'Company', 'Email'],
  ['Amara', 'Okafor', 'Northbridge Memory Clinic', 'amara.okafor@example.com'],
  ['John', 'Smith', 'Walmart', 'john.smith@example.com'],
  ['Priya', 'Raman', 'Silverline Care Labs', 'priya@example.org'],
  ['Amara', 'Okafor', 'Northbridge Memory Clinic', 'AMARA.OKAFOR@example.com'],
  ['No', 'Email', 'Somewhere Ltd', ''],
];

const SEARCH: Record<string, { url: string; title: string; description: string }[]> = {
  okafor: [
    {
      url: 'https://uk.linkedin.com/in/amara-okafor-demo',
      title: 'Amara Okafor - Consultant Old Age Psychiatrist - Northbridge Memory Clinic | LinkedIn',
      description: 'Consultant old age psychiatrist at Northbridge Memory Clinic. Leads a pilot using speech analysis for early dementia screening.',
    },
    {
      url: 'https://www.linkedin.com/posts/amara-okafor-demo_activity-123',
      title: 'Post by Amara Okafor',
      description: 'Not a profile page, so it is filtered out.',
    },
  ],
  smith: [
    {
      url: 'https://www.linkedin.com/in/john-smith-demo-1',
      title: 'John Smith - Store Manager - Tesco | LinkedIn',
      description: 'Store manager in Leeds.',
    },
    {
      url: 'https://www.linkedin.com/in/john-smith-demo-2/',
      title: 'John Smith - Software Engineer | LinkedIn',
      description: 'Engineer working on retail pricing systems.',
    },
    {
      url: 'https://www.linkedin.com/in/john-smith-demo-3',
      title: 'John Smith - Regional Director - Walmart | LinkedIn',
      description: 'Regional director at Walmart, health and wellness.',
    },
    {
      url: 'https://www.linkedin.com/in/john-smith-demo-4',
      title: 'John Smith - Pharmacist - Walmart | LinkedIn',
      description: 'Pharmacist at Walmart.',
    },
  ],
  raman: [
    {
      url: 'https://www.linkedin.com/in/priya-raman-demo?trk=public',
      title: 'Priya Raman – Head of Research – Silverline Care Labs | LinkedIn',
      description: 'Head of research at Silverline Care Labs, building tools for caregivers of people with dementia.',
    },
  ],
};

const PROFILES: Record<string, unknown> = {
  'https://www.linkedin.com/in/amara-okafor-demo': {
    basic_info: {
      fullname: 'Amara Okafor',
      headline: 'Consultant Old Age Psychiatrist | Digital biomarkers for dementia',
      about: 'I run the memory service at Northbridge and lead a pilot that uses short speech recordings to flag early cognitive change.',
      location: { full: 'Manchester, United Kingdom' },
      current_company: 'Northbridge Memory Clinic',
      current_company_url: 'https://www.linkedin.com/company/northbridge-memory-clinic-demo',
    },
    experience: [
      {
        title: 'Consultant Old Age Psychiatrist',
        company: 'Northbridge Memory Clinic',
        description: 'Clinical lead for the speech-analysis screening pilot (120 patients so far).',
        duration: 'Mar 2019 - Present',
        is_current: true,
        company_linkedin_url: 'https://www.linkedin.com/company/northbridge-memory-clinic-demo/',
      },
    ],
    education: [{ school: 'University of Manchester', degree: 'MBChB' }],
  },
  'https://www.linkedin.com/in/john-smith-demo-3': {
    basic_info: {
      fullname: 'John Smith',
      headline: 'Regional Director, Health & Wellness at Walmart',
      about: '',
      current_company: 'Walmart',
      current_company_url: 'https://www.linkedin.com/company/walmart-demo',
    },
    experience: [],
  },
  'https://www.linkedin.com/in/priya-raman-demo': {
    basic_info: {
      fullname: 'Priya Raman',
      headline: 'Head of Research at Silverline Care Labs',
      about: 'Building practical tools for family caregivers of people living with dementia.',
      current_company: '',
      current_company_url: '',
    },
    experience: [
      {
        title: 'Head of Research',
        company: 'Silverline Care Labs',
        description: 'Leads user research with caregivers across three countries.',
        duration: '2022 - Present',
        is_current: true,
        company_linkedin_url: '',
      },
    ],
  },
};

const COMPANIES: Record<string, unknown> = {
  'https://www.linkedin.com/company/northbridge-memory-clinic-demo': {
    basic_info: {
      name: 'Northbridge Memory Clinic',
      description: 'A specialist memory assessment service for older adults.',
      website: 'https://example.com/northbridge',
      industries: ['Hospitals and Health Care'],
      specialties: ['Dementia assessment', 'Old age psychiatry'],
    },
    stats: { employee_count: 85 },
    locations: { headquarters: { city: 'Manchester', country: 'GB' } },
  },
  'https://www.linkedin.com/company/silverline-care-labs-demo': {
    basic_info: {
      name: 'Silverline Care Labs',
      description: 'Research studio making digital support tools for dementia caregivers.',
      industries: ['Research Services'],
      specialties: ['Caregiver support', 'User research'],
    },
    stats: { employee_count: 24 },
    locations: { headquarters: { city: 'London', country: 'GB' } },
  },
};

interface MockState {
  grid: string[][];
  sent: { to: string; subject: string; raw: string }[];
}

const g = globalThis as unknown as { __outreachMock?: MockState };

export function mockState(): MockState {
  g.__outreachMock ??= { grid: SHEET.map((r) => [...r]), sent: [] };
  return g.__outreachMock;
}

function draftFor(userMessage: string): string {
  const match = userMessage.match(/<lead_data>\n([\s\S]*)\n<\/lead_data>/);
  const data = match ? (JSON.parse(match[1]) as { lead: { firstName: string }; profile: { headline?: string } | null }) : null;
  const first = data?.lead.firstName ?? 'there';
  const headline = data?.profile?.headline;
  return JSON.stringify({
    subject: `A question about your work, ${first}`,
    body: headline
      ? `Hi ${first},\n\nI saw that you describe your work as "${headline}". That is close to what my audience asks me about.\n\nWould you be open to a short conversation?`
      : `Hi ${first},\n\nI'm reaching out because your work looks relevant to my audience.\n\nWould you be open to a short conversation?`,
    factsUsed: headline ? [{ fact: headline, source: 'profile.headline' }] : [],
  });
}

export function mockDeps(): Deps {
  const state = mockState();
  return {
    async searchPeople(_first, last) {
      await wait(DELAY);
      return SEARCH[last.toLowerCase()] ?? [];
    },
    async searchCompanies(company) {
      await wait(DELAY);
      return company.toLowerCase().includes('silverline')
        ? [
            { url: 'https://www.linkedin.com/company/silverline-care-labs-demo/', title: 'Silverline Care Labs | LinkedIn', description: '' },
          ]
        : [];
    },
    async fetchProfile(url) {
      await wait(DELAY);
      return PROFILES[url] ?? null;
    },
    async fetchCompany(url) {
      await wait(DELAY);
      return COMPANIES[url] ?? null;
    },
    async chat(messages) {
      await wait(DELAY);
      return draftFor(messages[messages.length - 1]?.content ?? '');
    },
    sheet: {
      async readRows() {
        const [headers, ...rest] = state.grid;
        return rest
          .map((cells, i): SheetRow => ({
            row: i + 2,
            values: Object.fromEntries(headers.map((h, c) => [h, cells[c] ?? ''])),
          }))
          .filter((r) => Object.values(r.values).some(Boolean));
      },
      async updateRow(row, values) {
        const headers = state.grid[0];
        for (const [name, value] of Object.entries(values)) {
          let col = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
          if (col === -1) {
            col = headers.length;
            headers.push(name);
          }
          const r = state.grid[row - 1];
          while (r.length <= col) r.push('');
          r[col] = value;
        }
      },
    },
    async sendMail(input) {
      await wait(DELAY);
      state.sent.push({ to: input.to, subject: input.subject, raw: buildMime(input) });
      return `mock-${state.sent.length}`;
    },
  };
}
