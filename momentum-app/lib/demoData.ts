/**
 * Demo/fixture data for running Momentum without a backend.
 * All IDs are UUID-formatted for consistency with the real API.
 */

import type {
  User,
  PublicUser,
  Category,
  Log,
  LogTask,
  FeedItem,
  Comment,
  Notification,
  Goal,
  Streak,
  FollowUser,
} from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
  return d.toISOString();
}

function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

// ─── Demo User (the logged-in user) ──────────────────────────────────────────

export const DEMO_USER_ID = 'demo-user-id';

export const demoUser: User = {
  id: DEMO_USER_ID,
  email: 'demo@momentum.app',
  display_name: 'Demo User',
  username: 'demo_user',
  avatar_url: null,
  bio: 'Exploring Momentum in demo mode',
  goal_category: 'Coding',
  created_at: daysAgo(90),
};

export const demoUserProfile: PublicUser = {
  id: DEMO_USER_ID,
  username: 'demo_user',
  display_name: 'Demo User',
  avatar_url: null,
  bio: 'Exploring Momentum in demo mode',
  follower_count: 42,
  following_count: 18,
  current_streak: 7,
  longest_streak: 21,
  is_following: null,
  log_count: 35,
};

// ─── Other Demo Users ────────────────────────────────────────────────────────

export const demoUsers: PublicUser[] = [
  {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    username: 'sarah_codes',
    display_name: 'Sarah Chen',
    avatar_url: 'https://i.pravatar.cc/150?u=sarah_codes',
    bio: 'Full-stack developer. Building cool things one commit at a time.',
    follower_count: 234,
    following_count: 89,
    current_streak: 14,
    longest_streak: 45,
    is_following: true,
    log_count: 128,
  },
  {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    username: 'marcus_reads',
    display_name: 'Marcus Johnson',
    avatar_url: 'https://i.pravatar.cc/150?u=marcus_reads',
    bio: 'Avid reader. 52-book challenge this year.',
    follower_count: 156,
    following_count: 67,
    current_streak: 21,
    longest_streak: 21,
    is_following: true,
    log_count: 95,
  },
  {
    id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    username: 'elena_writes',
    display_name: 'Elena Rodriguez',
    avatar_url: 'https://i.pravatar.cc/150?u=elena_writes',
    bio: 'Novelist & poet. Words are my meditation.',
    follower_count: 312,
    following_count: 45,
    current_streak: 5,
    longest_streak: 30,
    is_following: true,
    log_count: 76,
  },
  {
    id: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
    username: 'kai_creates',
    display_name: 'Kai Tanaka',
    avatar_url: 'https://i.pravatar.cc/150?u=kai_creates',
    bio: 'Digital artist & illustrator. Turning ideas into pixels.',
    follower_count: 489,
    following_count: 120,
    current_streak: 3,
    longest_streak: 18,
    is_following: false,
    log_count: 64,
  },
  {
    id: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b',
    username: 'priya_studies',
    display_name: 'Priya Sharma',
    avatar_url: 'https://i.pravatar.cc/150?u=priya_studies',
    bio: 'Med student. Anatomy today, surgeon tomorrow.',
    follower_count: 178,
    following_count: 92,
    current_streak: 11,
    longest_streak: 35,
    is_following: true,
    log_count: 203,
  },
];

// ─── Categories ──────────────────────────────────────────────────────────────

export const demoCategories: Category[] = [
  { id: 'cat-01-read-0000-000000000001', name: 'Reading', icon: '\u{1F4DA}', is_default: true },
  { id: 'cat-02-code-0000-000000000002', name: 'Coding', icon: '\u{1F4BB}', is_default: true },
  { id: 'cat-03-writ-0000-000000000003', name: 'Writing', icon: '\u{270D}\u{FE0F}', is_default: true },
  { id: 'cat-04-stdy-0000-000000000004', name: 'Study', icon: '\u{1F393}', is_default: true },
  { id: 'cat-05-crtv-0000-000000000005', name: 'Creative', icon: '\u{1F3A8}', is_default: true },
  { id: 'cat-06-othr-0000-000000000006', name: 'Other', icon: '\u{2699}\u{FE0F}', is_default: true },
];

