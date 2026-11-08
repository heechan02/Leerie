// PostgREST and Storage over plain HTTP. docs/ARCHITECTURE.md §3.
//
// No Supabase SDK: the app writes two tables, and the anon key goes in a header.
// Geography is sent as EWKT, longitude first. RLS lets anon insert and nothing else.

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import 'models.dart';

class SupabaseConfig {
  const SupabaseConfig({required this.url, required this.anonKey});

  /// Project URL, e.g. https://abcdefgh.supabase.co — no trailing slash.
  final String url;
  final String anonKey;

  bool get isConfigured => url.trim().isNotEmpty && anonKey.trim().isNotEmpty;

  /// Compile-time values from --dart-define, used when nothing is set in-app.
  static const fromEnvironment = SupabaseConfig(
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  );

  /// Project reference for display: "abcdefgh.supabase.co".
  String get host {
    final trimmed = url.trim();
    if (trimmed.isEmpty) return 'not set';
    return Uri.tryParse(trimmed)?.host ?? trimmed;
  }
}

class SupabaseException implements Exception {
  SupabaseException(this.what, this.statusCode, this.body);

  final String what;
  final int statusCode;
  final String body;

  @override
  String toString() {
    final detail = body.length > 180 ? '${body.substring(0, 180)}…' : body;
    return '$what failed with HTTP $statusCode. $detail';
  }
}

class SupabaseRest {
  SupabaseRest(this.config, {http.Client? client}) : _client = client ?? http.Client();

  final SupabaseConfig config;
  final http.Client _client;

  static const _timeout = Duration(seconds: 20);

  Map<String, String> get _headers => <String, String>{
        'apikey': config.anonKey,
        'Authorization': 'Bearer ${config.anonKey}',
        'Content-Type': 'application/json',
      };

  String get _base => config.url.trim().replaceAll(RegExp(r'/+$'), '');

  /// A batch of 1 Hz light readings.
  Future<void> postPositions(List<Breadcrumb> batch, {required String sessionId}) async {
    if (batch.isEmpty) return;
    final response = await _client
        .post(
          Uri.parse('$_base/rest/v1/light_readings'),
          headers: _headers,
          body: jsonEncode(batch.map((b) => b.toJson(sessionId: sessionId)).toList()),
        )
        .timeout(_timeout);

    if (response.statusCode >= 300) {
      throw SupabaseException('Post positions', response.statusCode, response.body);
    }
  }

  Future<void> postIncident(Incident incident) async {
    final response = await _client
        .post(
          Uri.parse('$_base/rest/v1/incidents'),
          headers: _headers,
          body: jsonEncode(incident.toJson()),
        )
        .timeout(_timeout);

    if (response.statusCode >= 300) {
      throw SupabaseException('Post report', response.statusCode, response.body);
    }
  }

  /// One cheap round trip, to tell "the key is wrong" from "there is no signal"
  /// before the demo rather than during it.
  Future<void> ping() async {
    final response = await _client
        .get(
          // RLS hides every row from anon, so this returns [] — but only if the key and table exist.
          Uri.parse('$_base/rest/v1/light_readings?select=id&limit=1'),
          headers: _headers,
        )
        .timeout(const Duration(seconds: 10));

    if (response.statusCode >= 300) {
      throw SupabaseException('Check connection', response.statusCode, response.body);
    }
  }

  void close() => _client.close();
}
