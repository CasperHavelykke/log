import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").unique(),
  emailVerified: integer("email_verified", { mode: "timestamp_ms" }),
  name: text("name"),
  image: text("image"),
  focusProjectId: integer("focus_project_id"),
  // Brugerpræferencer: feature-flags der styrer hvilke sektioner der vises
  fasteEnabled: integer("faste_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  garminSleepEnabled: integer("garmin_sleep_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  trainingEnabled: integer("training_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  // Hemmeligt token til offentlig deling af hele opskriftssamlingen
  // (/samling/{token}). null = deling slået fra.
  recipesShareToken: text("recipes_share_token"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

// Auth.js — provider-link tabel (Google, magic-link osv.)
export const accounts = sqliteTable(
  "accounts",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user").on(t.userId),
  ],
);

// Auth.js — DB-baserede sessions (gør revoke muligt)
export const authSessions = sqliteTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

// Auth.js — engangs-tokens til magic link
export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const oauthClients = sqliteTable("oauth_clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().unique(),
  clientSecretHash: text("client_secret_hash").notNull(),
  name: text("name").notNull(),
  redirectUris: text("redirect_uris").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const oauthAuthCodes = sqliteTable("oauth_auth_codes", {
  code: text("code").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  scope: text("scope"),
  codeChallenge: text("code_challenge"),
  codeChallengeMethod: text("code_challenge_method"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const oauthAccessTokens = sqliteTable("oauth_access_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const timeEntries = sqliteTable(
  "time_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    hoursX10: integer("hours_x10").notNull(),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [uniqueIndex("time_entries_user_project_date").on(t.userId, t.projectId, t.date)],
);

export const jobApplications = sqliteTable("job_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  role: text("role"),
  status: text("status").notNull().default("sent"),
  files: text("files"),
  url: text("url"),
  contactPerson: text("contact_person"),
  notes: text("notes"),
  applicationText: text("application_text"),
  sentAt: text("sent_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const jobSearchPeriods = sqliteTable(
  "job_search_periods",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("job_search_periods_user").on(t.userId, t.startedAt),
    index("job_search_periods_active").on(t.userId, t.endedAt),
  ],
);

export type JobSearchPeriod = typeof jobSearchPeriods.$inferSelect;
export type NewJobSearchPeriod = typeof jobSearchPeriods.$inferInsert;

export const applicationEvents = sqliteTable(
  "application_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    applicationId: integer("application_id")
      .notNull()
      .references(() => jobApplications.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note"),
    occurredAt: text("occurred_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("application_events_application").on(t.applicationId),
    index("application_events_user").on(t.userId),
  ],
);

export const sleepEntries = sqliteTable(
  "sleep_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    source: text("source").notNull().default("garmin"),
    durationMin: integer("duration_min"),
    score: integer("score"),
    qualityLabel: text("quality_label"),
    deepMin: integer("deep_min"),
    lightMin: integer("light_min"),
    remMin: integer("rem_min"),
    awakeMin: integer("awake_min"),
    avgStress: integer("avg_stress"),
    breathingVariation: text("breathing_variation"),
    restlessMoments: integer("restless_moments"),
    avgHeartRate: integer("avg_heart_rate"),
    restingHeartRate: integer("resting_heart_rate"),
    bodyBatteryChange: integer("body_battery_change"),
    avgSpO2: integer("avg_spo2"),
    lowestSpO2: integer("lowest_spo2"),
    avgBreathingX10: integer("avg_breathing_x10"),
    lowestBreathingX10: integer("lowest_breathing_x10"),
    hrvMs: integer("hrv_ms"),
    hrv7dStatus: text("hrv_7d_status"),
    rawSource: text("raw_source"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [uniqueIndex("sleep_entries_user_date").on(t.userId, t.date)],
);

export const fasts = sqliteTable(
  "fasts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [index("fasts_user_started").on(t.userId, t.startedAt)],
);

// Genstande-tæller — én session pr. aften ude. Alle drinks bogføres på
// session_date (typisk start-datoen) så krydsning af midnat ikke flytter
// indtagene over på næste dag i dayEntries.alcoholUnits.
export const drinkSessions = sqliteTable(
  "drink_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionDate: text("session_date").notNull(),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [index("drink_sessions_user_started").on(t.userId, t.startedAt)],
);

export const drinkLogs = sqliteTable(
  "drink_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => drinkSessions.id, { onDelete: "cascade" }),
    unitCount: integer("unit_count").notNull(),
    kind: text("kind").notNull(),
    occurredAt: text("occurred_at").notNull(),
  },
  (t) => [index("drink_logs_session_occurred").on(t.sessionId, t.occurredAt)],
);

export type DrinkSession = typeof drinkSessions.$inferSelect;
export type DrinkLog = typeof drinkLogs.$inferSelect;

export const supplements = sqliteTable("supplements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  defaultDoseAmountX100: integer("default_dose_amount_x100"),
  defaultDoseUnit: text("default_dose_unit"),
  defaultTimeOfDay: text("default_time_of_day"),
  notes: text("notes"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const supplementIntakes = sqliteTable(
  "supplement_intakes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Denormaliseret: vi gemmer navnet direkte. Intakes er bundet til
    // tilskuddet via navnet (case-insensitive ved aggregering), ikke en FK.
    name: text("name").notNull().default(""),
    // Beholdes som attribution men har ingen FK-beskyttelse længere.
    // ON DELETE SET NULL gør at sletning af et template-tilskud ikke
    // rører historiske intakes.
    supplementId: integer("supplement_id").references(
      () => supplements.id,
      { onDelete: "set null" },
    ),
    date: text("date").notNull(),
    doseAmountX100: integer("dose_amount_x100"),
    doseUnit: text("dose_unit"),
    timeOfDay: text("time_of_day"),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("supplement_intakes_user_date").on(t.userId, t.date),
    index("supplement_intakes_name").on(t.userId, t.name),
  ],
);

export const weekGoals = sqliteTable(
  "week_goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(),
    text: text("text").notNull().default(""),
    applicationsTarget: integer("applications_target"),
    focusHoursTargetX10: integer("focus_hours_target_x10"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [uniqueIndex("week_goals_user_week").on(t.userId, t.weekStart)],
);

export const dayEntries = sqliteTable(
  "day_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    mood: integer("mood"),
    energy: integer("energy"),
    sleepHours: integer("sleep_hours_x10"),
    sleepQuality: integer("sleep_quality"),
    alcoholUnits: integer("alcohol_units"),
    workNotes: text("work_notes"),
    healthNotes: text("health_notes"),
    dayNotes: text("day_notes"),
    wentWell: text("went_well"),
    nextStep: text("next_step"),
    applicationsTarget: integer("applications_target"),
    focusHoursTargetX10: integer("focus_hours_target_x10"),
    goalNote: text("goal_note"),
    didExercise: integer("did_exercise", { mode: "boolean" })
      .notNull()
      .default(false),
    exerciseIntensity: text("exercise_intensity"),
    exerciseLegacy: text("exercise"),
    didFast: integer("did_fast", { mode: "boolean" })
      .notNull()
      .default(false),
    fastHoursX10: integer("fast_hours_x10"),
    fastBreakTime: text("fast_break_time"),
    weightX10: integer("weight_x10"),
    waistX10: integer("waist_x10"),
    carbsG: integer("carbs_g"),
    proteinG: integer("protein_g"),
    fatG: integer("fat_g"),
    // Kostfibre i gram. Separat fra carbsG: EU-deklarationer angiver
    // kulhydrat EKSKL. fibre; fibre bidrager ~2 kcal/g (se lib/kcal.ts).
    fiberG: integer("fiber_g"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [uniqueIndex("day_entries_user_date").on(t.userId, t.date)],
);

export const customParameters = sqliteTable(
  "custom_parameters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // 'boolean' | 'scale_5' | 'scale_10' | 'bool_scale_5' | 'bool_scale_10' | 'number' | 'text'
    kind: text("kind").notNull(),
    unit: text("unit"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [index("custom_parameters_user").on(t.userId, t.archived)],
);

export const customParameterValues = sqliteTable(
  "custom_parameter_values",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parameterId: integer("parameter_id")
      .notNull()
      .references(() => customParameters.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    // En af disse er sat afhængigt af parameter-kind
    valueBool: integer("value_bool", { mode: "boolean" }),
    valueInt: integer("value_int"),
    valueReal: real("value_real"),
    valueText: text("value_text"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    uniqueIndex("custom_parameter_values_uniq").on(
      t.userId,
      t.parameterId,
      t.date,
    ),
    index("custom_parameter_values_date").on(t.userId, t.date),
  ],
);

export const CUSTOM_PARAMETER_KINDS = [
  "boolean",
  "scale_5",
  "scale_10",
  "bool_scale_5",
  "bool_scale_10",
  "number",
  "text",
] as const;
export type CustomParameterKind = (typeof CUSTOM_PARAMETER_KINDS)[number];

export type CustomParameter = typeof customParameters.$inferSelect;
export type NewCustomParameter = typeof customParameters.$inferInsert;
export type CustomParameterValue = typeof customParameterValues.$inferSelect;
export type NewCustomParameterValue = typeof customParameterValues.$inferInsert;

export const trackers = sqliteTable(
  "trackers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    notes: text("notes"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [index("trackers_user_archived").on(t.userId, t.archived)],
);

export const photos = sqliteTable(
  "photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackerId: integer("tracker_id").references(() => trackers.id, {
      onDelete: "set null",
    }),
    // Legacy felter — bevares for backward compat. Nye uploads bruger trackerId.
    category: text("category").notNull(),
    bodyArea: text("body_area"),
    caption: text("caption"),
    blobUrl: text("blob_url").notNull(),
    blobPathname: text("blob_pathname").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    takenAt: text("taken_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("photos_user_taken").on(t.userId, t.takenAt),
    index("photos_tracker").on(t.trackerId),
  ],
);

export const TRACKER_KINDS = [
  "skin_spot",
  "dermatitis",
  "staph",
  "weight",
  "waist",
  "other",
] as const;
export type TrackerKind = (typeof TRACKER_KINDS)[number];

export type Tracker = typeof trackers.$inferSelect;
export type NewTracker = typeof trackers.$inferInsert;

export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    filename: text("filename").notNull(),
    blobUrl: text("blob_url").notNull(),
    blobPathname: text("blob_pathname").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    extractedText: text("extracted_text"),
    jobApplicationId: integer("job_application_id").references(
      () => jobApplications.id,
      { onDelete: "set null" },
    ),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("documents_user_kind").on(t.userId, t.kind),
    index("documents_job_app").on(t.jobApplicationId),
  ],
);

export const recipes = sqliteTable(
  "recipes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Fri tekst — én ingrediens per linje. Bevidst ustruktureret for hurtig
    // indtastning på mobil.
    ingredients: text("ingredients").notNull().default(""),
    steps: text("steps").notNull().default(""),
    // Fri-tekst noter (tips, makro-forklaringer, holdbarhed) — vises som
    // almindelige afsnit, IKKE nummererede trin.
    notes: text("notes"),
    servings: integer("servings"),
    sourceUrl: text("source_url"),
    // Makroer PER PORTION — kun reference, ingen automatisk logning.
    // fiberG er separat fra carbsG (EU-deklaration: kulhydrat ekskl. fibre).
    carbsG: integer("carbs_g"),
    proteinG: integer("protein_g"),
    fatG: integer("fat_g"),
    fiberG: integer("fiber_g"),
    // Valgfrit billede — fil ligger under data/recipes/, kun sti+mime i DB.
    imagePathname: text("image_pathname"),
    imageMime: text("image_mime"),
    // Hemmeligt token til offentligt delelink (/r/{token}).
    // null = deling slået fra.
    shareToken: text("share_token"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index("recipes_user").on(t.userId),
    uniqueIndex("recipes_share_token").on(t.shareToken),
  ],
);

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

// Træningssessioner (avanceret træningstracking — opt-in feature).
export const workouts = sqliteTable(
  "workouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // ISO YYYY-MM-DD
    title: text("title").notNull(),
    durationMin: integer("duration_min"),
    // Fri tekst — én øvelse per linje ('Navn — sæt×reps @ vægt').
    // Linjer der ender med ':' er under-overskrifter, alt andet noter.
    // Bevidst ustruktureret så alle træningsformer kan rummes.
    body: text("body").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [index("workouts_user_date").on(t.userId, t.date)],
);

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;

// Trænings-skabeloner: et gemt program ("Pull + press A") der kan
// forudfylde en ny session. Samme body-format som workouts.
export const workoutTemplates = sqliteTable(
  "workout_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    durationMin: integer("duration_min"),
    body: text("body").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [index("workout_templates_user").on(t.userId)],
);

export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type NewWorkoutTemplate = typeof workoutTemplates.$inferInsert;

// --- Planlægger -------------------------------------------------------------
// Tilbagevendende planer for projekter, kosttilskud, træning, ernærings-mål
// og måltider. Vises samlet som "Dagens plan" på /today; redigeres decentralt
// dér hvor tingene bor. Forekomster materialiseres IKKE — de beregnes ved
// læsning ud fra scheduleType (se src/lib/plan.ts).

export const PLAN_KINDS = [
  "project",
  "supplement",
  "training",
  "nutrition",
  "meal",
] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export const PLAN_SCHEDULE_TYPES = ["weekdays", "interval", "monthly"] as const;
export type PlanScheduleType = (typeof PLAN_SCHEDULE_TYPES)[number];

export const planItems = sqliteTable(
  "plan_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // PlanKind
    // FK per kind — set-null så sletning af målet ikke sletter planen
    // (den vises så med label som fallback / kan ryddes op af brugeren).
    projectId: integer("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    supplementId: integer("supplement_id").references(() => supplements.id, {
      onDelete: "set null",
    }),
    workoutTemplateId: integer("workout_template_id").references(
      () => workoutTemplates.id,
      { onDelete: "set null" },
    ),
    // Fritekst-navn: måltider, træning uden skabelon, fallback ved slettet FK.
    label: text("label"),
    // Gentagelse: 'weekdays' = fast ugedags-sæt; 'interval' = hver N. dag i
    // FAST kalender-rytme fra anchorDate (misset dag skrider ikke);
    // 'monthly' = månedligt på anchorDates dag-i-måneden (clampet til
    // månedens sidste dag).
    scheduleType: text("schedule_type").notNull(), // PlanScheduleType
    weekdays: text("weekdays"), // "0,2,4" — 0=mandag..6=søndag
    intervalDays: integer("interval_days"),
    anchorDate: text("anchor_date"), // ISO YYYY-MM-DD
    timeOfDay: text("time_of_day"), // fritekst, fx "formiddag" eller "08:30"
    // project-kind: planlagt tid den dag.
    minutesPlanned: integer("minutes_planned"),
    // nutrition-kind: mål for dagen (samme enheder som day_entries).
    kcalTarget: integer("kcal_target"),
    carbsTargetG: integer("carbs_target_g"),
    proteinTargetG: integer("protein_target_g"),
    fatTargetG: integer("fat_target_g"),
    fiberTargetG: integer("fiber_target_g"),
    paused: integer("paused", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [index("plan_items_user").on(t.userId)],
);

// Per-dag markeringer: 'done' (manuel afkrydsning, fx måltider) og 'skip'
// ("ikke i dag" — fjerner posten fra dagens kort uden at røre rytmen).
export const planMarks = sqliteTable(
  "plan_marks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planItemId: integer("plan_item_id")
      .notNull()
      .references(() => planItems.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // ISO YYYY-MM-DD
    kind: text("kind").notNull(), // 'done' | 'skip'
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [uniqueIndex("plan_marks_item_date").on(t.planItemId, t.date)],
);

export type PlanItem = typeof planItems.$inferSelect;
export type NewPlanItem = typeof planItems.$inferInsert;
export type PlanMark = typeof planMarks.$inferSelect;
export type NewPlanMark = typeof planMarks.$inferInsert;

export const PHOTO_CATEGORIES = ["skin_spot", "body_progress", "other"] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export const DOCUMENT_KINDS = [
  "application",
  "cv",
  "job_posting",
  "reference",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;

export type OAuthClient = typeof oauthClients.$inferSelect;
export type NewOAuthClient = typeof oauthClients.$inferInsert;
export type OAuthAuthCode = typeof oauthAuthCodes.$inferSelect;
export type NewOAuthAuthCode = typeof oauthAuthCodes.$inferInsert;
export type OAuthAccessToken = typeof oauthAccessTokens.$inferSelect;
export type NewOAuthAccessToken = typeof oauthAccessTokens.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
export type JobApplication = typeof jobApplications.$inferSelect;
export type NewJobApplication = typeof jobApplications.$inferInsert;
export type ApplicationEvent = typeof applicationEvents.$inferSelect;
export type NewApplicationEvent = typeof applicationEvents.$inferInsert;
export type SleepEntry = typeof sleepEntries.$inferSelect;
export type NewSleepEntry = typeof sleepEntries.$inferInsert;
export type Fast = typeof fasts.$inferSelect;
export type NewFast = typeof fasts.$inferInsert;

export const FAST_QUALIFIED_MINUTES = 16 * 60;
export type Supplement = typeof supplements.$inferSelect;
export type NewSupplement = typeof supplements.$inferInsert;
export type SupplementIntake = typeof supplementIntakes.$inferSelect;
export type NewSupplementIntake = typeof supplementIntakes.$inferInsert;

export const TIME_OF_DAY = ["morning", "midday", "evening", "night"] as const;
export type TimeOfDay = (typeof TIME_OF_DAY)[number];
export type WeekGoal = typeof weekGoals.$inferSelect;
export type NewWeekGoal = typeof weekGoals.$inferInsert;
export type DayEntry = typeof dayEntries.$inferSelect;
export type NewDayEntry = typeof dayEntries.$inferInsert;

export const JOB_STATUSES = [
  "sent",
  "no_response",
  "replied",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
