/**
 * controller-file-actions.ts
 *
 * Thin presentation adapter for file actions.
 */

import { isLikelyAbsolutePath, replaceAt } from './controller-utils'
import type { createLuthierState } from './controller-state'
import type { createLuthierComputed } from './controller-computed'
import type { BackendCommandPort } from './application/ports'
import { createFilePickersUseCase } from './application/use-cases/file-pickers'

export function createLuthierFileActions(
  state: ReturnType<typeof createLuthierState>,
  _computed: ReturnType<typeof createLuthierComputed>,
  backend: BackendCommandPort,
  ct: (key: any) => string,
  ctf: (key: any, params: any) => string,
  setStatusMessage: (msg: string) => void
) {
  const filePickersUseCase = createFilePickersUseCase({
    backend,
    state: {
      readState: () => ({
        exePath: state.exePath(),
        gameRoot: state.gameRoot(),
      }),
      setExePath: state.setExePath,
      setLastHashedExePath: state.setLastHashedExePath,
      setIconPreviewPath: state.setIconPreviewPath,
      setExeHash: (value: string) => {
        state.patchConfig((prev) => ({ ...prev, exe_hash: value }))
      },
      setGameRootManualOverride: state.setGameRootManualOverride,
      setGameRoot: state.setGameRoot,
      setRelativeExePath: (value: string) => {
        state.patchConfig((prev) => ({ ...prev, relative_exe_path: value }))
      },
      setRegistryImportPath: state.setRegistryImportPath,
      setMountSourceRelativePath: (index: number, value: string) => {
        state.patchConfig((prev) => ({
          ...prev,
          folder_mounts: replaceAt(prev.folder_mounts, index, {
            ...prev.folder_mounts[index],
            source_relative_path: value,
          }),
        }))
      },
    },
    messages: {
      selectGameExecutable: ct('luthier_select_game_executable'),
      selectRegFile: ct('luthier_select_reg_file'),
      selectGameRootFolder: ct('luthier_select_game_root_folder'),
      selectRequiredFile: ct('luthier_select_required_file'),
      selectFolderToMount: ct('luthier_select_folder_to_mount'),
    },
  })

  const extractExecutableIcon = async () => {
    const currentExe = state.exePath().trim()
    if (!currentExe) {
      setStatusMessage(ct('luthier_select_an_executable_before_extracting_icon'))
      return
    }

    if (!isLikelyAbsolutePath(currentExe)) {
      setStatusMessage(ct('luthier_icon_extraction_requires_an_absolute_path_in_browser_lan_m'))
      return
    }

    try {
      state.setExtractingExecutableIcon(true)
      setStatusMessage(ct('luthier_extracting_icon_from_executable'))
      const result = await backend.extractExecutableIcon(currentExe)
      state.setIconPreviewPath(result.data_url)
      setStatusMessage(
        ctf('luthier_executable_icon_extracted_size', {
          width: result.width,
          height: result.height,
        })
      )
    } catch (error) {
      setStatusMessage(
        ctf('luthier_failed_to_extract_executable_icon_error', { error: String(error) })
      )
    } finally {
      state.setExtractingExecutableIcon(false)
    }
  }

  return {
    ...filePickersUseCase,
    extractExecutableIcon,
  }
}
