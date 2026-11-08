// The one place the app's moving parts meet: camera frames, GPS fixes, the walk,
// reports, and the upload queue. Everything a widget needs to draw comes off this object.

import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/widgets.dart';
import 'package:geolocator/geolocator.dart';
import 'package:uuid/uuid.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../config.dart';
import '../core/geo.dart';
import '../data/models.dart';
import '../data/supabase_rest.dart';
import '../data/upload_queue.dart';
import '../detect/luminance.dart';
import 'settings.dart';

enum CameraStatus {
  idle('Camera idle'),
  starting('Starting the camera'),
  ready('Measuring light'),
  denied('Camera access refused'),
  unavailable('No usable camera');

  const CameraStatus(this.label);
  final String label;
}

enum LocationStatus {
  unknown('Waiting for a fix'),
  denied('Location access refused'),
  serviceOff('Location services are off'),
  ready('Positioned');

  const LocationStatus(this.label);
  final String label;
}

enum RecordingState { idle, starting, recording, stopping }

class SessionController extends ChangeNotifier {
  SessionController(this._settings) {
    _rebuildRest();
  }

  SensorSettings _settings;
  SensorSettings get settings => _settings;

  final UploadQueue queue = UploadQueue();
  final Uuid _uuid = const Uuid();

  SupabaseRest? _rest;

  CameraController? camera;
  CameraStatus cameraStatus = CameraStatus.idle;
  String? cameraError;

  LocationStatus locationStatus = LocationStatus.unknown;
  Position? lastPosition;

  RecordingState recording = RecordingState.idle;
  DateTime? startedAt;
  String? tripId;

  /// Stated in the footer when something needs saying. Plain English, once.
  String? notice;

  double distanceM = 0;

  /// Latest exposure-corrected luminance, relative units. Null until the camera reports exposure.
  double? luminance;
  double _lumSum = 0;
  int _lumCount = 0;
  ({double? iso, double? exposureS, double? aperture})? _lastExposure;
  ({double? iso, double? exposureS, double? aperture})? get exposure => _lastExposure;
  int readingsRecorded = 0;
  DateTime _lastLumPaint = DateTime(0);
  bool _loggedStride = false;

  StreamSubscription<Position>? _posSub;
  Timer? _flushTimer;

  final List<Breadcrumb> _breadcrumbs = <Breadcrumb>[];
  DateTime? _lastBreadcrumbAt;
  Position? _lastDistanceFix;

  bool _disposed = false;

  // ─── Derived state for the console ────────────────────────────────────────

  bool get isRecording => recording == RecordingState.recording;
  bool get supabaseConfigured => _settings.supabase.isConfigured;
  bool get uploadsOn => _settings.uploadEnabled && supabaseConfigured;
  int get pendingUploads => queue.pending;

  /// Display aspect of the preview, width over height, portrait.
  double get previewAspect {
    final controller = camera;
    if (controller == null || !controller.value.isInitialized) return 9 / 16;
    final ratio = controller.value.aspectRatio;
    return ratio <= 0 ? 9 / 16 : 1 / ratio;
  }

  double get kmScanned => distanceM / 1000.0;

