export const luthierValidationMessagesPtBR = {
  luthier_validation_positive_integer_digits: '{label} deve conter apenas números positivos.',
  luthier_validation_positive_integer_range: '{label} deve ficar entre {min} e {max}.',
  luthier_validation_relative_path_required_file: 'Informe um arquivo relativo.',
  luthier_validation_relative_path_required_folder: 'Informe um caminho relativo.',
  luthier_validation_relative_path_no_absolute:
    'Use um caminho relativo dentro da pasta do jogo, não um caminho absoluto.',
  luthier_validation_relative_path_use_forward_slashes:
    'Use "/" nesse caminho relativo (não use "\\\\").',
  luthier_validation_relative_path_dot_prefix: 'Use o formato relativo começando com "./".',
  luthier_validation_relative_path_double_slash: 'O caminho relativo contém "//".',
  luthier_validation_path_invalid_chars: 'O caminho contém caracteres inválidos.',
  luthier_validation_relative_path_specific_target: 'Use uma subpasta ou arquivo específico.',
  luthier_validation_relative_path_empty: 'O caminho relativo está vazio.',
  luthier_validation_relative_path_no_dotdot:
    'Não use "." ou ".." nesse campo; selecione algo dentro da pasta do jogo.',
  luthier_validation_relative_path_file_expected: 'Esse campo espera um arquivo, não uma pasta.',
  luthier_validation_windows_path_required: 'Informe um caminho Windows.',
  luthier_validation_windows_path_expected:
    'Esse campo espera um caminho Windows (ex.: C:\\... ou Z:\\...).',
  luthier_validation_windows_path_invalid_format:
    'Caminho Windows inválido. Use uma letra de drive (ex.: C:\\...) ou UNC (\\\\servidor\\pasta).',
  luthier_validation_windows_path_invalid_chars: 'O caminho Windows contém caracteres inválidos.',
  luthier_validation_windows_path_backslash_hint: 'Sugestão: use barras invertidas: {path}',
  luthier_validation_suggestion: 'Sugestão: {value}',
  luthier_validation_linux_path_required: 'Informe um caminho Linux.',
  luthier_validation_linux_path_expected: 'Esse campo espera um caminho Linux (ex.: /home/... ).',
  luthier_validation_linux_path_host_hint:
    'Use um path do host Linux, não um path Windows do Wine.',
  luthier_validation_linux_path_absolute: 'Use um caminho Linux absoluto começando com "/".',
  luthier_validation_registry_path_required: 'Informe o path do registro.',
  luthier_validation_registry_path_expected:
    'Esse campo espera um path de registro (ex.: HKCU\\Software\\...).',
  luthier_validation_registry_path_invalid_chars: 'O path do registro contém caracteres inválidos.',
  luthier_validation_registry_hive_invalid: 'Use um hive válido (HKCU, HKLM, HKCR, HKU, HKCC...).',
  luthier_validation_registry_backslash_hint: 'Sugestão: use "\\\\": {path}',
  luthier_validation_registry_type_invalid:
    'Tipo de registro inválido. Ex.: REG_SZ, REG_DWORD, REG_BINARY.',
  luthier_validation_env_var_name_required: 'Informe o nome da variável.',
  luthier_validation_env_var_name_invalid:
    'Nome de variável inválido. Use letras, números e underscore, sem espaços.',
  luthier_validation_dll_name_required: 'Informe o nome da DLL.',
  luthier_validation_dll_name_no_path: 'Informe apenas o nome da DLL, sem path.',
  luthier_validation_dll_name_invalid: 'Nome de DLL inválido.',
  luthier_validation_wrapper_executable_required: 'Informe o executável/comando do wrapper.',
  luthier_validation_wrapper_executable_windows_path:
    'Wrapper deve ser comando/path Linux, não path Windows.',
  luthier_validation_wrapper_executable_args_separate:
    'Informe só o executável neste campo. Use o campo de argumentos para os parâmetros.',
  luthier_validation_command_linux_expected: 'Esse campo espera comando/path Linux.',
  luthier_validation_windows_name_required: 'Informe {label}.',
  luthier_validation_windows_name_invalid_chars: '{label} contém caracteres inválidos.',
  luthier_validation_windows_name_trailing: '{label} não deve terminar com espaço ou ponto.',
  luthier_validation_drive_serial_invalid: 'Serial inválido. Use hexadecimal (ex.: 1A2B3C4D).',
  luthier_validation_file_name_required: 'Informe um arquivo.',
  luthier_validation_folder_name_required: 'Informe um nome de pasta.',
  luthier_validation_name_invalid: 'Nome inválido.',
  luthier_validation_name_no_path: 'Informe apenas o nome, sem path.',
  luthier_validation_name_invalid_chars: 'Nome contém caracteres inválidos.',
  luthier_validation_duplicate_required_file: 'Esse arquivo já foi adicionado.',
  luthier_validation_duplicate_env_var: 'Já existe uma variável com esse nome.',
  luthier_validation_duplicate_wrapper: 'Já existe um wrapper com esse executável e argumentos.',
  luthier_validation_duplicate_extra_dependency: 'Já existe uma dependência extra com esse nome.',
  luthier_validation_duplicate_registry_key: 'Já existe uma entrada com o mesmo path e nome.',
  luthier_validation_duplicate_dll_override: 'Já existe um override para essa DLL.',
  luthier_validation_duplicate_desktop_folder_type:
    'Já existe uma pasta especial configurada para esse tipo.',
  luthier_validation_duplicate_mount_target: 'Já existe uma montagem com esse destino Windows.',
  luthier_validation_duplicate_mount: 'Essa montagem já foi adicionada.',
  luthier_mount_added: 'Montagem adicionada',
  luthier_winetricks_verb_added: 'Verbo do Winetricks adicionado',
  luthier_hero_image_updated: 'Hero image atualizada',
} as const
