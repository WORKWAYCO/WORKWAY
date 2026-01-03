/**
 * Sync Zoom meetings to Notion
 *
 * Usage: npx tsx scripts/sync-to-notion.ts
 *
 * Requires: NOTION_API_KEY environment variable
 */

const WORKER_URL = 'https://meetings.workway.co';
const USER_ID = 'dm-halfdozen-co';
const NOTION_DATABASE_ID = '27a019187ac580b797fec563c98afbbc';

interface Meeting {
  topic: string;
  meetingId: string;
  host: string;
  dateTime: string;
  shareUrl: string | null;
  rowIndex: number;
}

interface TranscriptResponse {
  success: boolean;
  topic: string;
  meetingId: string;
  dateTime: string;
  transcript: string;
}

async function getMeetings(): Promise<Meeting[]> {
  const response = await fetch(`${WORKER_URL}/meetings/${USER_ID}?days=30`);
  const data = await response.json() as { success: boolean; meetings: Meeting[] };

  if (!data.success) {
    throw new Error('Failed to fetch meetings');
  }

  return data.meetings;
}

async function getTranscript(index: number): Promise<TranscriptResponse | null> {
  try {
    const response = await fetch(`${WORKER_URL}/meeting-transcript/${USER_ID}?index=${index}`, {
      signal: AbortSignal.timeout(180000), // 3 minute timeout
    });
    const data = await response.json() as TranscriptResponse;
    return data.success ? data : null;
  } catch (error) {
    console.error(`Failed to get transcript for index ${index}:`, error);
    return null;
  }
}

async function checkExistingPage(notionKey: string, meetingId: string): Promise<boolean> {
  // Check by title containing meeting ID (since no Source ID property)
  const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filter: {
        property: 'Item',
        title: {
          contains: meetingId.replace(/ /g, ''),
        },
      },
    }),
  });

  const data = await response.json() as { results: any[] };
  return data.results?.length > 0;
}

/**
 * Format transcript with timestamps and speakers for Notion
 *
 * Input format (from worker):
 * ### 00:42
 * Ford: Hey, Danny, good morning.
 *
 * ### 00:44
 * Danny Morgan: What up?
 *
 * Output: Notion blocks with heading_3 for timestamps, paragraphs for speaker text
 */
function formatTranscriptWithSpeakers(transcript: string): any[] {
  const blocks: any[] = [];
  const lines = transcript.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check if this is a timestamp header (### 0:42 or ### 00:42 or ### 1:23:45)
    const timestampMatch = trimmedLine.match(/^###\s+(\d{1,2}:\d{2}(?::\d{2})?)$/);
    if (timestampMatch) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ text: { content: timestampMatch[1] } }],
        },
      });
      continue;
    }

    // Check if this is a speaker line (Name: text)
    const speakerMatch = trimmedLine.match(/^([A-Za-z][A-Za-z\s]+):\s*(.*)$/);
    if (speakerMatch) {
      const speaker = speakerMatch[1];
      const text = speakerMatch[2];

      // Handle long text (Notion 2000 char limit per rich_text)
      if (text.length > 1900) {
        // First block with speaker name
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { text: { content: `${speaker}: ` }, annotations: { bold: true } },
              { text: { content: text.slice(0, 1850) } },
            ],
          },
        });
        // Continuation blocks
        let remaining = text.slice(1850);
        while (remaining.length > 0) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: { rich_text: [{ text: { content: remaining.slice(0, 1900) } }] },
          });
          remaining = remaining.slice(1900);
        }
      } else if (text.length > 0) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { text: { content: `${speaker}: ` }, annotations: { bold: true } },
              { text: { content: text } },
            ],
          },
        });
      }
      continue;
    }

    // Plain text line (no timestamp, no speaker)
    if (trimmedLine.length > 1900) {
      let remaining = trimmedLine;
      while (remaining.length > 0) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: remaining.slice(0, 1900) } }] },
        });
        remaining = remaining.slice(1900);
      }
    } else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: trimmedLine } }] },
      });
    }
  }

  return blocks.length > 0 ? blocks : [{
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ text: { content: 'No transcript available' } }] },
  }];
}