// ─── Helper to build a LogTask ───────────────────────────────────────────────

function task(
  id: string,
  categoryIndex: number,
  name: string,
  duration: number,
  sortOrder: number = 0,
): LogTask {
  const cat = demoCategories[categoryIndex];
  return {
    id,
    category_id: cat.id,
    task_name: name,
    duration,
    sort_order: sortOrder,
    category: cat,
  };
}

// ─── Feed Items (from followed users) ────────────────────────────────────────

function userPick(u: PublicUser) {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
  };
}

export const demoFeedItems: FeedItem[] = [
  {
    id: 'log-f001-0000-0000-000000000001',
    user_id: demoUsers[0].id,
    user: userPick(demoUsers[0]),
    title: 'Morning coding session',
    note: 'Refactored the authentication module. Finally got the refresh token flow working cleanly.',
    total_duration: 5400,
    started_at: hoursAgo(3),
    ended_at: hoursAgo(1),
    is_published: true,
    published_at: hoursAgo(1),
    tasks: [
      task('t-f001-1', 1, 'Auth refactor', 3600, 0),
      task('t-f001-2', 1, 'Unit tests', 1800, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 12,
    comment_count: 3,
    has_reacted: true,
    streak_at_time: 14,
    created_at: hoursAgo(3),
  },
  {
    id: 'log-f002-0000-0000-000000000002',
    user_id: demoUsers[1].id,
    user: userPick(demoUsers[1]),
    title: 'Reading: Atomic Habits',
    note: 'Finished chapters 10-12. The concept of habit stacking is really clicking now.',
    total_duration: 3600,
    started_at: hoursAgo(5),
    ended_at: hoursAgo(4),
    is_published: true,
    published_at: hoursAgo(4),
    tasks: [
      task('t-f002-1', 0, 'Atomic Habits Ch.10-12', 3600, 0),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 8,
    comment_count: 1,
    has_reacted: false,
    streak_at_time: 21,
    created_at: hoursAgo(5),
  },
  {
    id: 'log-f003-0000-0000-000000000003',
    user_id: demoUsers[2].id,
    user: userPick(demoUsers[2]),
    title: 'Novel writing sprint',
    note: 'Wrote 1,200 words on chapter 7. The protagonist finally confronts the antagonist.',
    total_duration: 7200,
    started_at: hoursAgo(8),
    ended_at: hoursAgo(6),
    is_published: true,
    published_at: hoursAgo(6),
    tasks: [
      task('t-f003-1', 2, 'Chapter 7 draft', 5400, 0),
      task('t-f003-2', 2, 'Character notes', 1800, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 15,
    comment_count: 4,
    has_reacted: true,
    streak_at_time: 5,
    created_at: hoursAgo(8),
  },
  {
    id: 'log-f004-0000-0000-000000000004',
    user_id: demoUsers[4].id,
    user: userPick(demoUsers[4]),
    title: 'Anatomy study session',
    note: 'Reviewed the musculoskeletal system. Used Anki flashcards for the first time.',
    total_duration: 10800,
    started_at: daysAgo(1),
    ended_at: daysAgo(1),
    is_published: true,
    published_at: daysAgo(1),
    tasks: [
      task('t-f004-1', 3, 'Musculoskeletal review', 7200, 0),
      task('t-f004-2', 3, 'Anki flashcards', 3600, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 22,
    comment_count: 2,
    has_reacted: false,
    streak_at_time: 11,
    created_at: daysAgo(1),
  },
  {
    id: 'log-f005-0000-0000-000000000005',
    user_id: demoUsers[0].id,
    user: userPick(demoUsers[0]),
    title: 'React Native deep dive',
    note: 'Built a custom gesture handler for swipe-to-delete. Performance is smooth!',
    total_duration: 4500,
    started_at: daysAgo(1),
    ended_at: daysAgo(1),
    is_published: true,
    published_at: daysAgo(1),
    tasks: [
      task('t-f005-1', 1, 'Gesture handler', 2700, 0),
      task('t-f005-2', 1, 'Animation polish', 1800, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 6,
    comment_count: 0,
    has_reacted: false,
    streak_at_time: 13,
    created_at: daysAgo(1),
  },
  {
    id: 'log-f006-0000-0000-000000000006',
    user_id: demoUsers[1].id,
    user: userPick(demoUsers[1]),
    title: 'Reading: Deep Work',
    note: null,
    total_duration: 2700,
    started_at: daysAgo(2),
    ended_at: daysAgo(2),
    is_published: true,
    published_at: daysAgo(2),
    tasks: [
      task('t-f006-1', 0, 'Deep Work Ch.3-4', 2700, 0),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 4,
    comment_count: 0,
    has_reacted: true,
    streak_at_time: 19,
    created_at: daysAgo(2),
  },
  {
    id: 'log-f007-0000-0000-000000000007',
    user_id: demoUsers[2].id,
    user: userPick(demoUsers[2]),
    title: 'Poetry workshop prep',
    note: 'Drafted three haiku and revised my free-verse piece for the workshop tomorrow.',
    total_duration: 5400,
    started_at: daysAgo(2),
    ended_at: daysAgo(2),
    is_published: true,
    published_at: daysAgo(2),
    tasks: [
      task('t-f007-1', 2, 'Haiku drafts', 1800, 0),
      task('t-f007-2', 2, 'Free verse revision', 3600, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 19,
    comment_count: 5,
    has_reacted: false,
    streak_at_time: 4,
    created_at: daysAgo(2),
  },
  {
    id: 'log-f008-0000-0000-000000000008',
    user_id: demoUsers[4].id,
    user: userPick(demoUsers[4]),
    title: 'Pharmacology review',
    note: 'Covered beta-blockers and ACE inhibitors. Made a comparison chart.',
    total_duration: 7200,
    started_at: daysAgo(3),
    ended_at: daysAgo(3),
    is_published: true,
    published_at: daysAgo(3),
    tasks: [
      task('t-f008-1', 3, 'Beta-blockers', 3600, 0),
      task('t-f008-2', 3, 'ACE inhibitors', 3600, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 9,
    comment_count: 1,
    has_reacted: true,
    streak_at_time: 10,
    created_at: daysAgo(3),
  },
  {
    id: 'log-f009-0000-0000-000000000009',
    user_id: demoUsers[0].id,
    user: userPick(demoUsers[0]),
    title: 'API design session',
    note: 'Designed REST endpoints for the notification system. Clean separation of concerns.',
    total_duration: 3600,
    started_at: daysAgo(3),
    ended_at: daysAgo(3),
    is_published: true,
    published_at: daysAgo(3),
    tasks: [
      task('t-f009-1', 1, 'API design doc', 2400, 0),
      task('t-f009-2', 1, 'OpenAPI spec', 1200, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 11,
    comment_count: 2,
    has_reacted: false,
    streak_at_time: 12,
    created_at: daysAgo(3),
  },
  {
    id: 'log-f010-0000-0000-000000000010',
    user_id: demoUsers[1].id,
    user: userPick(demoUsers[1]),
    title: 'Reading: The Pragmatic Programmer',
    note: 'Started the classic. The "Broken Windows" metaphor is powerful.',
    total_duration: 4200,
    started_at: daysAgo(4),
    ended_at: daysAgo(4),
    is_published: true,
    published_at: daysAgo(4),
    tasks: [
      task('t-f010-1', 0, 'Pragmatic Programmer Ch.1-3', 4200, 0),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 7,
    comment_count: 1,
    has_reacted: false,
    streak_at_time: 17,
    created_at: daysAgo(4),
  },
  {
    id: 'log-f011-0000-0000-000000000011',
    user_id: demoUsers[2].id,
    user: userPick(demoUsers[2]),
    title: 'Morning pages',
    note: null,
    total_duration: 1800,
    started_at: daysAgo(4),
    ended_at: daysAgo(4),
    is_published: true,
    published_at: daysAgo(4),
    tasks: [
      task('t-f011-1', 2, 'Stream of consciousness', 1800, 0),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 3,
    comment_count: 0,
    has_reacted: false,
    streak_at_time: 3,
    created_at: daysAgo(4),
  },
  {
    id: 'log-f012-0000-0000-000000000012',
    user_id: demoUsers[4].id,
    user: userPick(demoUsers[4]),
    title: 'Histology lab prep',
    note: 'Reviewed tissue slides for the practical exam next week.',
    total_duration: 5400,
    started_at: daysAgo(5),
    ended_at: daysAgo(5),
    is_published: true,
    published_at: daysAgo(5),
    tasks: [
      task('t-f012-1', 3, 'Tissue identification', 3600, 0),
      task('t-f012-2', 3, 'Slide review', 1800, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 14,
    comment_count: 3,
    has_reacted: true,
    streak_at_time: 9,
    created_at: daysAgo(5),
  },
  {
    id: 'log-f013-0000-0000-000000000013',
    user_id: demoUsers[0].id,
    user: userPick(demoUsers[0]),
    title: 'Database optimization',
    note: 'Added indexes to the feed query. Response time dropped from 800ms to 45ms.',
    total_duration: 6300,
    started_at: daysAgo(5),
    ended_at: daysAgo(5),
    is_published: true,
    published_at: daysAgo(5),
    tasks: [
      task('t-f013-1', 1, 'Query analysis', 2700, 0),
      task('t-f013-2', 1, 'Index creation', 1800, 1),
      task('t-f013-3', 1, 'Benchmarking', 1800, 2),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 28,
    comment_count: 6,
    has_reacted: true,
    streak_at_time: 11,
    created_at: daysAgo(5),
  },
  {
    id: 'log-f014-0000-0000-000000000014',
    user_id: demoUsers[1].id,
    user: userPick(demoUsers[1]),
    title: 'Reading: Sapiens',
    note: 'The agricultural revolution chapter really changed my perspective.',
    total_duration: 3000,
    started_at: daysAgo(6),
    ended_at: daysAgo(6),
    is_published: true,
    published_at: daysAgo(6),
    tasks: [
      task('t-f014-1', 0, 'Sapiens Ch.5-6', 3000, 0),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 5,
    comment_count: 0,
    has_reacted: false,
    streak_at_time: 15,
    created_at: daysAgo(6),
  },
  {
    id: 'log-f015-0000-0000-000000000015',
    user_id: demoUsers[2].id,
    user: userPick(demoUsers[2]),
    title: 'Short story draft',
    note: 'First draft of "The Lighthouse Keeper". About 2,500 words. Needs major revision.',
    total_duration: 9000,
    started_at: daysAgo(6),
    ended_at: daysAgo(6),
    is_published: true,
    published_at: daysAgo(6),
    tasks: [
      task('t-f015-1', 2, 'Outline', 1800, 0),
      task('t-f015-2', 2, 'First draft', 7200, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 21,
    comment_count: 4,
    has_reacted: false,
    streak_at_time: 2,
    created_at: daysAgo(6),
  },
];

// ─── Explore Feed (items from non-followed users) ────────────────────────────

export const demoExploreFeedItems: FeedItem[] = [
  {
    id: 'log-e001-0000-0000-000000000001',
    user_id: demoUsers[3].id,
    user: userPick(demoUsers[3]),
    title: 'Character design practice',
    note: 'Designed three characters for a fantasy RPG concept. Focused on silhouette readability.',
    total_duration: 7200,
    started_at: hoursAgo(2),
    ended_at: hoursAgo(0),
    is_published: true,
    published_at: hoursAgo(0),
    tasks: [
      task('t-e001-1', 4, 'Thumbnails', 2400, 0),
      task('t-e001-2', 4, 'Refined sketches', 4800, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 34,
    comment_count: 7,
    has_reacted: false,
    streak_at_time: 3,
    created_at: hoursAgo(2),
  },
  {
    id: 'log-e002-0000-0000-000000000002',
    user_id: demoUsers[3].id,
    user: userPick(demoUsers[3]),
    title: 'Digital painting study',
    note: 'Color and light study from a Monet reference. Learned a lot about atmospheric perspective.',
    total_duration: 5400,
    started_at: daysAgo(1),
    ended_at: daysAgo(1),
    is_published: true,
    published_at: daysAgo(1),
    tasks: [
      task('t-e002-1', 4, 'Color study', 3600, 0),
      task('t-e002-2', 4, 'Reflection notes', 1800, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 45,
    comment_count: 8,
    has_reacted: false,
    streak_at_time: 2,
    created_at: daysAgo(1),
  },
  {
    id: 'log-e003-0000-0000-000000000003',
    user_id: demoUsers[3].id,
    user: userPick(demoUsers[3]),
    title: 'UI icon set',
    note: null,
    total_duration: 3600,
    started_at: daysAgo(3),
    ended_at: daysAgo(3),
    is_published: true,
    published_at: daysAgo(3),
    tasks: [
      task('t-e003-1', 4, 'Icon design', 3600, 0),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 18,
    comment_count: 2,
    has_reacted: false,
    streak_at_time: 1,
    created_at: daysAgo(3),
  },
];

// ─── Demo User's Own Logs ────────────────────────────────────────────────────

export const demoUserLogs: Log[] = [
  {
    id: 'log-m001-0000-0000-000000000001',
    user_id: DEMO_USER_ID,
    title: 'Evening coding practice',
    note: 'Worked through LeetCode medium problems. Solved 3 out of 4.',
    total_duration: 5400,
    started_at: hoursAgo(6),
    ended_at: hoursAgo(4),
    is_published: true,
    published_at: hoursAgo(4),
    tasks: [
      task('t-m001-1', 1, 'LeetCode problems', 4500, 0),
      task('t-m001-2', 1, 'Solution review', 900, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 5,
    comment_count: 1,
    created_at: hoursAgo(6),
  },
  {
    id: 'log-m002-0000-0000-000000000002',
    user_id: DEMO_USER_ID,
    title: 'TypeScript deep dive',
    note: 'Explored advanced generics and conditional types.',
    total_duration: 7200,
    started_at: daysAgo(1),
    ended_at: daysAgo(1),
    is_published: true,
    published_at: daysAgo(1),
    tasks: [
      task('t-m002-1', 1, 'Generics practice', 3600, 0),
      task('t-m002-2', 1, 'Conditional types', 3600, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 8,
    comment_count: 2,
    created_at: daysAgo(1),
  },
  {
    id: 'log-m003-0000-0000-000000000003',
    user_id: DEMO_USER_ID,
    title: 'Morning reading',
    note: null,
    total_duration: 2700,
    started_at: daysAgo(2),
    ended_at: daysAgo(2),
    is_published: true,
    published_at: daysAgo(2),
    tasks: [
      task('t-m003-1', 0, 'Clean Code Ch.5', 2700, 0),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 3,
    comment_count: 0,
    created_at: daysAgo(2),
  },
  {
    id: 'log-m004-0000-0000-000000000004',
    user_id: DEMO_USER_ID,
    title: 'Side project work',
    note: 'Set up the project scaffold and CI pipeline.',
    total_duration: 9000,
    started_at: daysAgo(3),
    ended_at: daysAgo(3),
    is_published: true,
    published_at: daysAgo(3),
    tasks: [
      task('t-m004-1', 1, 'Project scaffold', 5400, 0),
      task('t-m004-2', 1, 'CI setup', 3600, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 12,
    comment_count: 3,
    created_at: daysAgo(3),
  },
  {
    id: 'log-m005-0000-0000-000000000005',
    user_id: DEMO_USER_ID,
    title: 'Algorithm study',
    note: 'Graph traversal algorithms: BFS and DFS with practical examples.',
    total_duration: 4500,
    started_at: daysAgo(4),
    ended_at: daysAgo(4),
    is_published: false,
    published_at: null,
    tasks: [
      task('t-m005-1', 3, 'BFS implementation', 2700, 0),
      task('t-m005-2', 3, 'DFS implementation', 1800, 1),
    ],
    images: [],
    tagged_users: [],
    reaction_count: 0,
    comment_count: 0,
    created_at: daysAgo(4),
  },
];

// ─── Comments ────────────────────────────────────────────────────────────────

export const demoComments: Record<string, Comment[]> = {
  'log-f001-0000-0000-000000000001': [
    {
      id: 'cmt-0001-0000-0000-000000000001',
      log_id: 'log-f001-0000-0000-000000000001',
      body: 'Great work on the auth refactor! Refresh tokens can be tricky.',
      user: userPick(demoUsers[4]),
      created_at: hoursAgo(1),
    },
    {
      id: 'cmt-0002-0000-0000-000000000002',
      log_id: 'log-f001-0000-0000-000000000001',
      body: 'How did you handle token expiry edge cases?',
      user: userPick(demoUsers[1]),
      created_at: hoursAgo(1),
    },
    {
      id: 'cmt-0003-0000-0000-000000000003',
      log_id: 'log-f001-0000-0000-000000000001',
      body: 'This is inspiring me to tackle our own auth module!',
      user: { id: DEMO_USER_ID, username: 'demo_user', display_name: 'Demo User', avatar_url: null },
      created_at: hoursAgo(0),
    },
  ],
  'log-f002-0000-0000-000000000002': [
    {
      id: 'cmt-0004-0000-0000-000000000004',
      log_id: 'log-f002-0000-0000-000000000002',
      body: 'Atomic Habits changed my life too. Have you tried the habit tracker spreadsheet?',
      user: userPick(demoUsers[2]),
      created_at: hoursAgo(3),
    },
  ],
  'log-f003-0000-0000-000000000003': [
    {
      id: 'cmt-0005-0000-0000-000000000005',
      log_id: 'log-f003-0000-0000-000000000003',
      body: 'Cannot wait to read it when you are done!',
      user: userPick(demoUsers[0]),
      created_at: hoursAgo(5),
    },
    {
      id: 'cmt-0006-0000-0000-000000000006',
      log_id: 'log-f003-0000-0000-000000000003',
      body: '1,200 words in one sitting is impressive.',
      user: userPick(demoUsers[4]),
      created_at: hoursAgo(5),
    },
    {
      id: 'cmt-0007-0000-0000-000000000007',
      log_id: 'log-f003-0000-0000-000000000003',
      body: 'The confrontation scene sounds exciting!',
      user: userPick(demoUsers[1]),
      created_at: hoursAgo(4),
    },
    {
      id: 'cmt-0008-0000-0000-000000000008',
      log_id: 'log-f003-0000-0000-000000000003',
      body: 'Keep going, you are on a roll!',
      user: { id: DEMO_USER_ID, username: 'demo_user', display_name: 'Demo User', avatar_url: null },
      created_at: hoursAgo(3),
    },
  ],
  'log-f004-0000-0000-000000000004': [
    {
      id: 'cmt-0009-0000-0000-000000000009',
      log_id: 'log-f004-0000-0000-000000000004',
      body: 'Anki is a game-changer for med school!',
      user: userPick(demoUsers[0]),
      created_at: daysAgo(1),
    },
    {
      id: 'cmt-0010-0000-0000-000000000010',
      log_id: 'log-f004-0000-0000-000000000004',
      body: '3 hours of anatomy review is dedication. Respect.',
      user: userPick(demoUsers[2]),
      created_at: daysAgo(1),
    },
  ],
};

// ─── Notifications ───────────────────────────────────────────────────────────

export const demoNotifications: Notification[] = [
  {
    id: 'notif-001-0000-0000-000000000001',
    type: 'reaction',
    actor: userPick(demoUsers[0]),
    entity_type: 'log',
    entity_id: 'log-m001-0000-0000-000000000001',
    is_read: false,
    created_at: hoursAgo(1),
  },
  {
    id: 'notif-002-0000-0000-000000000002',
    type: 'comment',
    actor: userPick(demoUsers[1]),
    entity_type: 'log',
    entity_id: 'log-m001-0000-0000-000000000001',
    is_read: false,
    created_at: hoursAgo(2),
  },
  {
    id: 'notif-003-0000-0000-000000000003',
    type: 'follow',
    actor: userPick(demoUsers[3]),
    entity_type: null,
    entity_id: null,
    is_read: false,
    created_at: hoursAgo(5),
  },
  {
    id: 'notif-004-0000-0000-000000000004',
    type: 'reaction',
    actor: userPick(demoUsers[2]),
    entity_type: 'log',
    entity_id: 'log-m002-0000-0000-000000000002',
    is_read: false,
    created_at: hoursAgo(8),
  },
  {
    id: 'notif-005-0000-0000-000000000005',
    type: 'tag',
    actor: userPick(demoUsers[0]),
    entity_type: 'log',
    entity_id: 'log-f001-0000-0000-000000000001',
    is_read: false,
    created_at: hoursAgo(12),
  },
  {
    id: 'notif-006-0000-0000-000000000006',
    type: 'comment',
    actor: userPick(demoUsers[4]),
    entity_type: 'log',
    entity_id: 'log-m002-0000-0000-000000000002',
    is_read: true,
    created_at: daysAgo(1),
  },
  {
    id: 'notif-007-0000-0000-000000000007',
    type: 'reaction',
    actor: userPick(demoUsers[1]),
    entity_type: 'log',
    entity_id: 'log-m002-0000-0000-000000000002',
    is_read: true,
    created_at: daysAgo(1),
  },
  {
    id: 'notif-008-0000-0000-000000000008',
    type: 'follow',
    actor: userPick(demoUsers[4]),
    entity_type: null,
    entity_id: null,
    is_read: true,
    created_at: daysAgo(2),
  },
  {
    id: 'notif-009-0000-0000-000000000009',
    type: 'reaction',
    actor: userPick(demoUsers[0]),
    entity_type: 'log',
    entity_id: 'log-m004-0000-0000-000000000004',
    is_read: true,
    created_at: daysAgo(3),
  },
  {
    id: 'notif-010-0000-0000-000000000010',
    type: 'comment',
    actor: userPick(demoUsers[2]),
    entity_type: 'log',
    entity_id: 'log-m004-0000-0000-000000000004',
    is_read: true,
    created_at: daysAgo(3),
  },
  {
    id: 'notif-011-0000-0000-000000000011',
    type: 'reaction',
    actor: userPick(demoUsers[4]),
    entity_type: 'log',
    entity_id: 'log-m004-0000-0000-000000000004',
    is_read: true,
    created_at: daysAgo(4),
  },
  {
    id: 'notif-012-0000-0000-000000000012',
    type: 'tag',
    actor: userPick(demoUsers[2]),
    entity_type: 'log',
    entity_id: 'log-f007-0000-0000-000000000007',
    is_read: true,
    created_at: daysAgo(5),
  },
];

// ─── Streak & Goal ───────────────────────────────────────────────────────────

export const demoStreak: Streak = {
  current_streak: 7,
  longest_streak: 21,
  last_log_date: todayDate(),
};

export const demoGoal: Goal = {
  id: 'goal-0001-0000-0000-000000000001',
  type: 'days',
  target: 5,
  week_start: weekStart(),
  days_logged: 3,
  minutes_logged: 285,
  is_completed: false,
  created_at: daysAgo(14),
};

// ─── Follower / Following Lists ──────────────────────────────────────────────

export const demoFollowers: FollowUser[] = demoUsers
  .filter((u) => u.is_following === true)
  .map((u) => ({
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    is_following: true,
  }));

export const demoFollowing: FollowUser[] = demoUsers
  .filter((u) => u.is_following === true)
  .map((u) => ({
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    is_following: true,
  }));
