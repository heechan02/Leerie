// Wire shapes for the two tables this app writes to. Column names come from
// supabase/migrations/20261108000000_light_readings.sql; keep them in sync.

import '../core/geo.dart';

/// Set per build with `--dart-define=DEVICE_MODEL=iphone-<model>`, so the pipeline can calibrate phones apart.
const deviceModel = String.fromEnvironment('DEVICE_MODEL');

/// One row of `light_readings`. Posted in batches of `breadcrumbBatchSeconds`.
class Breadcrumb {
  const Breadcrumb({
    required this.recordedAt,
    required this.lat,
    required this.lng,
    this.gpsAccuracyM,
    this.speedMps,
    this.brightness,
    this.iso,
    this.exposureS,
    this.aperture,
  });

  final DateTime recordedAt;
  final double lat;
  final double lng;
  final double? gpsAccuracyM;
  final double? speedMps;

  /// Mean exposure-corrected luminance of the frames since the previous point.
  final double? brightness;
  final double? iso;
  final double? exposureS;
  final double? aperture;

  Map<String, dynamic> toJson({required String sessionId}) {
    return <String, dynamic>{
      'session_id': sessionId,
      'recorded_at': recordedAt.toUtc().toIso8601String(),
      'location': ewktPoint(lng, lat),
      'gps_accuracy_m': gpsAccuracyM,
      'speed_mps': speedMps,
      'brightness': brightness,
      'iso': iso,
      'exposure_s': exposureS,
      'aperture': aperture,
      'device_model': deviceModel.isEmpty ? null : deviceModel,
    };
  }
}

/// One row of `incidents`: a comfortable/uncomfortable tap. No photo, no name.
class Incident {
  const Incident({
    required this.createdAt,
    required this.lat,
    required this.lng,
    required this.category,
    this.gpsAccuracyM,
    this.sessionId,
  });

  final DateTime createdAt;
  final double lat;
  final double lng;
  final double? gpsAccuracyM;

  /// 'comfortable', or why it felt uncomfortable: 'dark', 'followed', 'harassment', 'other'.
  final String category;
  final String? sessionId;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'session_id': sessionId,
        'created_at': createdAt.toUtc().toIso8601String(),
        'location': ewktPoint(lng, lat),
        'gps_accuracy_m': gpsAccuracyM,
        'category': category,
      };
}
