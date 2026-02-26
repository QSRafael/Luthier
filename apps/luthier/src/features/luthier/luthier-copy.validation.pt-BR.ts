export const luthierValidationMessagesPtBR = {
  creator_validation_positive_integer_digits: '{label} deve conter apenas números positivos.',
  creator_validation_positive_integer_range: '{label} deve ficar entre {min} e {max}.',
  creator_validation_relative_path_required_file: 'Informe um arquivo relativo.',
  creator_validation_relative_path_required_folder: 'Informe um caminho relativo.',
  creator_validation_relative_path_no_absolute:
    'Use um caminho relativo dentro da pasta do jogo, não um caminho absoluto.',
  creator_validation_relative_path_use_forward_slashes:
    'Use "/" nesse caminho relativo (não use "\\\\").',
  creator_validation_relative_path_dot_prefix: 'Use o formato relativo começando com "./".',
  creator_validation_relative_path_double_slash: 'O caminho relativo contém "//".',
  creator_validation_path_invalid_chars: 'O caminho contém caracteres inválidos.',
  creator_validation_relative_path_specific_target:
    'Use uma subpasta ou arquivo específico.',
  creator_validation_relative_path_empty: 'O caminho relativo está vazio.',
  creator_validation_relative_path_no_dotdot:
    'Não use "." ou ".." nesse campo; selecione algo dentro da pasta do jogo.',
  creator_validation_relative_path_file_expected:
    'Esse campo espera um arquivo, não uma pasta.',
  creator_validation_windows_path_required: 'Informe um caminho Windows.',
  creator_validation_windows_path_expected:
    'Esse campo espera um caminho Windows (ex.: C:\\... ou Z:\\...).',
  creator_validation_windows_path_invalid_format:
    'Caminho Windows inválido. Use uma letra de drive (ex.: C:\\...) ou UNC (\\\\servidor\\pasta).',
  creator_validation_windows_path_invalid_chars:
    'O caminho Windows contém caracteres inválidos.',
  creator_validation_windows_path_backslash_hint:
    'Sugestão: use barras invertidas: {path}',
  creator_validation_suggestion: 'Sugestão: {value}',
  creator_validation_linux_path_required: 'Informe um caminho Linux.',
  creator_validation_linux_path_expected:
    'Esse campo espera um caminho Linux (ex.: /home/... ).',
  creator_validation_linux_path_host_hint:
    'Use um path do host Linux, não um path Windows do Wine.',
  creator_validation_linux_path_absolute:
    'Use um caminho Linux absoluto começando com "/".',
  creator_validation_registry_path_required: 'Informe o path do registro.',
  creator_validation_registry_path_expected:
    'Esse campo espera um path de registro (ex.: HKCU\\Software\\...).',
  creator_validation_registry_path_invalid_chars:
    'O path do registro contém caracteres inválidos.',
  creator_validation_registry_hive_invalid:
    'Use um hive válido (HKCU, HKLM, HKCR, HKU, HKCC...).',
  creator_validation_registry_backslash_hint: 'Sugestão: use "\\\\": {path}',
  creator_validation_registry_type_invalid:
    'Tipo de registro inválido. Ex.: REG_SZ, REG_DWORD, REG_BINARY.',
  creator_validation_env_var_name_required: 'Informe o nome da variável.',
  creator_validation_env_var_name_invalid:
    'Nome de variável inválido. Use letras, números e underscore, sem espaços.',
  creator_validation_dll_name_required: 'Informe o nome da DLL.',
  creator_validation_dll_name_no_path:
    'Informe apenas o nome da DLL, sem path.',
  creator_validation_dll_name_invalid: 'Nome de DLL inválido.',
  creator_validation_wrapper_executable_required:
    'Informe o executável/comando do wrapper.',
  creator_validation_wrapper_executable_windows_path:
    'Wrapper deve ser comando/path Linux, não path Windows.',
  creator_validation_wrapper_executable_args_separate:
    'Informe só o executável neste campo. Use o campo de argumentos para os parâmetros.',
  creator_validation_command_linux_expected:
    'Esse campo espera comando/path Linux.',
  creator_validation_windows_name_required: 'Informe {label}.',
  creator_validation_windows_name_invalid_chars: '{label} contém caracteres inválidos.',
  creator_validation_windows_name_trailing: '{label} não deve terminar com espaço ou ponto.',
  creator_validation_drive_serial_invalid:
    'Serial inválido. Use hexadecimal (ex.: 1A2B3C4D).',
  creator_validation_file_name_required: 'Informe um arquivo.',
  creator_validation_folder_name_required: 'Informe um nome de pasta.',
  creator_validation_name_invalid: 'Nome inválido.',
  creator_validation_name_no_path: 'Informe apenas o nome, sem path.',
  creator_validation_name_invalid_chars: 'Nome contém caracteres inválidos.',
  creator_validation_duplicate_required_file: 'Esse arquivo já foi adicionado.',
  creator_validation_duplicate_env_var: 'Já existe uma variável com esse nome.',
  creator_validation_duplicate_wrapper:
    'Já existe um wrapper com esse executável e argumentos.',
  creator_validation_duplicate_extra_dependency:
    'Já existe uma dependência extra com esse nome.',
  creator_validation_duplicate_registry_key:
    'Já existe uma entrada com o mesmo path e nome.',
  creator_validation_duplicate_dll_override: 'Já existe um override para essa DLL.',
  creator_validation_duplicate_desktop_folder_type:
    'Já existe uma pasta especial configurada para esse tipo.',
  creator_validation_duplicate_mount_target:
    'Já existe uma montagem com esse destino Windows.',
  creator_validation_duplicate_mount: 'Essa montagem já foi adicionada.',
  creator_mount_added: 'Montagem adicionada',
  creator_winetricks_verb_added: 'Verbo do Winetricks adicionado',
  creator_hero_image_updated: 'Hero image atualizada',
} as const
