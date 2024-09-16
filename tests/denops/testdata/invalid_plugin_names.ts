export const INVALID_PLUGIN_NAMES:
  readonly (readonly [plugin_name: string, label: string])[] = [
    ["", "empty"],
    ["dummy.invalid", "'.'"],
    ["dummy invalid", "' '"],
  ];
