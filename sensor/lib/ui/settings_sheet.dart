// Where the readings go. Everything else is fixed at build time.

import 'package:flutter/material.dart';

import '../session/session_controller.dart';
import '../session/settings.dart';
import '../theme/tokens.dart';
import 'widgets/console_widgets.dart';

class SettingsSheet extends StatefulWidget {
  const SettingsSheet({super.key, required this.controller});

  final SessionController controller;


  @override
  State<SettingsSheet> createState() => _SettingsSheetState();
}

class _SettingsSheetState extends State<SettingsSheet> {
  late final SensorSettings _settings = widget.controller.settings;
  late final TextEditingController _url =
      TextEditingController(text: _settings.supabaseUrlOverride);
  late final TextEditingController _key =
      TextEditingController(text: _settings.supabaseKeyOverride);

  String? _connectionResult;
  bool _checking = false;

  @override
  void dispose() {
    _url.dispose();
    _key.dispose();
    super.dispose();
  }

  void _apply() {
    widget.controller.applySettings(_settings);
    setState(() {});
  }

  Future<void> _check() async {
    setState(() {
      _checking = true;
      _connectionResult = null;
    });
    final result = await widget.controller.checkConnection();
    if (!mounted) return;
    setState(() {
      _checking = false;
      _connectionResult = result;
    });
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);

    return Padding(
      padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: media.size.height * 0.88),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              _section('Supabase', <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        _settings.uploadEnabled
                            ? 'Writing to ${_settings.supabase.host}'
                            : 'Readings are held on the phone',
                        style: BchType.body,
                      ),
                    ),
                    Switch(
                      value: _settings.uploadEnabled,
                      onChanged: (v) {
                        _settings.uploadEnabled = v;
                        _apply();
                      },
                    ),
                  ],
                ),
                const SizedBox(height: BchSpace.s3),
                _field(
                  label: 'Project URL',
                  hint: 'https://your-project.supabase.co',
                  controller: _url,
                  onChanged: (v) {
                    _settings.supabaseUrlOverride = v;
                    _apply();
                  },
                ),
                const SizedBox(height: BchSpace.s3),
                _field(
                  label: 'Anon key',
                  hint: 'eyJhbGciOi…',
                  controller: _key,
                  obscure: true,
                  onChanged: (v) {
                    _settings.supabaseKeyOverride = v;
                    _apply();
                  },
                ),
                const SizedBox(height: BchSpace.s3),
                Row(
                  children: <Widget>[
                    SecondaryButton(
                      label: _checking ? 'Checking' : 'Check connection',
                      icon: Icons.cloud_outlined,
                      onPressed: _checking ? null : _check,
                    ),
                    const SizedBox(width: BchSpace.s3),
                    Expanded(
                      child: Text(
                        _connectionResult ?? '',
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: BchType.caption,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: BchSpace.s2),
                const Text(
                  'Blank fields fall back to the values passed with --dart-define '
                  'at build time. The anon key can only insert rows.',
                  style: BchType.caption,
                ),
              ]),

              Padding(
                padding: const EdgeInsets.all(BchSpace.s4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: <Widget>[
                    SecondaryButton(
                      label: 'Close',
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _section(String label, List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(BchSpace.s4),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: BchColor.divider)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          PanelLabel(label),
          const SizedBox(height: BchSpace.s3),
          ...children,
        ],
      ),
    );
  }

  Widget _field({
    required String label,
    required String hint,
    required TextEditingController controller,
    required ValueChanged<String> onChanged,
    bool obscure = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(label, style: BchType.caption),
        const SizedBox(height: 5),
        TextField(
          controller: controller,
          onChanged: onChanged,
          obscureText: obscure,
          autocorrect: false,
          enableSuggestions: false,
          style: BchType.body.copyWith(color: BchColor.text),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: BchType.body.copyWith(color: BchColor.ink38),
            isDense: true,
            filled: true,
            fillColor: BchColor.surface,
            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
            border: const OutlineInputBorder(
              borderRadius: BchRadius.mdAll,
              borderSide: BorderSide(color: BchColor.divider),
            ),
            enabledBorder: const OutlineInputBorder(
              borderRadius: BchRadius.mdAll,
              borderSide: BorderSide(color: BchColor.divider),
            ),
            focusedBorder: const OutlineInputBorder(
              borderRadius: BchRadius.mdAll,
              borderSide: BorderSide(color: BchColor.accent),
            ),
          ),
        ),
      ],
    );
  }
}
