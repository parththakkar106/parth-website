// Writes public/data/contributions.json from the GitHub contribution calendar.
// Run by .github/workflows/contributions.yml every night. Needs GH_TOKEN in the environment.
// Private contributions are counted because "Include private contributions" is on in the GitHub profile.
//   node scripts/fetch-contributions.mjs            real data (needs GH_TOKEN)
//   node scripts/fetch-contributions.mjs --sample   placeholder data for local work
import { writeFileSync, mkdirSync } from 'node:fs';

const LOGIN = process.env.GH_LOGIN || 'parththakkar106';
const OUT = new URL('../public/data/contributions.json', import.meta.url);

function sampleWeeks() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const weeks = [];
  for (let w = 0; w < 52; w++) {
    const ramp = 0.25 + 0.75 * (w / 52);
    const wk = [];
    for (let d = 0; d < 7; d++) {
      const r = rnd() * ramp * (d === 0 || d === 6 ? 1.4 : 0.9);
      wk.push(r < 0.18 ? 0 : Math.round(r * 14));
    }
    weeks.push(wk);
  }
  return weeks;
}

async function realWeeks() {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error('GH_TOKEN is not set');
  const query = `query($login: String!) { user(login: $login) { contributionsCollection {
    contributionCalendar { totalContributions weeks { contributionDays { contributionCount date } } } } } }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'parth.party' },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  const cal = body.data.user.contributionsCollection.contributionCalendar;
  const last = cal.weeks.at(-1).contributionDays.at(-1);
  return { weeks: cal.weeks.map(w => w.contributionDays.map(d => d.contributionCount)), total: cal.totalContributions, end: last.date };
}

const sample = process.argv.includes('--sample');
const data = sample ? { weeks: sampleWeeks() } : await realWeeks();
const total = data.total ?? data.weeks.flat().reduce((a, b) => a + b, 0);
mkdirSync(new URL('.', OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ sample, login: LOGIN, updated: new Date().toISOString().slice(0, 10), total, ...(data.end && { end: data.end }), weeks: data.weeks }) + '\n');
console.log(`${sample ? 'sample' : 'real'}: ${total} contributions over ${data.weeks.length} weeks`);
