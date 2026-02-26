export const creatorValidationMessagesEnUS = {
  creator_validation_positive_integer_digits: '{label} must contain only positive numbers.',
  creator_validation_positive_integer_range: '{label} must be between {min} and {max}.',
  creator_validation_relative_path_required_file: 'Provide a relative file.',
  creator_validation_relative_path_required_folder: 'Provide a relative path.',
  creator_validation_relative_path_no_absolute:
    'Use a relative path inside the game folder, not an absolute path.',
  creator_validation_relative_path_use_forward_slashes:
    'Use "/" in this relative path (do not use "\\\\").',
  creator_validation_relative_path_dot_prefix: 'Use the relative format starting with "./".',
  creator_validation_relative_path_double_slash: 'Relative path contains "//".',
  creator_validation_path_invalid_chars: 'Path contains invalid characters.',
  creator_validation_relative_path_specific_target:
    'Use a specific subfolder or file.',
  creator_validation_relative_path_empty: 'Relative path is empty.',
  creator_validation_relative_path_no_dotdot:
    'Do not use "." or ".." in this field; select something inside the game folder.',
  creator_validation_relative_path_file_expected:
    'This field expects a file, not a folder.',
  creator_validation_windows_path_required: 'Provide a Windows path.',
  creator_validation_windows_path_expected:
    'This field expects a Windows path (e.g. C:\\... or Z:\\...).',
  creator_validation_windows_path_invalid_format:
    'Invalid Windows path. Use a drive letter path (e.g. C:\\...) or UNC (\\\\server\\share).',
  creator_validation_windows_path_invalid_chars:
    'Windows path contains invalid characters.',
  creator_validation_windows_path_backslash_hint:
    'Suggestion: use backslashes: {path}',
  creator_validation_suggestion: 'Suggestion: {value}',
  creator_validation_linux_path_required: 'Provide a Linux path.',
  creator_validation_linux_path_expected:
    'This field expects a Linux path (e.g. /home/... ).',
  creator_validation_linux_path_host_hint:
    'Use a Linux host path, not a Wine Windows path.',
  creator_validation_linux_path_absolute:
    'Use an absolute Linux path starting with "/".',
  creator_validation_registry_path_required: 'Provide the registry path.',
  creator_validation_registry_path_expected:
    'This field expects a registry path (e.g. HKCU\\Software\\...).',
  creator_validation_registry_path_invalid_chars:
    'Registry path contains invalid characters.',
  creator_validation_registry_hive_invalid:
    'Use a valid hive (HKCU, HKLM, HKCR, HKU, HKCC...).',
  creator_validation_registry_backslash_hint: 'Suggestion: use "\\\\": {path}',
  creator_validation_registry_type_invalid:
    'Invalid registry type. E.g. REG_SZ, REG_DWORD, REG_BINARY.',
  creator_validation_env_var_name_required: 'Provide the variable name.',
  creator_validation_env_var_name_invalid:
    'Invalid variable name. Use letters, numbers and underscore, no spaces.',
  creator_validation_dll_name_required: 'Provide the DLL name.',
  creator_validation_dll_name_no_path:
    'Provide only the DLL name, without a path.',
  creator_validation_dll_name_invalid: 'Invalid DLL name.',
  creator_validation_wrapper_executable_required:
    'Provide the wrapper executable/command.',
  creator_validation_wrapper_executable_windows_path:
    'Wrapper must be a Linux command/path, not a Windows path.',
  creator_validation_wrapper_executable_args_separate:
    'Put only the executable in this field. Use the arguments field for parameters.',
  creator_validation_command_linux_expected:
    'This field expects a Linux command/path.',
  creator_validation_windows_name_required: 'Provide {label}.',
  creator_validation_windows_name_invalid_chars: '{label} contains invalid characters.',
  creator_validation_windows_name_trailing: '{label} must not end with a space or dot.',
  creator_validation_drive_serial_invalid:
    'Invalid serial. Use hexadecimal (e.g. 1A2B3C4D).',
  creator_validation_file_name_required: 'Provide a file.',
  creator_validation_folder_name_required: 'Provide a folder name.',
  creator_validation_name_invalid: 'Invalid name.',
  creator_validation_name_no_path: 'Provide only the name, without a path.',
  creator_validation_name_invalid_chars: 'Name contains invalid characters.',
  creator_validation_duplicate_required_file: 'This file is already listed.',
  creator_validation_duplicate_env_var: 'A variable with this name already exists.',
  creator_validation_duplicate_wrapper:
    'A wrapper with the same executable and arguments already exists.',
  creator_validation_duplicate_extra_dependency:
    'An extra dependency with this name already exists.',
  creator_validation_duplicate_registry_key:
    'An entry with the same path and name already exists.',
  creator_validation_duplicate_dll_override: 'An override for this DLL already exists.',
  creator_validation_duplicate_desktop_folder_type:
    'A special folder is already configured for this type.',
  creator_validation_duplicate_mount_target:
    'A mount with this Windows target already exists.',
  creator_validation_duplicate_mount: 'This mount is already added.',
  creator_mount_added: 'Mount added',
  creator_winetricks_verb_added: 'Winetricks verb added',
  creator_hero_image_updated: 'Hero image updated',
} as const
