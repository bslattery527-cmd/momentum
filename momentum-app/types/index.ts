// ─── Core Entities ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  goal_category?: string | null;
  created_at: string;
}

export interface PublicUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  current_streak: number;
  longest_streak: number;
  is_following: boolean | null;
  log_count: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  is_default: boolean;
}

// ─── Log Entities ───────────────────────────────────────────────────────────

export interface LogTask {
  id: string;
  category_id: string;
  task_name: string;
  duration: number; // seconds
  sort_order: number;
  category?: Category;
}

export interface LogImage {
  id: string;
  public_url: string;
  width: number | null;
  height: number | null;
  sort_order: number;
}

export interface Log {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  total_duration: number; // seconds
  started_at: string | null;
  ended_at: string | null;
  is_published: boolean;
  published_at: string | null;
  tasks: LogTask[];
  images: LogImage[];
  tagged_users: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>[];
  reaction_count: number;
  comment_count: number;
  created_at: string;
}

export interface FeedItem extends Log {
  user: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  has_reacted: boolean;
  streak_at_time: number;
}

// ─── Social Entities ────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  log_id: string;
  body: string;
  user: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  created_at: string;
}

export interface Notification {
  id: string;
  type: 'reaction' | 'comment' | 'follow' | 'tag';
  actor: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ─── Streak & Goal ──────────────────────────────────────────────────────────

export interface Streak {
  current_streak: number;
  longest_streak: number;
  last_log_date: string | null;
}

export interface Goal {
  id: string;
  type: 'days' | 'hours';
  target: number;
  week_start: string;
  days_logged: number;
  minutes_logged: number;
  is_completed: boolean;
  created_at: string;
}

// ─── API Types ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

export interface PaginationMeta {
  cursor: string | null;
  has_more: boolean;
  total?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── Auth Types ─────────────────────────────────────────────────────────────

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface RegisterPayload {
  email: string;
  password: string;
  display_name: string;
  username: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface GoogleAuthPayload {
  id_token: string;
}

export interface AppleAuthPayload {
  identity_token: string;
  display_name?: string;
}

// ─── Log Creation Types ─────────────────────────────────────────────────────

export interface CreateLogPayload {
  title: string;
  note?: string;
  is_published: boolean;
  started_at?: string;
  ended_at?: string;
  tasks: {
    task_name: string;
    category_id: string;
    duration: number;
  }[];
  tagged_user_ids?: string[];
  image_ids?: string[];
}

export interface UpdateLogPayload {
  title?: string;
  note?: string;
  is_published?: boolean;
}

// ─── Goal Creation Types ────────────────────────────────────────────────────

export interface CreateGoalPayload {
  type: 'days' | 'hours';
  target: number;
}

// ─── Image Upload Types ─────────────────────────────────────────────────────

export interface ImageUploadRequest {
  images: {
    mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
    file_size: number;
  }[];
}

export interface ImageUploadResponse {
  image_id: string;
  upload_url: string;
  public_url: string;
}

// ─── User Update Types ──────────────────────────────────────────────────────

export interface UpdateUserPayload {
  display_name?: string;
  bio?: string | null;
  avatar_url?: string | null;
  goal_category?: string | null;
  username?: string;
}

// ─── Follow Types ───────────────────────────────────────────────────────────

export interface FollowUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_following?: boolean;
}