  /// What the footer says the app is doing. Measurement, then inference.
  String get statusLine {
    if (cameraStatus == CameraStatus.denied) {
      return 'Camera access refused. Allow it in Settings, then reopen the app.';
    }
    if (recording == RecordingState.starting) return 'Starting the walk';
    if (recording == RecordingState.stopping) return 'Ending the walk';
    if (isRecording) {
      final started = startedAt;
      final since = started == null ? '' : ' since ${_hhmm(started)}';
      return uploadsOn
          ? 'Recording$since · writing to ${_settings.supabase.host}'
          : 'Recording$since · held on the phone';
    }
    // The upload line under it already says when Supabase is not set.
    return 'Not recording.';
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  Future<void> start() async {
    await _initCamera();
    await _initLocation();
  }

  Future<void> _initCamera() async {
    // The retry button and a resume can both land here with a controller still
    // held; a second one on the same sensor fails on most devices.
    await _disposeCamera();
    _set(() {
      cameraStatus = CameraStatus.starting;
      cameraError = null;
    });
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        _set(() => cameraStatus = CameraStatus.unavailable);
        return;
      }
      // iPhones list each back lens separately; lock to the main wide one so readings stay comparable.
      final back = cameras.where((c) => c.lensDirection == CameraLensDirection.back);
      final description = back.where((c) => c.lensType == CameraLensType.wide).firstOrNull ??
          back.firstOrNull ??
          cameras.first;

      final controller = CameraController(
        description,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.yuv420,
      );
      await controller.initialize();
      if (_disposed) {
        await controller.dispose();
        return;
      }

      camera = controller;
      await controller.startImageStream(_handleFrame);
      _set(() => cameraStatus = CameraStatus.ready);
    } on CameraException catch (error) {
      _set(() {
        cameraStatus = error.code == 'CameraAccessDenied' ||
                error.code == 'CameraAccessDeniedWithoutPrompt'
            ? CameraStatus.denied
            : CameraStatus.unavailable;
        cameraError = error.description ?? error.code;
      });
    } on Object catch (error) {
      _set(() {
        cameraStatus = CameraStatus.unavailable;
        cameraError = error.toString();
      });
    }
  }

  Future<void> _disposeCamera() async {
    final controller = camera;
    camera = null;
    if (controller == null) return;
    try {
      if (controller.value.isStreamingImages) await controller.stopImageStream();
    } on Object catch (_) {
      // Stopping a stream that has already gone is not worth reporting.
    }
    await controller.dispose();
  }

  Future<void> _initLocation() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        _set(() => locationStatus = LocationStatus.serviceOff);
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        _set(() => locationStatus = LocationStatus.denied);
        return;
      }

      await _posSub?.cancel();
      _posSub = Geolocator.getPositionStream(
        // Platform defaults throttle to ~1 fix per 5 s; ask for 1 Hz on both.
        locationSettings: Platform.isIOS
            ? AppleSettings(
                accuracy: LocationAccuracy.bestForNavigation,
                activityType: ActivityType.fitness,
                distanceFilter: 0,
                pauseLocationUpdatesAutomatically: false,
                allowBackgroundLocationUpdates: false,
              )
            : AndroidSettings(
                accuracy: LocationAccuracy.bestForNavigation,
                distanceFilter: 0,
                intervalDuration: const Duration(seconds: 1),
              ),
      ).listen(_onPosition, onError: (Object error) {
        debugPrint('Leerie: position stream error. $error');
      });
    } on Object catch (error) {
      debugPrint('Leerie: location unavailable. $error');
      _set(() => locationStatus = LocationStatus.denied);
    }
  }

  /// Android tears the camera away when the app leaves the foreground.
  ///
  /// Deliberately not on `inactive`: that fires for the camera and location
  /// permission prompts too, and tearing the controller down underneath its own
  /// permission dialog is how the camera ends up dead on first run.
  Future<void> handleLifecycle(AppLifecycleState state) async {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      await _disposeCamera();
      _set(() => cameraStatus = CameraStatus.idle);
    } else if (state == AppLifecycleState.resumed && camera == null && !_disposed) {
      await _initCamera();
    }
  }

  // ─── Frames ───────────────────────────────────────────────────────────────

  void _handleFrame(CameraImage image) {
    if (_disposed) return;

    if (!_loggedStride) {
      _loggedStride = true;
      debugPrint('Leerie: Y plane bytesPerRow=${image.planes[0].bytesPerRow} width=${image.width}');
    }
    final lum = relativeLuminance(
      image.planes[0].bytes,
      exposureNs: image.sensorExposureTime,
      iso: image.sensorSensitivity,
      aperture: image.lensAperture,
      videoRange: Platform.isIOS,
    );
    _lastExposure = (
      iso: image.sensorSensitivity,
      exposureS: image.sensorExposureTime == null ? null : image.sensorExposureTime! / 1e9,
      aperture: image.lensAperture,
    );
    if (lum != null) {
      _lumSum += lum;
      _lumCount++;
      luminance = lum;
    }
    // Repaint the readout twice a second even without a GPS fix (indoors).
    final now = DateTime.now();
    if (now.difference(_lastLumPaint).inMilliseconds >= 500) {
      _lastLumPaint = now;
      notifyListeners();
    }
  }

  // ─── Positions ────────────────────────────────────────────────────────────

  void _onPosition(Position position) {
    lastPosition = position;
    if (locationStatus != LocationStatus.ready) locationStatus = LocationStatus.ready;

    if (isRecording) {
      final last = _lastBreadcrumbAt;
      if (last == null || DateTime.now().difference(last).inMilliseconds >= 900) {
        _lastBreadcrumbAt = DateTime.now();
        final exposure = _lastExposure;
        _breadcrumbs.add(Breadcrumb(
          recordedAt: position.timestamp,
          lat: position.latitude,
          lng: position.longitude,
          gpsAccuracyM: position.accuracy,
          speedMps: position.speed,
          brightness: _lumCount == 0 ? null : _lumSum / _lumCount,
          iso: exposure?.iso,
          exposureS: exposure?.exposureS,
          aperture: exposure?.aperture,
        ));
        _lumSum = 0;
        _lumCount = 0;
        readingsRecorded++;

        final previous = _lastDistanceFix;
        if (previous != null && position.accuracy <= 30) {
          final step = haversineMetres(
            previous.latitude,
            previous.longitude,
            position.latitude,
            position.longitude,
          );
          // Ignore GPS jumps; nobody walks 120 m in a second.
          if (step < 120) distanceM += step;
        }
        if (position.accuracy <= 30) _lastDistanceFix = position;
      }
    }
    notifyListeners();
  }

  void _flushBreadcrumbs() {
    if (_breadcrumbs.isEmpty) return;
    final trip = tripId;
    final batch = List<Breadcrumb>.of(_breadcrumbs);
    _breadcrumbs.clear();
    if (trip == null || !uploadsOn) return;
    queue.add(PositionsJob(batch: batch, sessionId: trip));
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  int reportsSent = 0;

  /// One comfortable/uncomfortable tap at the current position. Returns what to tell the walker.
  String report(String category) {
    final position = lastPosition;
    if (position == null) return 'No GPS fix yet, so the report was not sent.';
    if (!uploadsOn) return 'Supabase is not set, so the report was not sent.';
    // A report needs the walk's session_id, or the hotspot trigger can never confirm it.
    if (tripId == null) return 'Start recording first, so the report belongs to this walk.';
    queue.add(IncidentJob(Incident(
      createdAt: DateTime.now(),
      lat: position.latitude,
      lng: position.longitude,
      gpsAccuracyM: position.accuracy,
      category: category,
      sessionId: tripId,
    )));
    _set(() => reportsSent++);
    return 'Sent: $category, ±${position.accuracy.round()} m.';
  }

  // ─── Walk ─────────────────────────────────────────────────────────────────

  Future<void> startRecording() async {
    if (recording != RecordingState.idle) return;
    _set(() {
      recording = RecordingState.starting;
      notice = null;
    });

    distanceM = 0;
    _breadcrumbs.clear();
    _lastDistanceFix = null;
    _lastBreadcrumbAt = null;

    // The session id: random per walk, never tied to a person or phone.
    tripId = _uuid.v4();
    readingsRecorded = 0;
    _lumSum = 0;
    _lumCount = 0;

    startedAt = DateTime.now();
    _flushTimer?.cancel();
    _flushTimer = Timer.periodic(
      const Duration(seconds: breadcrumbBatchSeconds),
      (_) => _flushBreadcrumbs(),
    );
    unawaited(WakelockPlus.enable());

    _set(() => recording = RecordingState.recording);
  }

  Future<void> stopRecording() async {
    if (recording != RecordingState.recording) return;
    _set(() => recording = RecordingState.stopping);

    _flushTimer?.cancel();
    _flushTimer = null;
    _flushBreadcrumbs();

    tripId = null;
    unawaited(WakelockPlus.disable());

    _set(() => recording = RecordingState.idle);
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  /// Applied immediately, saved shortly after: the URL and key fields call this on
  /// every keystroke, and the HTTP client must not be rebuilt for each one.
  Future<void> applySettings(SensorSettings next) async {
    _settings = next;
    _rebuildRest();
    notifyListeners();
    _scheduleSave();
  }

  /// The settings sheet mutates the controller's own settings object in place,
  /// so the incoming values cannot be compared against the outgoing ones. What
  /// was last handed to the queue is remembered here instead.
  String _appliedUrl = '';
  String _appliedKey = '';
  Timer? _saveTimer;

  void _rebuildRest() {
    final config = _settings.supabase;
    if (config.url == _appliedUrl && config.anonKey == _appliedKey) return;
    _appliedUrl = config.url;
    _appliedKey = config.anonKey;
    _rest?.close();
    _rest = config.isConfigured ? SupabaseRest(config) : null;
    queue.rest = _rest;
  }

  void _scheduleSave() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 400), () {
      unawaited(_settings.save());
    });
  }

  /// Confirm the key and the URL before the demo rather than during it.
  Future<String> checkConnection() async {
    final rest = _rest;
    if (rest == null) return 'Supabase is not configured.';
    try {
      await rest.ping();
      return 'Connected to ${_settings.supabase.host}.';
    } on Object catch (error) {
      return _short(error);
    }
  }

  void clearNotice() {
    notice = null;
    notifyListeners();
  }

  // ─── Teardown ─────────────────────────────────────────────────────────────

  Future<void> shutdown() async {
    _disposed = true;
    _flushTimer?.cancel();
    if (_saveTimer?.isActive ?? false) {
      _saveTimer!.cancel();
      await _settings.save();
    }
    await _posSub?.cancel();
    await _disposeCamera();
    unawaited(WakelockPlus.disable());
    _rest?.close();
  }

  @override
  void dispose() {
    _disposed = true;
    _flushTimer?.cancel();
    // A pending debounce must not lose the last keystroke.
    if (_saveTimer?.isActive ?? false) {
      _saveTimer!.cancel();
      unawaited(_settings.save());
    }
    _posSub?.cancel();
    queue.dispose();
    super.dispose();
  }

  void _set(void Function() change) {
    change();
    if (!_disposed) notifyListeners();
  }

  static String _hhmm(DateTime t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  static String _short(Object error) {
    final text = error.toString();
    return text.length > 160 ? '${text.substring(0, 160)}…' : text;
  }
}