async function appendBlocksToPage(
  notionKey: string,
  pageId: string,
  blocks: any[]
): Promise<boolean> {
  // Notion API limits to 100 blocks per request
  const BATCH_SIZE = 100;

  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batch = blocks.slice(i, i + BATCH_SIZE);

    const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${notionKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ children: batch }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error(`Failed to append blocks (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, data);
      return false;
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  return true;
}

async function createNotionPage(
  notionKey: string,
  meeting: Meeting,
  transcript: string
): Promise<string | null> {
  // Parse date from "Dec 30, 2025 12:26 PM" format
  const dateStr = meeting.dateTime;
  const date = new Date(dateStr);
  const isoDate = date.toISOString().split('T')[0];

  // Include meeting ID in title for deduplication
  const titleWithId = `${meeting.topic} [${meeting.meetingId.replace(/ /g, '')}]`;

  const properties: Record<string, any> = {
    'Item': {
      title: [{ text: { content: titleWithId } }],
    },
    'Date': {
      date: { start: isoDate },
    },
    'Type': {
      select: { name: 'Meeting' },
    },
    'Status': {
      select: { name: 'Active' },
    },
    'Source': {
      select: { name: 'Zoom' },
    },
  };

  // Initial page content (no transcript - will be appended separately)
  const initialChildren: any[] = [
    {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [{ text: { content: `Meeting on ${dateStr} • Host: ${meeting.host}` } }],
        icon: { emoji: '📅' },
        color: 'blue_background',
      },
    },
    {
      object: 'block',
      type: 'divider',
      divider: {},
    },
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ text: { content: 'Transcript' } }],
      },
    },
  ];

  try {
    // Step 1: Create page with initial content
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties,
        children: initialChildren,
      }),
    });

    const data = await response.json() as { id?: string; url?: string; message?: string };

    if (!response.ok) {
      console.error('Notion error:', data);
      return null;
    }

    const pageId = data.id;
    const pageUrl = data.url;

    if (!pageId) {
      console.error('No page ID returned');
      return null;
    }

    // Step 2: Append transcript blocks in batches
    const transcriptBlocks = formatTranscriptWithSpeakers(transcript);
    console.log(`    → Appending ${transcriptBlocks.length} transcript blocks...`);

    const appendSuccess = await appendBlocksToPage(notionKey, pageId, transcriptBlocks);

    if (!appendSuccess) {
      console.error('Failed to append all transcript blocks');
      // Page was created, return URL anyway
    }

    return pageUrl || null;
  } catch (error) {
    console.error('Failed to create Notion page:', error);
    return null;
  }
}

async function main() {
  const notionKey = process.env.NOTION_API_KEY;

  if (!notionKey) {
    console.error('Missing NOTION_API_KEY environment variable');
    process.exit(1);
  }

  console.log('Fetching meetings...');
  const meetings = await getMeetings();
  console.log(`Found ${meetings.length} meetings`);

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const meeting of meetings) {
    console.log(`\nProcessing: ${meeting.topic} (${meeting.dateTime})`);

    // Check if already exists
    const exists = await checkExistingPage(notionKey, meeting.meetingId);
    if (exists) {
      console.log('  → Already synced, skipping');
      skipped++;
      continue;
    }

    // Get transcript
    console.log('  → Extracting transcript...');
    const transcriptData = await getTranscript(meeting.rowIndex);

    if (!transcriptData) {
      console.log('  → No transcript available, skipping');
      failed++;
      continue;
    }

    // Create Notion page
    console.log('  → Creating Notion page...');
    const pageUrl = await createNotionPage(notionKey, meeting, transcriptData.transcript);

    if (pageUrl) {
      console.log(`  → Created: ${pageUrl}`);
      synced++;
    } else {
      console.log('  → Failed to create page');
      failed++;
    }

    // Rate limiting - wait between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n========================================');
  console.log(`Sync complete!`);
  console.log(`  Synced: ${synced}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
}

main().catch(console.error);
