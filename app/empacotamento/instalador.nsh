; Ganchos do instalador NSIS (M1-T14, C-16 e C-17).
; O modelo do electron-builder copia sempre o próprio instalador para
; %LOCALAPPDATA%\<nome>-updater\installer.exe (app-builder-lib, templates/nsis/include/installer.nsh), para a
; atualização automática diferencial. O BiblioDocs Pro não tem atualização automática (C-17), e a cópia (~110 MB)
; sobrava depois de desinstalar. Ela sai ao instalar e ao desinstalar. O RMDir sem /r só remove a pasta vazia.
; O nome da pasta vem do "name" do package.json: mudou o nome, mude aqui.

!macro customInstall
  Delete "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}"
  RMDir "$LOCALAPPDATA\bibliodocs-pro-updater"
!macroend

!macro customUnInstall
  Delete "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}"
  RMDir "$LOCALAPPDATA\bibliodocs-pro-updater"
!macroend
