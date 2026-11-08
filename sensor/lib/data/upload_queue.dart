// A walk goes through places with no signal. Everything bound for Supabase goes through
// this queue: one job at a time, in order, retried with a backoff, and counted in
// the header so the operator can see the phone is behind rather than broken.
//
// Nothing here is durable across a restart. That is a deliberate limit for the
// MVP; the queue survives a tunnel, not a crash.

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../config.dart';
import 'models.dart';
import 'supabase_rest.dart';

abstract class UploadJob {
  int attempts = 0;

  /// Give up after this many failures. Reports are worth more retries than a batch of readings.
  int get maxAttempts;

  String get describe;

  Future<void> run(SupabaseRest rest);

  void onGaveUp() {}
}

class PositionsJob extends UploadJob {
  PositionsJob({required this.batch, required this.sessionId});

  final List<Breadcrumb> batch;
  final String sessionId;

  @override
  int get maxAttempts => 3;

  @override
  String get describe => '${batch.length} positions';

  @override
  Future<void> run(SupabaseRest rest) =>
      rest.postPositions(batch, sessionId: sessionId);
}

class IncidentJob extends UploadJob {
  IncidentJob(this.incident);

  final Incident incident;

  @override
  int get maxAttempts => 8;

  @override
  String get describe => 'Report (${incident.category})';

  @override
  Future<void> run(SupabaseRest rest) => rest.postIncident(incident);
}

class UploadQueue extends ChangeNotifier {
  UploadQueue({SupabaseRest? rest}) : _rest = rest;

  SupabaseRest? _rest;
  final List<UploadJob> _jobs = <UploadJob>[];
  bool _running = false;
  Timer? _retry;

  /// The last thing that went wrong, in plain English. Stated once; not repeated
  /// as a warning on every row.
  String? lastError;

  int get pending => _jobs.length;
  bool get isIdle => _jobs.isEmpty && !_running;

  set rest(SupabaseRest? value) {
    _rest = value;
    notifyListeners();
    if (value != null) unawaited(_pump());
  }

  SupabaseRest? get rest => _rest;

  void add(UploadJob job) {
    _jobs.add(job);
    notifyListeners();
    unawaited(_pump());
  }

  /// Try again now rather than waiting out the backoff.
  void retryNow() {
    _retry?.cancel();
    _retry = null;
    unawaited(_pump());
  }

  void clear() {
    _retry?.cancel();
    _retry = null;
    for (final job in _jobs) {
      job.onGaveUp();
    }
    _jobs.clear();
    notifyListeners();
  }

  Future<void> _pump() async {
    if (_running) return;
    final rest = _rest;
    if (rest == null || _jobs.isEmpty) return;

    _running = true;
    notifyListeners();

    while (_jobs.isNotEmpty) {
      final job = _jobs.first;
      try {
        await job.run(rest);
        _jobs.removeAt(0);
        lastError = null;
        notifyListeners();
      } on Object catch (error) {
        job.attempts++;
        lastError = error.toString();
        if (job.attempts >= job.maxAttempts) {
          _jobs.removeAt(0);
          job.onGaveUp();
          notifyListeners();
          continue;
        }
        _running = false;
        notifyListeners();
        _scheduleRetry(job.attempts);
        return;
      }
    }

    _running = false;
    notifyListeners();
  }

  void _scheduleRetry(int attempts) {
    _retry?.cancel();
    final index = (attempts - 1).clamp(0, uploadRetrySeconds.length - 1);
    _retry = Timer(Duration(seconds: uploadRetrySeconds[index]), () {
      _retry = null;
      unawaited(_pump());
    });
  }

  @override
  void dispose() {
    _retry?.cancel();
    super.dispose();
  }
}
