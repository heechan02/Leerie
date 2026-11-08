// The Leerie scanner. Read at arm's length on a night walk: who is recording,
// the live light meter as a glowing street lamp, the walk's numbers, where the
// camera points, one big Start/Stop pill and the two report buttons at thumb
// reach.

import 'package:flutter/material.dart';

import '../config.dart';
import '../core/format.dart';
import '../core/geo.dart';
import '../data/models.dart';
import '../session/session_controller.dart';
import '../session/settings.dart';
import '../theme/tokens.dart';
import 'preview_surface.dart';
import 'settings_sheet.dart';
import 'widgets/console_widgets.dart';

class ConsoleScreen extends StatefulWidget {
  const ConsoleScreen({super.key, required this.controller});

  final SessionController controller;

  @override
  State<ConsoleScreen> createState() => _ConsoleScreenState();
}

class _ConsoleScreenState extends State<ConsoleScreen> with WidgetsBindingObserver {
  SessionController get controller => widget.controller;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    controller.handleLifecycle(state);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BchColor.bg,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: <Color>[BchColor.bgTop, BchColor.bg],
          ),
        ),
        child: SafeArea(
          child: ListenableBuilder(
            listenable: Listenable.merge(<Listenable>[controller, controller.queue]),
            builder: (context, _) {
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: BchSpace.s4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    _header(context),
                    Expanded(flex: 2, child: _meter()),
                    const SizedBox(height: BchSpace.s3),
                    _metrics(),
                    const SizedBox(height: BchSpace.s3),
                    Expanded(child: _preview(context)),
                    _status(),
                    _footer(),
                    const SizedBox(height: BchSpace.s3),
                    _reports(context),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  Widget _reports(BuildContext context) {
    final enabled = controller.isRecording;
    return Padding(
      padding: const EdgeInsets.only(bottom: BchSpace.s3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (!enabled)
            const Padding(
              padding: EdgeInsets.only(bottom: BchSpace.s2),
              child: Text(
                'Start recording to report how a street feels.',
                textAlign: TextAlign.center,
                style: BchType.caption,
              ),
            ),
          Row(
            children: <Widget>[
              Expanded(
                child: _reportButton(
                  label: 'Comfortable',
                  icon: Icons.sentiment_satisfied_alt,
                  color: BchColor.comfort,
                  wash: BchColor.comfort12,
                  onPressed: enabled ? () => _send(context, 'comfortable') : null,
                ),
              ),
              const SizedBox(width: BchSpace.s3),
              Expanded(
                child: _reportButton(
                  label: 'Uncomfortable',
                  icon: Icons.sentiment_dissatisfied,
                  color: BchColor.live,
                  wash: BchColor.live12,
                  onPressed: enabled ? () => _pickReason(context) : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _reportButton({
    required String label,
    required IconData icon,
    required Color color,
    required Color wash,
    required VoidCallback? onPressed,
  }) {
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(BchFrame.actionH),
        padding: const EdgeInsets.symmetric(horizontal: BchSpace.s2),
        foregroundColor: color,
        backgroundColor: wash,
        disabledForegroundColor: BchColor.ink38,
        disabledBackgroundColor: BchColor.ink3,
        side: BorderSide(color: onPressed == null ? BchColor.divider : color, width: 1.5),
        shape: const RoundedRectangleBorder(borderRadius: BchRadius.xlAll),
        textStyle: BchType.button.copyWith(fontSize: 15),
      ),
      icon: Icon(icon, size: 24),
      label: FittedBox(fit: BoxFit.scaleDown, child: Text(label)),
      onPressed: onPressed,
    );
  }

  Future<void> _pickReason(BuildContext context) async {
    const reasons = <String, String>{
      'dark': 'Too dark',
      'followed': 'Followed',
      'harassment': 'Harassment',
      'other': 'Other',
    };
    final category = await showModalBottomSheet<String>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const ListTile(title: Text('Why does it feel uncomfortable here?')),
            for (final entry in reasons.entries)
              ListTile(
                minTileHeight: 56,
                title: Text(entry.value),
                onTap: () => Navigator.of(sheet).pop(entry.key),
              ),
          ],
        ),
      ),
    );
    if (category != null && context.mounted) _send(context, category);
  }

  void _send(BuildContext context, String category) {
    final message = controller.report(category);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  // ─── Header ───────────────────────────────────────────────────────────────

  Widget _header(BuildContext context) {
    final pending = controller.pendingUploads;
    final recording = controller.isRecording;
    final started = controller.startedAt;
    final session = recording
        ? 'Recording${started == null ? '' : ' since ${hhmm(started)}'}'
        : 'Not recording';
    return SizedBox(
      height: BchFrame.headerH + BchSpace.s3,
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Semantics(
                  header: true,
                  child: const Text('Leerie', style: BchType.wordmark),
                ),
                const SizedBox(height: BchSpace.s1),
                Row(
                  children: <Widget>[
                    LiveDot(
                      active: recording,
                      color: recording ? BchColor.live : BchColor.ink38,
                      size: 8,
                    ),
                    const SizedBox(width: BchSpace.s2),
                    Flexible(
                      child: Text(
                        deviceModel.isEmpty ? session : '$session · $deviceModel',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: BchType.caption.copyWith(
                          color: recording ? BchColor.text : BchColor.dim,
                          fontWeight: recording ? FontWeight.w600 : FontWeight.w400,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (pending > 0) ...<Widget>[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: const BoxDecoration(
                color: BchColor.accent100,
                borderRadius: BchRadius.lgAll,
              ),
              child: Text(
                '$pending queued',
                style: BchType.caption.copyWith(color: BchColor.accent800),
              ),
            ),
            const SizedBox(width: BchSpace.s1),
          ],
          IconButton(
            onPressed: () => _openSettings(context),
            icon: const Icon(Icons.tune, size: 22, color: BchColor.ink72),
            tooltip: 'Settings',
            style: IconButton.styleFrom(
              minimumSize: const Size.square(48),
              backgroundColor: BchColor.surface,
              side: const BorderSide(color: BchColor.divider),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openSettings(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: BchColor.surface,
      builder: (sheetContext) => SettingsSheet(
        controller: controller,
        // Close the sheet first: the road view is the thing being aimed at, and
        // leaving the sheet on the stack under it would send Back to the wrong
        // screen.
        onAim: () {
          Navigator.of(sheetContext).pop();
          _openRoadView(context, tuning: true);
        },
      ),
    );
  }

  // ─── Camera ───────────────────────────────────────────────────────────────

  Widget _preview(BuildContext context) {
    final camera = controller.camera;
    final ready = camera != null &&
        camera.value.isInitialized &&
        controller.cameraStatus == CameraStatus.ready;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: const BoxDecoration(
        color: BchColor.surface,
        borderRadius: BchRadius.xlAll,
        border: Border.fromBorderSide(BorderSide(color: BchColor.divider)),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          // `camera != null` is repeated rather than folded into `ready` so the
          // analyser promotes it to non-null inside the branch.
          if (camera != null && ready)
            GestureDetector(
              onTap: () => _openRoadView(context),
              child: Semantics(
                button: true,
                label: 'Camera view. Tap to open the full road view.',
                child: PreviewSurface(
                controller: controller,
                camera: camera,
                coordinate: _coordinate(),
                ),
              ),
            )
          else
            _cameraPlaceholder(context),
          Positioned(
            left: BchSpace.s3,
            top: BchSpace.s3,
            child: _chip(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  LiveDot(active: ready),
                  const SizedBox(width: BchSpace.s2),
                  Text(
                    controller.cameraStatus.label,
                    style: BchType.caption.copyWith(color: BchColor.text),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Where the detection would be placed if one fired now. Printed at the
  /// margin beside a fired mark, the way the console prints a linked pin's
  /// coordinate.
  String? _coordinate() {
    final position = controller.lastPosition;
    if (position != null) {
      return formatCoordinate(position.latitude, position.longitude);
    }
    return controller.settings.gating == GatingMode.bench
        ? formatCoordinate(benchFallbackLat, benchFallbackLng)
        : null;
  }

  Future<void> _openRoadView(BuildContext context, {bool tuning = false}) {
    return Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => RoadViewScreen(
          controller: controller,
          coordinate: _coordinate(),
          tuning: tuning,
        ),
      ),
    );
  }

  Widget _cameraPlaceholder(BuildContext context) {
    final status = controller.cameraStatus;
    final detail = switch (status) {
      CameraStatus.denied =>
        'Camera access was refused. Allow it for Leerie in the phone settings, '
            'then reopen the app.',
      CameraStatus.unavailable =>
        controller.cameraError ?? 'No camera the app can use.',
      CameraStatus.starting => 'Starting the camera.',
      _ => 'The camera is not running.',
    };

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(BchSpace.s4, 40, BchSpace.s4, BchSpace.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(detail, style: BchType.body),
            const SizedBox(height: BchSpace.s3),
            SecondaryButton(
              label: 'Try the camera again',
              icon: Icons.refresh,
              onPressed: () => controller.start(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip({required Widget child}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: BchSpace.s3, vertical: 5),
      decoration: const BoxDecoration(
        color: BchColor.scrim,
        borderRadius: BchRadius.lgAll,
        border: Border.fromBorderSide(BorderSide(color: BchColor.divider)),
      ),
      child: child,
    );
  }

  // ─── Light meter and walk ─────────────────────────────────────────────────

  Widget _meter() {
    final e = controller.exposure;
    final hasExposure = e != null && e.iso != null && e.exposureS != null;
    final cameraReady = controller.cameraStatus == CameraStatus.ready;
    return LightMeter(
      luminance: controller.luminance,
      emptyMessage: cameraReady ? 'No exposure data from camera' : 'Camera not running',
      detail: hasExposure
          ? 'ISO ${e.iso!.round()} · 1/${(1 / e.exposureS!).round()} s · '
              'f/${e.aperture?.toStringAsFixed(1) ?? '?'}'
          : null,
    );
  }

  Widget _metrics() {
    final started = controller.startedAt;
    final recording = controller.isRecording;
    final gps = controller.lastPosition;
    return MetricRow(
      cells: <Widget>[
        MetricCell(
          value: recording && started != null
              ? elapsed(DateTime.now().difference(started))
              : '—',
          label: 'Elapsed',
        ),
        MetricCell(
          value: '${controller.readingsRecorded}',
          label: 'Readings',
        ),
        MetricCell(
          value: controller.kmScanned.toStringAsFixed(1),
          unit: 'km',
          label: 'Walked',
        ),
        MetricCell(
          value: gps == null ? '—' : '±${gps.accuracy.round()}',
          unit: gps == null ? null : 'm',
          label: 'GPS',
        ),
      ],
    );
  }

  /// What the app is doing, then where the data is: the upload queue and its
  /// last error. A notice is stated once and dismissed by tapping it.
  Widget _status() {
    final notice = controller.notice;
    final pending = controller.pendingUploads;
    final error = controller.queue.lastError;
    final uploads = !controller.supabaseConfigured
        ? 'Supabase is not set: readings stay on the phone.'
        : pending > 0
            ? '${plural(pending, 'upload')} waiting'
            : 'Everything uploaded';
    final uploadsWarn = error != null || !controller.supabaseConfigured;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: BchSpace.s2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          GestureDetector(
            onTap: notice == null ? null : controller.clearNotice,
            behavior: HitTestBehavior.opaque,
            child: Text(
              notice ?? controller.statusLine,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: BchType.caption.copyWith(
                color: notice != null ? BchColor.hot : BchColor.dim,
              ),
            ),
          ),
          Text(
            error == null ? uploads : '$uploads · Last upload error: $error',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: BchType.caption.copyWith(
              color: uploadsWarn ? BchColor.live : BchColor.dim,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Record ───────────────────────────────────────────────────────────────

  Widget _footer() {
    final recording = controller.isRecording;
    final busy = controller.recording == RecordingState.starting ||
        controller.recording == RecordingState.stopping;
    final label = busy
        ? (controller.recording == RecordingState.stopping ? 'Stopping…' : 'Starting…')
        : (recording ? 'Stop walk' : 'Start walk');
    final onPressed =
        busy ? null : (recording ? controller.stopRecording : controller.startRecording);
    const shape = StadiumBorder();
    const size = Size.fromHeight(BchFrame.actionH);
    if (recording) {
      return OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          minimumSize: size,
          shape: shape,
          foregroundColor: BchColor.live,
          backgroundColor: BchColor.live12,
          side: const BorderSide(color: BchColor.live, width: 2),
          textStyle: BchType.action,
        ),
        icon: const LiveDot(color: BchColor.live, size: 12),
        label: Text(label),
        onPressed: onPressed,
      );
    }
    return FilledButton.icon(
      style: FilledButton.styleFrom(
        minimumSize: size,
        shape: shape,
        backgroundColor: BchColor.accent,
        foregroundColor: BchColor.bg,
        disabledBackgroundColor: BchColor.accent200,
        disabledForegroundColor: BchColor.ink58,
        textStyle: BchType.action,
        elevation: 0,
        shadowColor: BchColor.accent,
      ),
      icon: const Icon(Icons.directions_walk, size: 26),
      label: Text(label),
      onPressed: onPressed,
    );
  }
}
