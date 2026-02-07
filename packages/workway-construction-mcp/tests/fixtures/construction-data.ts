/**
 * Construction Workflow Test Fixtures
 *
 * Realistic mock data for RFIs, Daily Logs, and Submittals.
 * Based on actual Procore API response structures.
 */

import type {
  ProcoreProject,
  ProcoreRFI,
  ProcoreDailyLog,
  ProcoreSubmittal,
  ManpowerEntry,
} from '../../src/types';

// ============================================================================
// Projects
// ============================================================================

export const mockProjects: ProcoreProject[] = [
  {
    id: 12345,
    name: 'Downtown Office Tower',
    displayName: 'Downtown Office Tower - Phase 1',
    projectNumber: 'PRJ-2024-001',
    address: '100 Main Street',
    city: 'Chicago',
    stateCode: 'IL',
    active: true,
  },
  {
    id: 12346,
    name: 'Riverside Medical Center',
    displayName: 'Riverside Medical Center Expansion',
    projectNumber: 'PRJ-2024-002',
    address: '500 Hospital Drive',
    city: 'Houston',
    stateCode: 'TX',
    active: true,
  },
  {
    id: 12347,
    name: 'Historic Library Renovation',
    displayName: 'Central Library Renovation',
    projectNumber: 'PRJ-2023-015',
    address: '200 Library Lane',
    city: 'Boston',
    stateCode: 'MA',
    active: false,
  },
];

// ============================================================================
// RFIs
// ============================================================================

export const mockRFIs: ProcoreRFI[] = [
  {
    id: 1001,
    projectId: 12345,
    number: 1,
    subject: 'Foundation Reinforcement Clarification - Section 03 30 00',
    status: 'open',
    questionBody: `Per drawing S-101, the foundation reinforcement schedule shows #8 bars @ 12" O.C. both ways. 
However, the structural notes on S-001 reference #7 bars @ 10" O.C. for mat foundations exceeding 24" thickness.
Our foundation is 30" thick. Please clarify which reinforcement to use.`,
    dueDate: '2024-02-15',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    assigneeId: 5001,
  },
  {
    id: 1002,
    projectId: 12345,
    number: 2,
    subject: 'Mechanical Room Access Door Size',
    status: 'open',
    questionBody: `The architectural drawings show a 3'-0" x 7'-0" door for mechanical room access. 
However, the HVAC equipment schedule indicates the largest unit (AHU-3) requires a minimum 4'-0" clear opening for installation.
Please advise on door size modification or alternate installation approach.`,
    dueDate: '2024-02-10',
    createdAt: '2024-01-18T14:30:00Z',
    updatedAt: '2024-01-18T14:30:00Z',
    assigneeId: 5002,
  },
  {
    id: 1003,
    projectId: 12345,
    number: 3,
    subject: 'Concrete Mix Design Approval - High Strength',
    status: 'closed',
    questionBody: `Requesting approval for the attached 6000 PSI concrete mix design for the post-tensioned deck.
Mix design includes admixtures for pump placement per specification section 03 31 00.`,
    answerBody: `Mix design approved with the following conditions:
1. Increase air entrainment to 5-7% for freeze-thaw protection
2. Submit updated cylinder break schedule
3. Coordinate pour schedule with PT contractor`,
    responseTime: 3,
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-13T11:00:00Z',
    assigneeId: 5003,
  },
  {
    id: 1004,
    projectId: 12345,
    number: 4,
    subject: 'Waterproofing Detail at Grade Beam Penetration',
    status: 'draft',
    questionBody: `No detail provided for waterproofing continuity at conduit penetrations through grade beam.
Requesting typical detail for 4" conduit sleeves.`,
    createdAt: '2024-01-20T08:00:00Z',
    updatedAt: '2024-01-20T08:00:00Z',
  },
  {
    id: 1005,
    projectId: 12345,
    number: 5,
    subject: 'Elevator Pit Depth Discrepancy',
    status: 'open',
    questionBody: `Elevator specification calls for 5'-6" pit depth for hydraulic elevator.
Structural drawings show 4'-8" pit depth. Please confirm required depth.`,
    dueDate: '2024-02-01',
    createdAt: '2024-01-22T16:00:00Z',
    updatedAt: '2024-01-22T16:00:00Z',
    assigneeId: 5001,
    responseTime: undefined,
  },
];

export const mockRFIsWithBallInCourt = mockRFIs.map((rfi) => ({
  ...rfi,
  ballInCourt: rfi.status === 'open' ? 'Architect' : rfi.status === 'draft' ? 'Contractor' : 'Closed',
}));

