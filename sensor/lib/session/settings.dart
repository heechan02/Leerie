// What the walker can change, persisted across restarts: where the readings go.

import 'package:shared_preferences/shared_preferences.dart';

import '../data/supabase_rest.dart';

class SensorSettings {
  SensorSettings({
    this.uploadEnabled = true,
    this.supabaseUrlOverride = '',
    this.supabaseKeyOverride = '',
  });

  /// Off means measure, write nothing. Useful before the backend is up.
  bool uploadEnabled;

  /// Set in the app; overrides the --dart-define values when non-empty.
  String supabaseUrlOverride;
  String supabaseKeyOverride;

  SupabaseConfig get supabase {
    final url = supabaseUrlOverride.trim().isNotEmpty
        ? supabaseUrlOverride.trim()
        : SupabaseConfig.fromEnvironment.url;
    final key = supabaseKeyOverride.trim().isNotEmpty
        ? supabaseKeyOverride.trim()
        : SupabaseConfig.fromEnvironment.anonKey;
    return SupabaseConfig(url: url, anonKey: key);
  }

  static const _kUpload = 'upload_enabled';
  static const _kUrl = 'supabase_url';
  static const _kKey = 'supabase_key';

  static Future<SensorSettings> load() async {
    final prefs = await SharedPreferences.getInstance();
    return SensorSettings(
      uploadEnabled: prefs.getBool(_kUpload) ?? true,
      supabaseUrlOverride: prefs.getString(_kUrl) ?? '',
      supabaseKeyOverride: prefs.getString(_kKey) ?? '',
    );
  }

  Future<void> save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kUpload, uploadEnabled);
    await prefs.setString(_kUrl, supabaseUrlOverride);
    await prefs.setString(_kKey, supabaseKeyOverride);
  }
}
