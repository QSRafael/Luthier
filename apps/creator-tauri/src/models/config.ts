export type FeatureState = 'MandatoryOn' | 'MandatoryOff' | 'OptionalOn' | 'OptionalOff'
export type WinecfgFeaturePolicy = { state: FeatureState; use_wine_default: boolean }

export type RuntimePrimary = 'ProtonUmu' | 'ProtonNative' | 'Wine'

export type RuntimePreference = 'Auto' | 'Proton' | 'Wine'

export type CreatorTab =
  | 'game'
  | 'runtime'
  | 'performance'
  | 'prefix'
  | 'winecfg'
  | 'wrappers'
  | 'scripts'
  | 'review'

export type GameConfig = {
  config_version: number
  created_by: string
  game_name: string
  exe_hash: string
  relative_exe_path: string
  launch_args: string[]
  runner: {
    proton_version: string
    auto_update: boolean
    esync: boolean
    fsync: boolean
    runtime_preference: RuntimePreference
  }
  environment: {
    gamemode: FeatureState
    gamescope: {
      state: FeatureState
      resolution: string | null
      fsr: boolean
      game_width: string
      game_height: string
      output_width: string
      output_height: string
      upscale_method: 'fsr' | 'nis' | 'integer' | 'stretch'
      window_type: 'fullscreen' | 'borderless' | 'windowed'
      enable_limiter: boolean
      fps_limiter: string
      fps_limiter_no_focus: string
      force_grab_cursor: boolean
      additional_options: string
    }
    mangohud: FeatureState
    prime_offload: FeatureState
    custom_vars: Record<string, string>
  }
  compatibility: {
    wine_wayland: FeatureState
    hdr: FeatureState
    auto_dxvk_nvapi: FeatureState
    easy_anti_cheat_runtime: FeatureState
    battleye_runtime: FeatureState
    staging: FeatureState
    wrapper_commands: Array<{ state: FeatureState; executable: string; args: string }>
  }
  winecfg: {
    windows_version: string | null
    dll_overrides: Array<{ dll: string; mode: string }>
    auto_capture_mouse: WinecfgFeaturePolicy
    window_decorations: WinecfgFeaturePolicy
    window_manager_control: WinecfgFeaturePolicy
    virtual_desktop: { state: WinecfgFeaturePolicy; resolution: string | null }
    screen_dpi: number | null
    desktop_integration: WinecfgFeaturePolicy
    mime_associations: WinecfgFeaturePolicy
    desktop_folders: Array<{ folder_key: string; shortcut_name: string; linux_path: string }>
    drives: Array<{
      letter: string
      source_relative_path: string
      state: FeatureState
      host_path: string | null
      drive_type: 'auto' | 'local_disk' | 'network_share' | 'floppy' | 'cdrom' | null
      label: string | null
      serial: string | null
    }>
    audio_driver: string | null
  }
  dependencies: string[]
  extra_system_dependencies: Array<{
    name: string
    state: FeatureState
    check_commands: string[]
    check_env_vars: string[]
    check_paths: string[]
  }>
  requirements: {
    runtime: {
      strict: boolean
      primary: RuntimePrimary
      fallback_order: Array<RuntimePrimary>
    }
    umu: FeatureState
    winetricks: FeatureState
    gamescope: FeatureState
    gamemode: FeatureState
    mangohud: FeatureState
    steam_runtime: FeatureState
  }
  registry_keys: Array<{ path: string; name: string; value_type: string; value: string }>
  integrity_files: string[]
  folder_mounts: Array<{
    source_relative_path: string
    target_windows_path: string
    create_source_if_missing: boolean
  }>
  splash: {
    hero_image_url: string
    hero_image_data_url: string
  }
  scripts: {
    pre_launch: string
    post_launch: string
  }
}

export function defaultGameConfig(): GameConfig {
  return {
    config_version: 1,
    created_by: 'creator-ui',
    game_name: '',
    exe_hash: '',
    relative_exe_path: './game.exe',
    launch_args: [],
    runner: {
      proton_version: 'GE-Proton-latest',
      auto_update: false,
      esync: true,
      fsync: true,
      runtime_preference: 'Proton'
    },
    environment: {
      gamemode: 'OptionalOff',
      gamescope: {
        state: 'OptionalOff',
        resolution: null,
        fsr: false,
        game_width: '',
        game_height: '',
        output_width: '',
        output_height: '',
        upscale_method: 'fsr',
        window_type: 'fullscreen',
        enable_limiter: false,
        fps_limiter: '',
        fps_limiter_no_focus: '',
        force_grab_cursor: false,
        additional_options: ''
      },
      mangohud: 'OptionalOff',
      prime_offload: 'OptionalOff',
      custom_vars: {}
    },
    compatibility: {
      wine_wayland: 'OptionalOff',
      hdr: 'OptionalOff',
      auto_dxvk_nvapi: 'OptionalOff',
      easy_anti_cheat_runtime: 'OptionalOff',
      battleye_runtime: 'OptionalOff',
      staging: 'OptionalOff',
      wrapper_commands: []
    },
    winecfg: {
      windows_version: null,
      dll_overrides: [],
      auto_capture_mouse: { state: 'OptionalOn', use_wine_default: true },
      window_decorations: { state: 'OptionalOn', use_wine_default: true },
      window_manager_control: { state: 'OptionalOn', use_wine_default: true },
      virtual_desktop: { state: { state: 'OptionalOff', use_wine_default: true }, resolution: null },
      screen_dpi: null,
      desktop_integration: { state: 'OptionalOn', use_wine_default: true },
      mime_associations: { state: 'OptionalOff', use_wine_default: true },
      desktop_folders: [],
      drives: [
        {
          letter: 'Z',
          source_relative_path: '.',
          state: 'OptionalOn',
          host_path: null,
          drive_type: 'auto',
          label: null,
          serial: null
        }
      ],
      audio_driver: null
    },
    dependencies: [],
    extra_system_dependencies: [],
    requirements: {
      runtime: {
        strict: false,
        primary: 'ProtonUmu',
        fallback_order: ['ProtonNative', 'Wine']
      },
      umu: 'MandatoryOn',
      winetricks: 'OptionalOff',
      gamescope: 'OptionalOff',
      gamemode: 'OptionalOff',
      mangohud: 'OptionalOff',
      steam_runtime: 'OptionalOff'
    },
    registry_keys: [],
    integrity_files: [],
    folder_mounts: [],
    splash: {
      hero_image_url: '',
      hero_image_data_url: ''
    },
    scripts: {
      pre_launch: '',
      post_launch: ''
    }
  }
}
