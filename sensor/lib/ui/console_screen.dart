// The Leerie scanner. Read at arm's length on a night walk: who is recording,
// the live light meter, where the camera points, the walk's numbers, the two
// report buttons and one big Record/Stop control.

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
      body: SafeArea(
        child: ListenableBuilder(
          listenable: Listenable.merge(<Listenable>[controller, controller.queue]),
          builder: (context, _) {
            return Column(
              // Header, hairlines, metric row and footer bar are all full-bleed.
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                _header(context),
                const Hairline(),
                _meter(),
                const Hairline(),
                Expanded(child: _preview(context)),
                const Hairline(),
                _metrics(),
                const Hairline(),
                _status(),
                _reports(context),
                _footer(),
              ],
            );
          },
        ),
      ),
    );
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  Widget _reports(BuildContext context) {
    const size = Size.fromHeight(BchFrame.actionH);
    final enabled = controller.isRecording;
    return Padding(
      padding: const EdgeInsets.fromLTRB(BchSpace.s3, 0, BchSpace.s3, BchSpace.s3),
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
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: size,
                    foregroundColor: BchColor.text,
                    side: const BorderSide(color: BchColor.divider),
                    textStyle: BchType.button,
                  ),
                  icon: const Icon(Icons.sentiment_satisfied_alt),
                  label: const Text('Comfortable'),
                  onPressed: enabled ? () => _send(context, 'comfortable') : null,
                ),
              ),
              const SizedBox(width: BchSpace.s3),
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    minimumSize: size,
                    backgroundColor: BchColor.accent,
                    foregroundColor: BchColor.bg,
                    textStyle: BchType.button,
                  ),
                  icon: const Icon(Icons.sentiment_dissatisfied),
                  label: const Text('Uncomfortable'),
                  onPressed: enabled ? () => _pickReason(context) : null,
                ),
              ),
            ],
          ),
        ],
      ),
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
    return Container(
      height: BchFrame.headerH,
      color: recording ? BchColor.live24 : BchColor.surface,
      padding: const EdgeInsets.symmetric(horizontal: BchSpace.s4),
      child: Row(
        children: <Widget>[
          LiveDot(
            active: recording,
            color: recording ? BchColor.live : BchColor.ink38,
            size: 16,
          ),
          const SizedBox(width: BchSpace.s3),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Text('Leerie', style: BchType.consoleTitle),
                Text(
                  deviceModel.isEmpty ? session : '$session · $deviceModel',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: BchType.caption.copyWith(
                    color: recording ? BchColor.text : BchColor.ink58,
                    fontWeight: recording ? FontWeight.w600 : FontWeight.w400,
                  ),
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
            const SizedBox(width: BchSpace.s2),
          ],
          IconButton(
            onPressed: () => _openSettings(context),
            icon: const Icon(Icons.tune, size: 20, color: BchColor.ink72),
            tooltip: 'Settings',
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }

  Future<void> _openSettings(BuildContext context) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: BchColor.bg,
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
      color: BchColor.neutral200,
      child: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          // `camera != null` is repeated rather than folded into `ready` so the
          // analyser promotes it to non-null inside the branch.
          if (camera != null && ready)
            GestureDetector(
              onTap: () => _openRoadView(context),
              child: PreviewSurface(
                controller: controller,
                camera: camera,
                coordinate: _coordinate(),
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
                    style: BchType.caption.copyWith(color: BchColor.accent800),
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

    return Padding(
      padding: const EdgeInsets.all(BchSpace.s6),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const PanelLabel('Camera'),
          const SizedBox(height: BchSpace.s3),
          Text(detail, style: BchType.body),
          const SizedBox(height: BchSpace.s4),
          SecondaryButton(
            label: 'Try the camera again',
            icon: Icons.refresh,
            onPressed: () => controller.start(),
          ),
        ],
      ),
    );
  }

  Widget _chip({required Widget child}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: BchSpace.s3, vertical: 5),
      decoration: const BoxDecoration(
        color: BchColor.bg,
        borderRadius: BchRadius.mdAll,
        boxShadow: BchShadow.sm,
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
    return Padding(
      padding: const EdgeInsets.all(BchSpace.s3),
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
                color: notice != null ? BchColor.text : BchColor.ink58,
              ),
            ),
          ),
          Text(
            error == null ? uploads : '$uploads · Last upload error: $error',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: BchType.caption.copyWith(
              color: error == null ? BchColor.ink58 : BchColor.text,
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(BchSpace.s3, 0, BchSpace.s3, BchSpace.s3),
      child: FilledButton.icon(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(BchFrame.actionH),
          backgroundColor: recording ? BchColor.live : BchColor.accent,
          foregroundColor: recording ? BchColor.text : BchColor.bg,
          textStyle: BchType.action,
        ),
        icon: Icon(recording ? Icons.stop_rounded : Icons.fiber_manual_record, size: 28),
        label: Text(
          busy
              ? (controller.recording == RecordingState.stopping ? 'Stopping…' : 'Starting…')
              : (recording ? 'Stop recording' : 'Start recording'),
        ),
        onPressed: busy
            ? null
            : (recording ? controller.stopRecording : controller.startRecording),
      ),
    );
  }
}
