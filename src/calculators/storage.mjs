import { fmt, fmtUp, fromBase } from '../lib/units.mjs';
import { extraField } from './_shared.mjs';

const DATA_UNITS = ['KB', 'MB', 'GB', 'TB'];
const GB = 1e9;
const GIB = 2 ** 30;

// Capacities drives, cards and phones are commonly sold in (decimal GB).
export const STANDARD_SIZES_GB = [16, 32, 64, 128, 256, 512, 1000, 2000, 4000, 5000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000, 22000, 24000];

export function sizeLabel(gb) {
  return gb >= 1000 ? `${fmt(gb / 1000, 2)} TB` : `${fmt(gb, 0)} GB`;
}

// Bytes shown in the most readable decimal unit: 950 MB, 30.5 GB, 1.2 TB.
export function bytesText(bytes) {
  if (bytes >= 1e12) return `${fmt(bytes / 1e12, 2)} TB`;
  if (bytes >= 1e9) return `${fmt(bytes / 1e9, 2)} GB`;
  if (bytes >= 1e6) return `${fmt(bytes / 1e6, 1)} MB`;
  return `${fmt(bytes / 1e3, 1)} KB`;
}

// A per-file size exactly as precise as someone would type it (2.75 MB stays 2.75 MB).
function sizeText(bytes) {
  if (bytes >= 1e12) return `${fmt(bytes / 1e12, 3)} TB`;
  if (bytes >= 1e9) return `${fmt(bytes / 1e9, 3)} GB`;
  if (bytes >= 1e6) return `${fmt(bytes / 1e6, 3)} MB`;
  return `${fmt(bytes / 1e3, 3)} KB`;
}

// The space needed is what gets rounded up to a drive size, so it is shown rounded up too.
function neededText(bytes) {
  if (bytes >= 1e12) return `${fmtUp(bytes / 1e12, 2)} TB`;
  if (bytes >= 1e9) return `${fmtUp(bytes / 1e9, 2)} GB`;
  return `${fmtUp(bytes / 1e6, 1)} MB`;
}

// How Windows reports a drive of this many decimal GB (it counts in powers of 1,024).
function windowsSize(gb) {
  const bytes = gb * GB;
  return bytes >= 2 ** 40 ? `${fmt(bytes / 2 ** 40, 2)} TB` : `${fmt(bytes / GIB, 1)} GB`;
}

const dataField = (name, label, value, unit, extra = {}) => ({
  name,
  label,
  type: 'measure',
  dim: 'data',
  units: DATA_UNITS,
  min: 0,
  default: { any: [value, unit] },
  ...extra,
});