// ============================================================================
// Daily Logs
// ============================================================================

const createManpowerEntry = (
  id: number,
  companyName: string,
  workerCount: number,
  hoursWorked: number,
  workDescription?: string
): ManpowerEntry => ({
  id,
  companyName,
  workerCount,
  hoursWorked,
  workDescription,
});

export const mockDailyLogs: ProcoreDailyLog[] = [
  {
    id: 2001,
    projectId: 12345,
    logDate: '2024-01-22',
    status: 'submitted',
    weatherConditions: 'Clear, Sunny',
    temperatureHigh: 45,
    temperatureLow: 28,
    notes: 'Completed Level 2 concrete pour. No safety incidents.',
    manpowerLogs: [
      createManpowerEntry(1, 'ABC Concrete', 12, 96, 'Concrete placement'),
      createManpowerEntry(2, 'XYZ Rebar', 8, 64, 'Rebar installation'),
      createManpowerEntry(3, 'General Contractor', 6, 48, 'Supervision and layout'),
    ],
    createdAt: '2024-01-22T17:00:00Z',
  },
  {
    id: 2002,
    projectId: 12345,
    logDate: '2024-01-21',
    status: 'submitted',
    weatherConditions: 'Cloudy, Light Rain AM',
    temperatureHigh: 52,
    temperatureLow: 38,
    notes: 'Rain delay 2 hours in morning. Resumed rebar installation after 10am.',
    manpowerLogs: [
      createManpowerEntry(4, 'XYZ Rebar', 8, 48, 'Rebar installation - reduced hours'),
      createManpowerEntry(5, 'General Contractor', 4, 32, 'Supervision'),
    ],
    createdAt: '2024-01-21T17:00:00Z',
  },
  {
    id: 2003,
    projectId: 12345,
    logDate: '2024-01-20',
    status: 'submitted',
    weatherConditions: 'Clear',
    temperatureHigh: 48,
    temperatureLow: 32,
    notes: 'Formwork installation for Level 2 deck. Inspector approved shoring.',
    manpowerLogs: [
      createManpowerEntry(6, 'DEF Forming', 10, 80, 'Deck formwork'),
      createManpowerEntry(7, 'ABC Concrete', 4, 32, 'Material staging'),
      createManpowerEntry(8, 'General Contractor', 5, 40, 'Supervision and coordination'),
    ],
    createdAt: '2024-01-20T17:00:00Z',
  },
  {
    id: 2004,
    projectId: 12345,
    logDate: '2024-01-19',
    status: 'submitted',
    weatherConditions: 'Heavy Snow',
    temperatureHigh: 25,
    temperatureLow: 18,
    notes: 'WEATHER DAY - Site closed due to heavy snowfall. All crews dismissed.',
    manpowerLogs: [],
    createdAt: '2024-01-19T10:00:00Z',
  },
  {
    id: 2005,
    projectId: 12345,
    logDate: '2024-01-18',
    status: 'submitted',
    weatherConditions: 'Partly Cloudy',
    temperatureHigh: 42,
    temperatureLow: 30,
    notes: 'Completed Level 1 deck strip. Curing compound applied.',
    manpowerLogs: [
      createManpowerEntry(9, 'DEF Forming', 8, 64, 'Form stripping'),
      createManpowerEntry(10, 'ABC Concrete', 2, 16, 'Curing compound application'),
      createManpowerEntry(11, 'General Contractor', 4, 32, 'Supervision'),
    ],
    createdAt: '2024-01-18T17:00:00Z',
  },
];

export const mockDailyLogsWithDelays = mockDailyLogs.map((log) => ({
  ...log,
  delayLogs: log.notes?.includes('delay') || log.notes?.includes('WEATHER DAY')
    ? [
        {
          id: log.id + 1000,
          log_date: log.logDate,
          delay_reason: log.notes?.includes('WEATHER DAY') ? 'Weather - Snow' : 'Weather - Rain',
          hours_delayed: log.notes?.includes('WEATHER DAY') ? 8 : 2,
          description: log.notes,
        },
      ]
    : [],
}));

// ============================================================================
// Submittals
// ============================================================================

