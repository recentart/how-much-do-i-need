import { fmt, fmtUp, plural } from '../lib/units.mjs';
import { extraField, pct, factor } from './_shared.mjs';

// Typical data use per hour (GB) and speed per simultaneous activity (Mbps). Streaming figures follow
// what major services publish (for example about 1 GB/h for SD video, 3 GB/h for HD and 7 GB/h for 4K,
// and roughly 5 Mbps for HD and 15 Mbps for 4K). The others are common planning figures.
export const ACTIVITIES = [
  { id: 'hd', label: 'HD video streaming', gbPerHour: 3, mbps: 5, hours: 3, atOnce: 1 },
  { id: 'uhd', label: '4K video streaming', gbPerHour: 7, mbps: 15, hours: 0, atOnce: 0 },
  { id: 'sd', label: 'Short videos and social media', gbPerHour: 1, mbps: 3, hours: 1, atOnce: 1 },
  { id: 'calls', label: 'Video calls', gbPerHour: 1.5, mbps: 4, hours: 1, atOnce: 1 },
  { id: 'gaming', label: 'Online gaming (playing, not downloading)', gbPerHour: 0.1, mbps: 3, hours: 1, atOnce: 0 },
  { id: 'music', label: 'Music streaming', gbPerHour: 0.15, mbps: 0.5, hours: 2, atOnce: 1 },
  { id: 'web', label: 'Web, email and apps', gbPerHour: 0.15, mbps: 1, hours: 2, atOnce: 1 },
];

export const SPEED_TIERS = [25, 50, 100, 200, 300, 500, 1000, 2000];
const DAYS_PER_MONTH = 365 / 12;

