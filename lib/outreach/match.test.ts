import { describe, expect, test } from 'bun:test';
import {
  buildCandidates,
  companyUrlFromProfile,
  normalizeCompanyUrl,
  normalizePersonUrl,
  parseResultTitle,
  pickCompanyResult,
  pickConfident,
  scoreCandidate,
  summarizeCompany,
  summarizeProfile,
} from './match';

describe('LinkedIn URLs', () => {
  test('normalises profile URLs from any LinkedIn host', () => {
    expect(normalizePersonUrl('https://www.linkedin.com/in/jane-doe/')).toBe('https://www.linkedin.com/in/jane-doe');
    expect(normalizePersonUrl('https://uk.linkedin.com/in/jane-doe')).toBe('https://www.linkedin.com/in/jane-doe');
    expect(normalizePersonUrl('https://linkedin.com/in/jane%C3%A9?trk=x')).toBe('https://www.linkedin.com/in/jane%C3%A9');
  });
  test('rejects non-profile pages and look-alike hosts', () => {
    expect(normalizePersonUrl('https://www.linkedin.com/posts/jane-doe_123')).toBeNull();
    expect(normalizePersonUrl('https://www.linkedin.com/in/jane-doe/details/experience')).toBeNull();
    expect(normalizePersonUrl('https://linkedin.com.evil.example/in/jane')).toBeNull();
    expect(normalizePersonUrl('javascript:alert(1)//linkedin.com/in/x')).toBeNull();
    expect(normalizePersonUrl('https://www.linkedin.com/company/acme')).toBeNull();
  });
  test('company URLs are separate from people', () => {
    expect(normalizeCompanyUrl('https://www.linkedin.com/company/acme/')).toBe('https://www.linkedin.com/company/acme');
    expect(normalizeCompanyUrl('https://www.linkedin.com/in/acme')).toBeNull();
  });
});

describe('matching', () => {
  const lead = { firstName: 'John', lastName: 'Smith', company: 'Walmart' };

  test('parses search result titles', () => {
    expect(parseResultTitle('Jane Doe - Consultant - Acme | LinkedIn')).toEqual({ name: 'Jane Doe', headline: 'Consultant - Acme' });
    expect(parseResultTitle('Jane Doe – Lead · LinkedIn')).toEqual({ name: 'Jane Doe', headline: 'Lead' });
  });

  test('right name at the wrong company does not reach the threshold', () => {
    const wrong = scoreCandidate(lead, { name: 'John Smith', headline: 'Manager - Tesco', snippet: '' });
    const right = scoreCandidate(lead, { name: 'John Smith', headline: 'Director - Walmart', snippet: '' });
    expect(wrong).toBe(0.6);
    expect(right).toBe(1);
  });

  test('accents and case do not matter', () => {
    expect(scoreCandidate({ firstName: 'José', lastName: 'Núñez', company: 'Acme Ltd' }, { name: 'jose nunez', headline: 'ACME', snippet: '' })).toBe(1);
  });

  test('buildCandidates keeps profile pages only, de-duplicates, sorts and caps at 3', () => {
    const c = buildCandidates(lead, [
      { url: 'https://www.linkedin.com/in/js1', title: 'John Smith - Tesco | LinkedIn', description: '' },
      { url: 'https://www.linkedin.com/in/js2', title: 'John Smith - Walmart | LinkedIn', description: '' },
      { url: 'https://uk.linkedin.com/in/js2/', title: 'John Smith - Walmart | LinkedIn', description: '' },
      { url: 'https://www.linkedin.com/posts/x', title: 'post', description: '' },
      { url: 'https://www.linkedin.com/in/js3', title: 'Someone Else | LinkedIn', description: '' },
      { url: 'https://www.linkedin.com/in/js4', title: 'John Smith | LinkedIn', description: '' },
    ]);
    expect(c.map((x) => x.url)).toEqual([
      'https://www.linkedin.com/in/js2',
      'https://www.linkedin.com/in/js1',
      'https://www.linkedin.com/in/js4',
    ]);
  });

  test('pickConfident refuses when two candidates both look right', () => {
    const one = { url: 'a', name: '', headline: '', snippet: '', score: 1 };
    const two = { ...one, url: 'b' };
    expect(pickConfident([one], 0.8)).toEqual(one);
    expect(pickConfident([one, two], 0.8)).toBeNull();
    expect(pickConfident([{ ...one, score: 0.6 }], 0.8)).toBeNull();
    expect(pickConfident([], 0.8)).toBeNull();
  });

  test('pickCompanyResult needs the company name to match', () => {
    const results = [
      { url: 'https://www.linkedin.com/company/other-co', title: 'Other Co', description: '' },
      { url: 'https://www.linkedin.com/company/acme-health', title: 'Acme Health | LinkedIn', description: '' },
    ];
    expect(pickCompanyResult('Acme Health', results)).toBe('https://www.linkedin.com/company/acme-health');
    expect(pickCompanyResult('Nothing Matches', results)).toBeNull();
  });
});

describe('summaries', () => {
  test('profile summary handles missing fields and caps lengths', () => {
    const p = summarizeProfile({ basic_info: { first_name: 'A', last_name: 'B', about: 'x'.repeat(5000) } }, 'u');
    expect(p.fullName).toBe('A B');
    expect(p.about.length).toBe(1500);
    expect(p.experience).toEqual([]);
    expect(summarizeProfile(null, 'u').fullName).toBe('');
  });

  test('company website must be http(s)', () => {
    expect(summarizeCompany({ basic_info: { name: 'X', website: 'javascript:alert(1)' } }, 'u').website).toBe('');
    expect(summarizeCompany({ basic_info: { name: 'X', website: 'https://x.example' } }, 'u').website).toBe('https://x.example');
  });

  test('company URL comes from a matching current role when the headline company differs', () => {
    const profile = summarizeProfile(
      {
        basic_info: { fullname: 'A', current_company: 'Side Project', current_company_url: 'https://www.linkedin.com/company/side' },
        experience: [
          { company: 'Acme Health', is_current: true, company_linkedin_url: 'https://www.linkedin.com/company/123/' },
        ],
      },
      'u'
    );
    expect(companyUrlFromProfile(profile, 'Acme Health')).toBe('https://www.linkedin.com/company/123');
    expect(companyUrlFromProfile(profile, 'Unrelated Inc')).toBeNull();
  });
});