export const mockSubmittals: ProcoreSubmittal[] = [
  {
    id: 3001,
    projectId: 12345,
    number: 1,
    title: 'Structural Steel Shop Drawings - Package 1',
    status: 'pending',
    specSection: '05 12 00 - Structural Steel Framing',
    dueDate: '2024-01-25',
    ballInCourt: 'Architect',
    createdAt: '2024-01-08T10:00:00Z',
    updatedAt: '2024-01-08T10:00:00Z',
  },
  {
    id: 3002,
    projectId: 12345,
    number: 2,
    title: 'Concrete Mix Design - 6000 PSI',
    status: 'approved',
    specSection: '03 30 00 - Cast-in-Place Concrete',
    dueDate: '2024-01-10',
    ballInCourt: 'Contractor',
    createdAt: '2024-01-02T09:00:00Z',
    updatedAt: '2024-01-10T14:00:00Z',
  },
  {
    id: 3003,
    projectId: 12345,
    number: 3,
    title: 'Waterproofing Membrane Product Data',
    status: 'pending',
    specSection: '07 13 00 - Sheet Waterproofing',
    dueDate: '2024-01-15', // Overdue
    ballInCourt: 'Subcontractor',
    createdAt: '2024-01-05T11:00:00Z',
    updatedAt: '2024-01-05T11:00:00Z',
  },
  {
    id: 3004,
    projectId: 12345,
    number: 4,
    title: 'HVAC Equipment Submittals - RTUs',
    status: 'pending',
    specSection: '23 74 00 - Packaged Outdoor HVAC Equipment',
    dueDate: '2024-02-01',
    ballInCourt: 'Engineer',
    createdAt: '2024-01-12T08:00:00Z',
    updatedAt: '2024-01-12T08:00:00Z',
  },
  {
    id: 3005,
    projectId: 12345,
    number: 5,
    title: 'Elevator Equipment Submittals',
    status: 'revise_and_resubmit',
    specSection: '14 21 00 - Electric Traction Elevators',
    dueDate: '2024-01-20',
    ballInCourt: 'Contractor',
    createdAt: '2024-01-03T15:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 3006,
    projectId: 12345,
    number: 6,
    title: 'Fire Sprinkler Shop Drawings',
    status: 'pending',
    specSection: '21 13 13 - Wet-Pipe Sprinkler Systems',
    dueDate: '2024-01-12', // Very overdue
    ballInCourt: 'Engineer',
    createdAt: '2024-01-02T13:00:00Z',
    updatedAt: '2024-01-02T13:00:00Z',
  },
  {
    id: 3007,
    projectId: 12345,
    number: 7,
    title: 'Curtain Wall System Product Data',
    status: 'pending',
    specSection: '08 44 00 - Curtain Wall Assemblies',
    ballInCourt: undefined, // Missing ball in court
    createdAt: '2024-01-14T09:00:00Z',
    updatedAt: '2024-01-14T09:00:00Z',
  },
];

export const mockSubmittalsWithRevisionHistory = mockSubmittals.map((sub) => ({
  ...sub,
  revisions: sub.status === 'revise_and_resubmit'
    ? [
        {
          revisionNumber: 1,
          submittedAt: sub.createdAt,
          status: 'revise_and_resubmit',
          comments: 'Missing seismic calculations. Please resubmit with structural calcs.',
        },
      ]
    : [],
  approverWorkflow: [
    { role: 'Architect', status: sub.status === 'approved' ? 'approved' : 'pending' },
    { role: 'Engineer', status: 'pending' },
    { role: 'Owner', status: 'pending' },
  ],
}));

// ============================================================================
// Project Context (for Skills)
// ============================================================================

export const mockProjectContext = {
  projectId: 12345,
  projectName: 'Downtown Office Tower',
  recentRFISubjects: [
    'Foundation Reinforcement Clarification - Section 03 30 00',
    'Mechanical Room Access Door Size',
    'Concrete Mix Design Approval - High Strength',
  ],
  specSections: [
    '03 30 00 - Cast-in-Place Concrete',
    '05 12 00 - Structural Steel Framing',
    '07 13 00 - Sheet Waterproofing',
    '08 44 00 - Curtain Wall Assemblies',
    '14 21 00 - Electric Traction Elevators',
    '21 13 13 - Wet-Pipe Sprinkler Systems',
    '23 74 00 - Packaged Outdoor HVAC Equipment',
  ],
};

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * Create a mock fetch response for Procore API
 */
export function createMockFetchResponse<T>(data: T, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  } as Response;
}

/**
 * Create an error response
 */
export function createMockErrorResponse(
  status: number,
  message: string
): Response {
  return {
    ok: false,
    status,
    json: async () => ({ error: message }),
    text: async () => message,
    headers: new Headers({
      'Content-Type': 'application/json',
    }),
  } as Response;
}

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate RFIs with specific statuses for filtering tests
 */
