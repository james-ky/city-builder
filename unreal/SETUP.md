# City Builder in Unreal 5.7: setup

This folder is the Unreal version of the game. The browser game is untouched.
Every change I push gets built on **your PC** and turned into a download.

## 1. Install (once)
1. Epic Games Launcher: https://www.unrealengine.com/download. Sign in, then **Unreal Engine > Library > +** and install **5.7** (default folder `C:\Program Files\Epic Games\UE_5.7`).
2. Visual Studio 2022 Community: https://visualstudio.microsoft.com/vs/community/. Tick **Game development with C++**. In the side panel, also tick the latest **Windows 11 SDK** and **.NET Framework 4.8 SDK**.
3. Git for Windows: https://git-scm.com/download/win

## 2. Make your PC the build machine (once)
1. Open https://github.com/james-ky/city-builder/settings/actions/runners/new and pick **Windows / x64**.
2. Open **PowerShell as Administrator** and run the commands GitHub shows, but put the runner on C: like this:
   ```powershell
   mkdir C:\actions-runner; cd C:\actions-runner
   # paste the "Invoke-WebRequest ... actions-runner-win-x64-....zip" and "Expand-Archive" lines from the GitHub page here
   .\config.cmd --url https://github.com/james-ky/city-builder --token <TOKEN FROM THE PAGE> --labels unreal --runasservice
   ```
   Press Enter to accept the defaults it asks about (runner group, name, work folder).
   When it asks which account to run the service as, press Enter (NT AUTHORITY\NETWORK SERVICE).
3. Check that it worked: the page https://github.com/james-ky/city-builder/settings/actions/runners shows your PC as **Idle** with the labels `self-hosted, Windows, X64, unreal`.

The service starts with Windows. To stop it: `Stop-Service "actions.runner.*"`. To start it again: `Start-Service "actions.runner.*"`.
If Unreal is installed somewhere else, add a repo variable `UE_ROOT` with that folder under https://github.com/james-ky/city-builder/settings/variables/actions

## 3. Get the game
- Builds start by themselves when I push. You can also start one at https://github.com/james-ky/city-builder/actions/workflows/unreal-win64.yml with **Run workflow**.
- The first build takes 30 to 60 minutes because Unreal compiles shaders. After that it's much faster.
- Open the finished run and download **CityBuilder-Win64** at the bottom. Unzip it and run `CityBuilder.exe`.

## 4. Open the project yourself (optional)
1. Clone the repo, or use the copy in `C:\actions-runner\_work\city-builder\city-builder`.
2. Right-click `unreal\CityBuilder.uproject` and choose **Generate Visual Studio project files**.
3. Double-click `CityBuilder.uproject`. When it asks to build missing modules, click **Yes**.
4. Press **Play**. The town is built by code when the game starts, so the editor level looks empty until you press Play.

## Controls
WASD, the arrow keys or moving the mouse to the screen edge pans. The mouse wheel zooms. Q and E rotate. 1, 2 and 3 set the speed, and Space pauses.
