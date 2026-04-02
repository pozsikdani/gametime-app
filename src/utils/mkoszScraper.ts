export interface MkoszConfig {
  teamId: string;
  teamName: string;
  competition: string;
  season: string;
}

export interface MkoszMatch {
  date: Date;
  opponent: string;
  isHome: boolean;
  location: string;
  score?: string;
  gameId?: string;
}

const HU_MONTHS: Record<string, number> = {
  'január': 0, 'február': 1, 'március': 2, 'április': 3,
  'május': 4, 'június': 5, 'július': 6, 'augusztus': 7,
  'szeptember': 8, 'október': 9, 'november': 10, 'december': 11,
};

export async function fetchMkoszSchedule(configs: MkoszConfig[]): Promise<MkoszMatch[]> {
  const allMatches: MkoszMatch[] = [];

  for (const config of configs) {
    const { season, competition, teamId } = config;
    const url = `https://mkosz.hu/bajnoksag-musor/${season}/${competition}/phase/0/csapat/${teamId}`;

    try {
      const response = await fetch(url);
      const html = await response.text();
      const matches = parseScheduleHtml(html, config.teamName);
      allMatches.push(...matches);
    } catch (error) {
      console.error(`MKOSZ scrape error (${competition}):`, error);
    }
  }

  return allMatches;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function parseScheduleHtml(html: string, team: string = 'KÖZGÁZ'): MkoszMatch[] {
  const matches: MkoszMatch[] = [];
  const teamName = team.toUpperCase();

  // Current month context from section headers like "2025. október"
  let currentYear = 2025;
  let currentMonth = 0;

  // Parse month headers: <div class=black-title>2025. október </div>
  // And game rows: <tr> with <td> cells for home, away, date, time, score

  // Split by tbody sections to process each game
  const tbodyRegex = /<tbody>([\s\S]*?)<\/tbody>/gi;
  let tbodyMatch;

  // Also capture month headers
  const monthHeaderRegex = /(\d{4})\.\s+(január|február|március|április|május|június|július|augusztus|szeptember|október|november|december)/gi;

  // Process the HTML linearly to maintain month context
  // Find all game rows — they have 5+ <td> with team links
  const gameRowRegex = /<tr>\s*<td[^>]*class="left[^"]*"[^>]*>[\s\S]*?<\/tr>/gi;
  let gameRow;

  // Better approach: find all <tr> that contain team links
  const allRows = html.match(/<tr>[\s\S]*?<\/tr>/gi) || [];

  // Track month from headers before each table
  const sections = html.split(/<div class=['"]?black-title/i);

  for (const section of sections) {
    // Parse month header from this section
    const headerMatch = section.match(/(\d{4})\.\s+(január|február|március|április|május|június|július|augusztus|szeptember|október|november|december)/i);
    if (headerMatch) {
      currentYear = parseInt(headerMatch[1]);
      currentMonth = HU_MONTHS[headerMatch[2].toLowerCase()] ?? 0;
    }

    // Find game rows in this section
    const rows = section.match(/<tr>[\s\S]*?<\/tr>/gi) || [];

    for (const row of rows) {
      // Skip referee rows and header rows
      if (row.includes('referee') || row.includes('<th')) continue;

      // Must have team links
      if (!row.includes('title=')) continue;

      // Extract team names from title attributes
      const titleMatches = [...row.matchAll(/title="([^"]+)"/g)];
      if (titleMatches.length < 2) continue;

      const homeTeam = titleMatches[0][1];
      const awayTeam = titleMatches[1][1];

      // Extract all <td> contents
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => stripTags(m[1]));

      // cells: [homeTeam, awayTeam, date, time, score]
      if (cells.length < 4) continue;

      // Date cell: "október 05." or "05."
      const dateCell = cells[2] || '';
      const timeCell = cells[3] || '';

      // Parse date
      let day = 0;
      const fullDateMatch = dateCell.match(/(január|február|március|április|május|június|július|augusztus|szeptember|október|november|december)\s+(\d{1,2})/i);
      const shortDateMatch = dateCell.match(/(\d{1,2})\./);

      if (fullDateMatch) {
        currentMonth = HU_MONTHS[fullDateMatch[1].toLowerCase()] ?? currentMonth;
        day = parseInt(fullDateMatch[2]);
      } else if (shortDateMatch) {
        day = parseInt(shortDateMatch[1]);
      }

      if (day === 0) continue;

      // Parse time
      const timeMatch = timeCell.match(/(\d{1,2}):(\d{2})/);
      const hour = timeMatch ? parseInt(timeMatch[1]) : 0;
      const minute = timeMatch ? parseInt(timeMatch[2]) : 0;

      const date = new Date(currentYear, currentMonth, day, hour, minute);

      // Score cell
      const scoreCell = cells[4] || '';
      const scoreMatch = scoreCell.match(/(\d{1,3})\s*[-–:]\s*(\d{1,3})/);
      const score = scoreMatch ? `${scoreMatch[1]}-${scoreMatch[2]}` : undefined;

      // Game ID from link
      const gameIdMatch = row.match(/merkozes[^"]*?\/(\d+)/);
      const gameId = gameIdMatch ? gameIdMatch[1] : undefined;

      // Venue from title attribute on the last td (csarnok)
      const venueMatch = row.match(/title="([^"]+)"[^>]*><span>[^<]*<\/span><\/td>/);
      const venue = venueMatch ? venueMatch[1] : '';

      // Determine home/away
      const isHome = homeTeam.toUpperCase().includes(teamName);
      const opponent = isHome ? awayTeam : homeTeam;

      matches.push({
        date,
        opponent,
        isHome,
        location: venue || (isHome ? 'Hazai' : 'Idegen'),
        score,
        gameId,
      });
    }
  }

  return matches;
}