export function generateRFIsWithStatuses(
  count: number,
  status: 'open' | 'closed' | 'draft'
): ProcoreRFI[] {
  return Array.from({ length: count }, (_, i) => ({
    id: 9000 + i,
    projectId: 12345,
    number: 100 + i,
    subject: `Test RFI ${i + 1} - ${status}`,
    status,
    questionBody: `Test question for RFI ${i + 1}`,
    answerBody: status === 'closed' ? `Test answer for RFI ${i + 1}` : undefined,
    responseTime: status === 'closed' ? Math.floor(Math.random() * 10) + 1 : undefined,
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - i * 86400000).toISOString(),
  }));
}

/**
 * Generate submittals with various due date scenarios
 */
export function generateSubmittalsWithDueDates(
  options: { overdue?: number; dueSoon?: number; future?: number }
): ProcoreSubmittal[] {
  const now = new Date();
  const results: ProcoreSubmittal[] = [];
  let id = 8000;

  // Overdue submittals
  for (let i = 0; i < (options.overdue || 0); i++) {
    const dueDate = new Date(now.getTime() - (i + 1) * 86400000 * 3);
    results.push({
      id: id++,
      projectId: 12345,
      number: 200 + i,
      title: `Overdue Submittal ${i + 1}`,
      status: 'pending',
      specSection: '03 30 00',
      dueDate: dueDate.toISOString().split('T')[0],
      ballInCourt: 'Architect',
      createdAt: new Date(dueDate.getTime() - 86400000 * 14).toISOString(),
      updatedAt: new Date(dueDate.getTime() - 86400000 * 14).toISOString(),
    });
  }

  // Due soon (within 7 days)
  for (let i = 0; i < (options.dueSoon || 0); i++) {
    const dueDate = new Date(now.getTime() + (i + 1) * 86400000);
    results.push({
      id: id++,
      projectId: 12345,
      number: 300 + i,
      title: `Due Soon Submittal ${i + 1}`,
      status: 'pending',
      specSection: '05 12 00',
      dueDate: dueDate.toISOString().split('T')[0],
      ballInCourt: 'Engineer',
      createdAt: new Date(dueDate.getTime() - 86400000 * 14).toISOString(),
      updatedAt: new Date(dueDate.getTime() - 86400000 * 14).toISOString(),
    });
  }

  // Future due dates
  for (let i = 0; i < (options.future || 0); i++) {
    const dueDate = new Date(now.getTime() + (i + 14) * 86400000);
    results.push({
      id: id++,
      projectId: 12345,
      number: 400 + i,
      title: `Future Submittal ${i + 1}`,
      status: 'pending',
      specSection: '07 13 00',
      dueDate: dueDate.toISOString().split('T')[0],
      ballInCourt: 'Contractor',
      createdAt: new Date(dueDate.getTime() - 86400000 * 21).toISOString(),
      updatedAt: new Date(dueDate.getTime() - 86400000 * 21).toISOString(),
    });
  }

  return results;
}

/**
 * Generate daily logs for a date range
 */
export function generateDailyLogsForRange(
  startDate: Date,
  endDate: Date,
  options?: { includeWeatherDays?: boolean; includeDelays?: boolean }
): ProcoreDailyLog[] {
  const logs: ProcoreDailyLog[] = [];
  let id = 7000;
  const current = new Date(startDate);

  while (current <= endDate) {
    const isWeekend = current.getDay() === 0 || current.getDay() === 6;
    const isWeatherDay = options?.includeWeatherDays && Math.random() < 0.1;

    if (!isWeekend) {
      logs.push({
        id: id++,
        projectId: 12345,
        logDate: current.toISOString().split('T')[0],
        status: 'submitted',
        weatherConditions: isWeatherDay ? 'Heavy Rain' : 'Clear',
        temperatureHigh: Math.floor(Math.random() * 30) + 40,
        temperatureLow: Math.floor(Math.random() * 20) + 25,
        notes: isWeatherDay
          ? 'Weather delay - 4 hours lost'
          : 'Normal operations, good progress.',
        manpowerLogs: isWeatherDay
          ? []
          : [
              createManpowerEntry(id + 100, 'General Contractor', 8, 64, 'General work'),
              createManpowerEntry(id + 101, 'Subcontractor A', 6, 48, 'Specialty work'),
            ],
        createdAt: current.toISOString(),
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return logs;
}