export default {
  id: 'storage',
  slug: 'storage-calculator',
  name: 'Storage Calculator',
  question: 'How much storage do I need?',
  category: 'digital',
  keywords:
    'storage space photos pictures videos music songs files gigabytes gb terabytes tb megabytes mb hard drive ssd sd card memory card phone iphone android cloud backup',
  title: 'Storage Calculator: How Much Storage Do I Need for Photos & Video?',
  description:
    'Free storage calculator. Enter how many photos, videos and songs you have to see the total in MB, GB and TB, and what size of drive, card or phone to get.',
  summary: 'Total space for photos, videos, music and files in MB, GB and TB, and a drive size.',
  intro:
    'Enter roughly how many photos, videos and songs you have (or plan to store) and their average size. The calculator adds them up, leaves room to spare, and suggests a standard storage size.',
  groups: [
    { id: 'photos', legend: 'Photos' },
    { id: 'videos', legend: 'Videos' },
    { id: 'music', legend: 'Music and other files' },
    { id: 'plan', legend: 'Free space' },
  ],
  inputs: [
    { name: 'photos', group: 'photos', type: 'count', label: 'Number of photos', default: 5000, max: 1e9 },
    dataField('photoSize', 'Average photo size', 3, 'MB', {
      group: 'photos',
      help: 'A typical phone photo is roughly 2–5 MB. RAW camera files are often 20 MB or more.',
    }),
    { name: 'videos', group: 'videos', type: 'count', label: 'Number of videos', default: 100, max: 1e9 },
    dataField('videoSize', 'Average video size', 150, 'MB', {
      group: 'videos',
      help: 'Phones typically record roughly 60–130 MB per minute of 1080p video and 170–400 MB per minute of 4K. Multiply by your usual clip length.',
    }),
    { name: 'songs', group: 'music', type: 'count', label: 'Number of songs', default: 0, max: 1e9 },
    dataField('songSize', 'Average song size', 7, 'MB', {
      group: 'music',
      help: 'A 3½-minute song is about 3.4 MB at 128 kbps and 6.7 MB at 256 kbps.',
    }),
    dataField('otherFiles', 'Other files (total)', 0, 'GB', { group: 'music', help: 'Documents, apps, games or anything else, as one total.' }),
    extraField('headroom', 'Free space to keep (% of the drive)', 20, 'Full drives and phones slow down and can’t install updates. Keeping 10–20% of the drive free is a common target.', {
      group: 'plan',
      max: 90,
    }),
  ],

  compute(v) {
    const photoBytes = v.photos * v.photoSize;
    const videoBytes = v.videos * v.videoSize;
    const songBytes = v.songs * v.songSize;
    const total = photoBytes + videoBytes + songBytes + v.otherFiles;
    if (total <= 0) return { error: 'Enter at least one photo, video, song or file to see an estimate.' };
    // Keeping h% of the drive free means the files may fill only (100 − h)% of it.
    const needed = total / (1 - v.headroom / 100);
    const neededGb = needed / GB;
    const recommendedGb = STANDARD_SIZES_GB.find((gb) => gb + 1e-9 >= neededGb) ?? null;
    return { ...v, photoBytes, videoBytes, songBytes, total, needed, recommendedGb };
  },

  present(r) {
    const headline = r.recommendedGb
      ? {
          label: 'Storage to get',
          value: sizeLabel(r.recommendedGb),
          detail: `Your files total ${bytesText(r.total)}. With ${fmt(r.headroom, 2)}% of the drive kept free you need ${neededText(r.needed)}.`,
        }
      : {
          label: 'Storage to get',
          value: neededText(r.needed),
          detail: `That is more than the largest single drive on our list (24 TB), so plan for several drives or a larger system.`,
        };
    const buyRows = [
      { label: 'Suggested size', value: r.recommendedGb ? sizeLabel(r.recommendedGb) : 'Over 24 TB', strong: true },
      { label: `Space needed with ${fmt(r.headroom, 2)}% of the drive free`, value: neededText(r.needed) },
    ];
    if (r.recommendedGb) {
      buyRows.push({ label: `Windows shows ${sizeLabel(r.recommendedGb)} as about`, value: windowsSize(r.recommendedGb) });
    }
    const itemRows = [
      { label: `Photos (${fmt(r.photos, 0)} × ${sizeText(r.photoSize)})`, value: bytesText(r.photoBytes) },
      { label: `Videos (${fmt(r.videos, 0)} × ${sizeText(r.videoSize)})`, value: bytesText(r.videoBytes) },
    ];
    if (r.songs) itemRows.push({ label: `Songs (${fmt(r.songs, 0)} × ${sizeText(r.songSize)})`, value: bytesText(r.songBytes) });
    if (r.otherFiles) itemRows.push({ label: 'Other files', value: bytesText(r.otherFiles) });

    const steps = [
      `Photos = ${fmt(r.photos, 0)} × ${sizeText(r.photoSize)} = ${bytesText(r.photoBytes)}`,
      `Videos = ${fmt(r.videos, 0)} × ${sizeText(r.videoSize)} = ${bytesText(r.videoBytes)}`,
      `Songs = ${fmt(r.songs, 0)} × ${sizeText(r.songSize)} = ${bytesText(r.songBytes)}`,
      `Total = photos + videos + songs + ${bytesText(r.otherFiles)} other = ${bytesText(r.total)}`,
      `With ${fmt(r.headroom, 2)}% of the drive kept free = ${bytesText(r.total)} ÷ ${fmt(1 - r.headroom / 100, 4)} = ${neededText(r.needed)}`,
      r.recommendedGb
        ? `Smallest common size that fits = ${sizeLabel(r.recommendedGb)}`
        : 'No single common size fits, so the exact figure is shown',
    ];

    return {
      headline,
      sections: [
        { title: 'Suggested storage', kind: 'buy', rows: buyRows },
        {
          title: 'Calculated total (no free space)',
          kind: 'exact',
          rows: [
            ...itemRows,
            { label: 'Total in MB', value: `${fmt(fromBase(r.total, 'data', 'MB'), 0)} MB`, strong: true },
            { label: 'Total in GB', value: `${fmt(fromBase(r.total, 'data', 'GB'), 2)} GB`, strong: true },
            { label: 'Total in TB', value: `${fmt(fromBase(r.total, 'data', 'TB'), 3)} TB`, strong: true },
          ],
        },
      ],
      steps,
      notes: [
        'Sizes here use decimal units (1 GB = 1,000 MB), as drive and phone makers do. Windows counts 1 GB as 1,073,741,824 bytes, so it shows the same data as a slightly smaller number.',
        'A backup drive needs at least as much space as everything it backs up, plus room for older versions if your backup software keeps them.',
      ],
    };
  },

  content: [
    {
      heading: 'How the storage calculation works',
      html: `<ol>
  <li>For each type of file, <strong>space = number of files × average size</strong>.</li>
  <li><strong>Total</strong> = photos + videos + songs + other files.</li>
  <li><strong>Allow for free space</strong>: total ÷ (1 − free space ÷ 100). To keep 20% of a drive empty, your files can fill only 80% of it, so the drive must be total ÷ 0.8.</li>
  <li><strong>Suggested size</strong> = the smallest common capacity (16 GB, 32 GB, 64 GB … 1 TB, 2 TB and so on) that holds the total with free space.</li>
</ol>`,
    },
    {
      heading: 'Finding your average file sizes',
      html: `<p>File sizes vary a lot with the camera, resolution and format, so the defaults are only a starting point. For a better estimate, look at a few of your own files. On a computer, select a folder of typical photos and check its total size, then divide by the number of files. Phones and cloud services usually show how much space photos and videos take up in their storage settings.</p>
<ul>
  <li><strong>Photos:</strong> a typical phone photo is roughly 2–5 MB. Newer phones with very high-resolution modes, and RAW files from cameras, can be 20–50 MB or more.</li>
  <li><strong>Video:</strong> size depends on length, resolution, frame rate and format. Phones typically use roughly 60–130 MB per minute at 1080p and 170–400 MB per minute in 4K.</li>
  <li><strong>Music:</strong> at 256 kbps, a minute of audio is about 1.9 MB; at 128 kbps, about 1 MB.</li>
</ul>`,
    },
    {
      heading: 'MB, GB and TB: decimal and binary',
      html: `<p>This calculator uses decimal units, the same way storage makers label their products: 1 KB = 1,000 bytes, 1 MB = 1,000 KB, 1 GB = 1,000 MB and 1 TB = 1,000 GB. Windows uses binary units (1 GB = 1,024 × 1,024 × 1,024 bytes) but still labels them "GB", which is why a new 1 TB drive shows as about 931 GB. The drive isn't missing space. It's the same amount counted differently. Devices also reserve some space for their system software and formatting, so the usable space is always a little less than the number on the box.</p>`,
    },
    {
      heading: 'Rounding rules',
      html: `<ul>
  <li>The suggested size is the next common capacity at or above your total plus free space. It is never rounded down.</li>
  <li>Totals are shown in MB (whole numbers), GB (two decimals) and TB (three decimals).</li>
</ul>`,
    },
  ],
};