export default {
  id: 'internet',
  slug: 'internet-speed-data-calculator',
  name: 'Internet Speed and Data Calculator',
  question: 'How much internet speed and data do I need?',
  category: 'digital',
  keywords: 'internet speed bandwidth Mbps data plan GB per month broadband wifi streaming netflix 4K video calls gaming mobile data usage',
  title: 'Internet Speed and Data Calculator: How Much Do I Need?',
  description:
    'Free internet calculator. Enter what your household streams, plays and calls to see the download speed (Mbps) and monthly data (GB) your plan should have.',
  summary: 'Download speed (Mbps) and monthly data (GB) for your household’s streaming and calls.',
  intro:
    'Enter roughly how many hours a day your household spends on each activity, and how many of each happen at the same time at the busiest moment. The calculator estimates your monthly data use and the speed you need.',
  groups: [
    { id: 'hours', legend: 'Hours per day (whole household)' },
    { id: 'peak', legend: 'At the busiest time, how many at once?' },
    { id: 'more', legend: 'Downloads and headroom' },
  ],
  inputs: [
    ...ACTIVITIES.map((a) => ({ name: `${a.id}Hours`, group: 'hours', type: 'number', label: `${a.label} (hours a day)`, default: a.hours, min: 0, max: 24 * 20 })),
    ...ACTIVITIES.map((a) => ({ name: `${a.id}AtOnce`, group: 'peak', type: 'count', label: `${a.label} (at once)`, default: a.atOnce, max: 100 })),
    {
      name: 'downloads',
      group: 'more',
      type: 'measure',
      dim: 'data',
      units: ['GB', 'MB', 'TB'],
      label: 'Big downloads per month',
      min: 0,
      default: { any: [20, 'GB'] },
      help: 'Game and software updates, film downloads and cloud backups. A single large game can be 50–150 GB.',
    },
    extraField('headroom', 'Headroom', 25, 'Room for busy days, more people and future use.', { group: 'more' }),
  ],

  compute(v) {
    let dailyGb = 0;
    let peakMbps = 0;
    const parts = ACTIVITIES.map((a) => {
      const gb = v[`${a.id}Hours`] * a.gbPerHour;
      const mbps = v[`${a.id}AtOnce`] * a.mbps;
      dailyGb += gb;
      peakMbps += mbps;
      return { ...a, hours: v[`${a.id}Hours`], atOnce: v[`${a.id}AtOnce`], gb, mbpsTotal: mbps };
    });
    const downloadsGb = v.downloads / 1e9;
    const monthlyGb = dailyGb * DAYS_PER_MONTH + downloadsGb;
    if (monthlyGb <= 0 && peakMbps <= 0) return { error: 'Enter at least one activity to see an estimate.' };
    const k = 1 + v.headroom / 100;
    const dataPlanGb = Math.ceil(monthlyGb * k - 1e-9);
    const speedNeeded = peakMbps * k;
    const tier = SPEED_TIERS.find((t) => t + 1e-9 >= speedNeeded) ?? null;
    return { ...v, parts, dailyGb, downloadsGb, monthlyGb, dataPlanGb, peakMbps, speedNeeded, tier, k };
  },

  present(r) {
    const speedText = r.tier ? `${fmt(r.tier, 0)} Mbps` : `over ${fmt(SPEED_TIERS[SPEED_TIERS.length - 1], 0)} Mbps`;
    return {
      headline: {
        label: 'Plan to look for',
        value: `${speedText} · ${fmt(r.dataPlanGb, 0)} GB a month`,
        detail: `You use about ${fmt(r.monthlyGb, 0)} GB a month and up to ${fmt(r.peakMbps, 1)} Mbps at once; both include ${pct(r.headroom)} headroom in the plan.`,
      },
      sections: [
        {
          title: 'Estimated amount to buy',
          kind: 'buy',
          rows: [
            { label: 'Download speed', value: speedText, strong: true },
            { label: 'Monthly data', value: `${fmt(r.dataPlanGb, 0)} GB (or an unlimited plan)`, strong: true },
            { label: `Speed needed with ${pct(r.headroom)} headroom`, value: `${fmtUp(r.speedNeeded, 1)} Mbps` },
          ],
        },
        {
          title: 'Calculated quantity (no headroom)',
          kind: 'exact',
          rows: [
            ...r.parts.filter((p) => p.gb > 0).map((p) => ({ label: `${p.label}: ${fmt(p.hours, 2)} h a day`, value: `${fmt(p.gb * DAYS_PER_MONTH, 1)} GB a month` })),
            ...(r.downloadsGb > 0 ? [{ label: 'Big downloads', value: `${fmt(r.downloadsGb, 1)} GB a month` }] : []),
            { label: 'Monthly data', value: `${fmt(r.monthlyGb, 1)} GB`, strong: true },
            { label: 'Busiest-time speed', value: `${fmt(r.peakMbps, 1)} Mbps`, strong: true },
          ],
        },
      ],
      steps: [
        `Daily data = ${r.parts.filter((p) => p.hours > 0).map((p) => `${fmt(p.hours, 2)} h × ${fmt(p.gbPerHour, 2)} GB`).join(' + ') || '0'} = ${fmt(r.dailyGb, 2)} GB`,
        `Monthly data = ${fmt(r.dailyGb, 2)} GB × ${fmt(DAYS_PER_MONTH, 2)} days + ${fmt(r.downloadsGb, 1)} GB downloads = ${fmt(r.monthlyGb, 1)} GB`,
        `With ${pct(r.headroom)} headroom = ${fmt(r.monthlyGb, 1)} × ${factor(r.headroom)} = ${fmtUp(r.monthlyGb * r.k, 1)}, rounded up to ${fmt(r.dataPlanGb, 0)} GB`,
        `Busiest time = ${r.parts.filter((p) => p.atOnce > 0).map((p) => `${p.atOnce} × ${fmt(p.mbps, 1)} Mbps`).join(' + ') || '0'} = ${fmt(r.peakMbps, 1)} Mbps`,
        `With ${pct(r.headroom)} headroom = ${fmtUp(r.speedNeeded, 1)} Mbps; ${r.tier ? `the next common plan speed is ${speedText}` : 'more than common home plans offer'}`,
      ],
      notes: [
        'Wi-Fi often delivers less than the plan speed, especially far from the router. If your connection feels slow, the router’s position can matter as much as the plan.',
        'Upload speed matters for video calls and cloud backups. Many cable plans have much slower upload than download.',
      ],
    };
  },

  content: [
    {
      heading: 'How the internet calculation works',
      html: `<ol>
  <li><strong>Monthly data</strong> = the sum of (hours per day × data per hour) for each activity × 30.4 days, plus big downloads.</li>
  <li><strong>Speed</strong> = the sum of (activities at the same time × the speed each needs) at your busiest moment.</li>
  <li>Both get the headroom added. Data is rounded up to a whole GB, and speed goes up to the next common plan speed (25, 50, 100, 200, 300, 500, 1,000 or 2,000 Mbps).</li>
</ol>`,
    },
    {
      heading: 'The figures used',
      html: `<table class="data-table">
  <thead><tr><th scope="col">Activity</th><th scope="col">Data per hour</th><th scope="col">Speed each</th></tr></thead>
  <tbody>
${ACTIVITIES.map((a) => `    <tr><th scope="row">${a.label}</th><td>${a.gbPerHour} GB</td><td>${a.mbps} Mbps</td></tr>`).join('\n')}
  </tbody>
</table>
<p>Video figures are close to what major streaming services publish; actual use depends on the service, the device and its quality setting. The other figures are common planning estimates. Many services lower quality automatically on slow connections, so they use less.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>Monthly data is rounded <em>up</em> to a whole GB after headroom.</li>
  <li>Speed is matched to the next common plan speed <em>up</em>.</li>
</ul>`,
    },
  ],
};
