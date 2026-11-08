// Build-time config. Set with --dart-define or --dart-define-from-file=.env.

const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

/// Light readings are posted in batches this many seconds apart.
const breadcrumbBatchSeconds = 20;

/// Retry backoff for the upload queue, in seconds, by attempt count.
const uploadRetrySeconds = <int>[2, 5, 15, 30, 60];
