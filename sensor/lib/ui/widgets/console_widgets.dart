// The console's parts, built from docs/design/mockup/console.html. Panels are
// separated by a single hairline, never by a gap and never by a shadow; elevation
// is reserved for things that overlap the camera image.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/tokens.dart';

/// The 11px uppercase label every panel carries, top-left inside the frame.
class PanelLabel extends StatelessWidget {
  const PanelLabel(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final label = Text(text.toUpperCase(), style: BchType.panelLabel);
    if (trailing == null) return label;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: <Widget>[
        Expanded(child: label),
        trailing!,
      ],
    );
  }
}

class Hairline extends StatelessWidget {
  const Hairline({super.key, this.color = BchColor.divider});

  final Color color;

  // Full-bleed on purpose: panels are separated by a single rule, never by a gap.
  @override
  Widget build(BuildContext context) =>
      Container(height: 1, width: double.infinity, color: color);
}

class VerticalHairline extends StatelessWidget {
  const VerticalHairline({super.key, this.color = BchColor.divider});

  final Color color;

  @override
  Widget build(BuildContext context) => Container(width: 1, color: color);
}

/// One stat tile: a tabular numeral over a small label. Units sit beside the
/// numeral in dim ink so the number stays clean.
class MetricCell extends StatelessWidget {
  const MetricCell({
    super.key,
    required this.value,
    required this.label,
    this.unit,
  });

  final String value;
  final String label;
  final String? unit;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: '$label: $value${unit == null ? '' : ' $unit'}',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: BchSpace.s3, vertical: BchSpace.s2),
        decoration: const BoxDecoration(
          color: BchColor.surface,
          borderRadius: BchRadius.lgAll,
          border: Border.fromBorderSide(BorderSide(color: BchColor.divider)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: <Widget>[
                  Text(value, maxLines: 1, style: BchType.metric),
                  if (unit != null) ...<Widget>[
                    const SizedBox(width: BchSpace.s1),
                    Text(unit!, style: BchType.caption),
                  ],
                ],
              ),
            ),
            const SizedBox(height: BchSpace.s1),
            Text(
              label.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: BchType.metricLabel,
            ),
          ],
        ),
      ),
    );
  }
}

/// Equal-width stat tiles. Fixed height rather than intrinsic, so a metric
/// growing a digit never moves the panel below it.
class MetricRow extends StatelessWidget {
  const MetricRow({super.key, required this.cells, this.height = 64});

  final List<Widget> cells;
  final double height;

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[];
    for (var i = 0; i < cells.length; i++) {
      if (i > 0) children.add(const SizedBox(width: BchSpace.s2));
      children.add(Expanded(child: cells[i]));
    }
    return SizedBox(
      height: height,
      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
    );
  }
}

