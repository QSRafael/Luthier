export type FeatureState = 'MandatoryOn' | 'MandatoryOff' | 'OptionalOn' | 'OptionalOff'

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
    prime_offload: boolean
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
    dll_overrides: Array<{ dll: string; mode: string }>
    auto_capture_mouse: FeatureState
    window_decorations: FeatureState
    window_manager_control: FeatureState
    virtual_desktop: { state: FeatureState; resolution: string | null }
    desktop_integration: FeatureState
    drives: Array<{ letter: string; source_relative_path: string; state: FeatureState }>
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
      proton_version: 'GE-Proton9-10',
      auto_update: false,
      esync: true,
      fsync: true,
      runtime_preference: 'Auto'
    },
    environment: {
      gamemode: 'OptionalOn',
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
      prime_offload: false,
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
      dll_overrides: [],
      auto_capture_mouse: 'OptionalOn',
      window_decorations: 'OptionalOn',
      window_manager_control: 'OptionalOn',
      virtual_desktop: { state: 'OptionalOff', resolution: null },
      desktop_integration: 'OptionalOn',
      drives: [{ letter: 'Z', source_relative_path: '.', state: 'OptionalOn' }],
      audio_driver: null
    },
    dependencies: [],
    extra_system_dependencies: [],
    requirements: {
      runtime: {
        strict: false,
        primary: 'ProtonNative',
        fallback_order: ['ProtonUmu', 'Wine']
      },
      umu: 'OptionalOn',
      winetricks: 'OptionalOff',
      gamescope: 'OptionalOff',
      gamemode: 'OptionalOn',
      mangohud: 'OptionalOff',
      steam_runtime: 'OptionalOff'
    },
    registry_keys: [],
    integrity_files: [],
    folder_mounts: [],
    scripts: {
      pre_launch: '',
      post_launch: ''
    }
  }
}
