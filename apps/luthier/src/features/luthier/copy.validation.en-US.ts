export const luthierValidationMessagesEnUS = {
  luthier_validation_positive_integer_digits: '{label} must contain only positive numbers.',
  luthier_validation_positive_integer_range: '{label} must be between {min} and {max}.',
  luthier_validation_relative_path_required_file: 'Provide a relative file.',
  luthier_validation_relative_path_required_folder: 'Provide a relative path.',
  luthier_validation_relative_path_no_absolute:
    'Use a relative path inside the game folder, not an absolute path.',
  luthier_validation_relative_path_use_forward_slashes:
    'Use "/" in this relative path (do not use "\\\\").',
  luthier_validation_relative_path_dot_prefix: 'Use the relative format starting with "./".',
  luthier_validation_relative_path_double_slash: 'Relative path contains "//".',
  luthier_validation_path_invalid_chars: 'Path contains invalid characters.',
  luthier_validation_relative_path_specific_target: 'Use a specific subfolder or file.',
  luthier_validation_relative_path_empty: 'Relative path is empty.',
  luthier_validation_relative_path_no_dotdot:
    'Do not use "." or ".." in this field; select something inside the game folder.',
  luthier_validation_relative_path_file_expected: 'This field expects a file, not a folder.',
  luthier_validation_windows_path_required: 'Provide a Windows path.',
  luthier_validation_windows_path_expected:
    'This field expects a Windows path (e.g. C:\\... or Z:\\...).',
  luthier_validation_windows_path_invalid_format:
    'Invalid Windows path. Use a drive letter path (e.g. C:\\...) or UNC (\\\\server\\share).',
  luthier_validation_windows_path_invalid_chars: 'Windows path contains invalid characters.',
  luthier_validation_windows_path_backslash_hint: 'Suggestion: use backslashes: {path}',
  luthier_validation_suggestion: 'Suggestion: {value}',
  luthier_validation_linux_path_required: 'Provide a Linux path.',
  luthier_validation_linux_path_expected: 'This field expects a Linux path (e.g. /home/... ).',
  luthier_validation_linux_path_host_hint: 'Use a Linux host path, not a Wine Windows path.',
  luthier_validation_linux_path_absolute: 'Use an absolute Linux path starting with "/".',
  luthier_validation_registry_path_required: 'Provide the registry path.',
  luthier_validation_registry_path_expected:
    'This field expects a registry path (e.g. HKCU\\Software\\...).',
  luthier_validation_registry_path_invalid_chars: 'Registry path contains invalid characters.',
  luthier_validation_registry_hive_invalid: 'Use a valid hive (HKCU, HKLM, HKCR, HKU, HKCC...).',
  luthier_validation_registry_backslash_hint: 'Suggestion: use "\\\\": {path}',
  luthier_validation_registry_type_invalid:
    'Invalid registry type. E.g. REG_SZ, REG_DWORD, REG_BINARY.',
  luthier_validation_env_var_name_required: 'Provide the variable name.',
  luthier_validation_env_var_name_invalid:
    'Invalid variable name. Use letters, numbers and underscore, no spaces.',
  luthier_validation_dll_name_required: 'Provide the DLL name.',
  luthier_validation_dll_name_no_path: 'Provide only the DLL name, without a path.',
  luthier_validation_dll_name_invalid: 'Invalid DLL name.',
  luthier_validation_wrapper_executable_required: 'Provide the wrapper executable/command.',
  luthier_validation_wrapper_executable_windows_path:
    'Wrapper must be a Linux command/path, not a Windows path.',
  luthier_validation_wrapper_executable_args_separate:
    'Put only the executable in this field. Use the arguments field for parameters.',
  luthier_validation_command_linux_expected: 'This field expects a Linux command/path.',
  luthier_validation_windows_name_required: 'Provide {label}.',
  luthier_validation_windows_name_invalid_chars: '{label} contains invalid characters.',
  luthier_validation_windows_name_trailing: '{label} must not end with a space or dot.',
  luthier_validation_drive_serial_invalid: 'Invalid serial. Use hexadecimal (e.g. 1A2B3C4D).',
  luthier_validation_file_name_required: 'Provide a file.',
  luthier_validation_folder_name_required: 'Provide a folder name.',
  luthier_validation_name_invalid: 'Invalid name.',
  luthier_validation_name_no_path: 'Provide only the name, without a path.',
  luthier_validation_name_invalid_chars: 'Name contains invalid characters.',
  luthier_validation_duplicate_required_file: 'This file is already listed.',
  luthier_validation_duplicate_env_var: 'A variable with this name already exists.',
  luthier_validation_duplicate_wrapper:
    'A wrapper with the same executable and arguments already exists.',
  luthier_validation_duplicate_extra_dependency:
    'An extra dependency with this name already exists.',
  luthier_validation_duplicate_registry_key: 'An entry with the same path and name already exists.',
  luthier_validation_duplicate_dll_override: 'An override for this DLL already exists.',
  luthier_validation_duplicate_desktop_folder_type:
    'A special folder is already configured for this type.',
  luthier_validation_duplicate_mount_target: 'A mount with this Windows target already exists.',
  luthier_validation_duplicate_mount: 'This mount is already added.',
  luthier_mount_added: 'Mount added',
  luthier_winetricks_verb_added: 'Winetricks verb added',
  luthier_hero_image_updated: 'Hero image updated',
} as const