/// A pill that filters or switches. The count in its label is a filter, never a
/// decorative statistic.
class BchChip extends StatelessWidget {
  const BchChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.enabled = true,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: BchMotion.tint,
          curve: BchMotion.ease,
          padding: const EdgeInsets.symmetric(vertical: 7, horizontal: BchSpace.s2),
          decoration: BoxDecoration(
            color: selected ? BchColor.accent : Colors.transparent,
            border: Border.all(color: selected ? BchColor.accent : BchColor.divider),
            borderRadius: BchRadius.lgAll,
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: BchType.chip.copyWith(
              color: selected ? BchColor.bg : BchColor.ink72,
            ),
          ),
        ),
      ),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onPressed == null ? 0.45 : 1,
      child: Material(
        color: Colors.transparent,
        borderRadius: BchRadius.mdAll,
        child: InkWell(
          borderRadius: BchRadius.mdAll,
          onTap: onPressed,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
            decoration: const BoxDecoration(
              border: Border.fromBorderSide(BorderSide(color: BchColor.divider)),
              borderRadius: BchRadius.mdAll,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                if (icon != null) ...<Widget>[
                  Icon(icon, size: 15, color: BchColor.ink72),
                  const SizedBox(width: BchSpace.s2),
                ],
                Text(label, style: BchType.button.copyWith(color: BchColor.text)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The only looping animation in the product. Holds still when the system asks
/// for reduced motion.
class LiveDot extends StatefulWidget {
  const LiveDot({
    super.key,
    this.active = true,
    this.color = BchColor.accent,
    this.size = 7,
  });

  final bool active;
  final Color color;
  final double size;

  @override
  State<LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<LiveDot> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(covariant LiveDot oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync();
  }

  void _sync() {
    final animate = widget.active && !MediaQuery.disableAnimationsOf(context);
    if (animate && !_controller.isAnimating) {
      _controller.repeat(reverse: true);
    } else if (!animate && _controller.isAnimating) {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final opacity = widget.active ? 1 - _controller.value * 0.7 : 0.35;
        return Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: widget.color.withAlpha((opacity * 255).round()),
          ),
        );
      },
    );
  }
}

/// Stops are log2(luminance / reference). The reference is a typical street from
/// the first night's data (readings ran about 0.02 to 0.2, geometric middle about
/// 0.06), so a street reads near 0, a room a stop or two above, a covered lens at
/// the bottom of the bar and a ceiling light at the top. Uncalibrated: per phone,
/// not the dashboard's stops.
const kMeterReferenceLuminance = 0.06;
const kMeterMinStops = -6.0;
const kMeterMaxStops = 6.0;

double luminanceStops(double luminance) =>
    math.log(math.max(luminance, 1e-9) / kMeterReferenceLuminance) / math.ln2;

/// Where a reading sits on the meter, 0 (left) to 1 (right), clamped.
double meterFraction(double stops) =>
    ((stops - kMeterMinStops) / (kMeterMaxStops - kMeterMinStops)).clamp(0.0, 1.0);

String formatStops(double stops) =>
    '${stops >= 0 ? '+' : '\u2212'}${stops.abs().toStringAsFixed(1)}';

/// The live light reading as a street lamp: a disc whose amber glow follows the
/// stops (dark is a dim ember, bright a hot amber), the number in its centre,
/// and the -6..+6 bar under it. Needs a bounded height; the lamp takes what the
/// bar and captions leave.
class LightMeter extends StatelessWidget {
  const LightMeter({
    super.key,
    required this.luminance,
    required this.emptyMessage,
    this.detail,
  });

  /// Exposure-corrected relative luminance, or null when there is none.
  final double? luminance;

  /// Shown instead of a number when [luminance] is null.
  final String emptyMessage;

  /// Small print under the bar (the camera's exposure settings).
  final String? detail;

  @override
  Widget build(BuildContext context) {
    final lum = luminance;
    final stops = lum == null ? null : luminanceStops(lum);
    final motion = MediaQuery.disableAnimationsOf(context) ? Duration.zero : BchMotion.state;
    return Semantics(
      container: true,
      label: 'Light meter, relative brightness, not lux',
      value: stops == null ? emptyMessage : '${formatStops(stops)} stops',
      excludeSemantics: true,
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(end: stops == null ? 0 : meterFraction(stops)),
        duration: motion,
        curve: BchMotion.ease,
        builder: (context, t, _) => Column(
          children: <Widget>[
            Expanded(
              child: LayoutBuilder(
                builder: (context, box) {
                  final size = math.max(0.0, math.min(box.maxWidth * 0.72, box.maxHeight));
                  return Center(
                    child: SizedBox.square(
                      dimension: size,
                      child: _Lamp(t: stops == null ? null : t, child: _readout(stops)),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: BchSpace.s2),
            const Text('relative brightness, not lux', style: BchType.caption),
            const SizedBox(height: BchSpace.s2),
            _bar(stops == null ? null : t),
            if (detail != null)
              Text(detail!, maxLines: 1, overflow: TextOverflow.ellipsis, style: BchType.caption),
          ],
        ),
      ),
    );
  }

  Widget _readout(double? stops) {
    if (stops == null) {
      return Padding(
        padding: const EdgeInsets.all(BchSpace.s4),
        child: Text(
          emptyMessage,
          textAlign: TextAlign.center,
          style: BchType.rowPrimary.copyWith(color: BchColor.dim),
        ),
      );
    }
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Padding(
        padding: const EdgeInsets.all(BchSpace.s3),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(formatStops(stops), style: BchType.hero),
            Text('STOPS', style: BchType.micro.copyWith(color: BchColor.accent800)),
          ],
        ),
      ),
    );
  }

  Widget _bar(double? t) {
    return Column(
      children: <Widget>[
        ClipRRect(
          borderRadius: BchRadius.smAll,
          child: Container(
            height: BchFrame.meterBarH,
            width: double.infinity,
            color: BchColor.neutral300,
            child: t == null
                ? null
                : FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: t,
                    child: const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: <Color>[BchColor.live, BchColor.hot]),
                      ),
                    ),
                  ),
          ),
        ),
        const SizedBox(height: BchSpace.s1),
        Row(
          children: <Widget>[
            Text('dark  \u2212${(-kMeterMinStops).round()}', style: BchType.caption),
            const Spacer(),
            Text('+${kMeterMaxStops.round()}  bright', style: BchType.caption),
          ],
        ),
      ],
    );
  }
}

/// The lamp itself. [t] is the meter fraction 0..1, or null for no reading.
class _Lamp extends StatelessWidget {
  const _Lamp({required this.t, required this.child});

  final double? t;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final lit = t ?? 0;
    final glow = Color.lerp(BchColor.live, BchColor.hot, lit)!;
    final strength = t == null ? 0.0 : 0.18 + 0.62 * lit;
    return Stack(
      alignment: Alignment.center,
      children: <Widget>[
        // The halo: a radial wash that grows stronger with the light.
        DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: <Color>[
                glow.withValues(alpha: strength),
                glow.withValues(alpha: strength * 0.3),
                glow.withValues(alpha: 0),
              ],
              // The disc covers the inner 0.68 of the radius; the halo starts at its rim.
              stops: const <double>[0.62, 0.8, 1],
            ),
          ),
          child: const SizedBox.expand(),
        ),
        FractionallySizedBox(
          widthFactor: 0.68,
          heightFactor: 0.68,
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const RadialGradient(
                center: Alignment(0, -0.4),
                colors: <Color>[BchColor.raised, BchColor.bg],
              ),
              border: Border.all(
                color: t == null
                    ? BchColor.divider
                    : glow.withValues(alpha: 0.35 + 0.55 * lit),
                width: 2,
              ),
              boxShadow: <BoxShadow>[
                BoxShadow(
                  color: glow.withValues(alpha: strength * 0.7),
                  blurRadius: 12 + 36 * lit,
                ),
              ],
            ),
            child: Center(child: child),
          ),
        ),
      ],
    );
  }
}
