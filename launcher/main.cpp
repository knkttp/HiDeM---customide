#include <windows.h>
#include <tlhelp32.h>

static bool isElectronExe(const char* name) {
    return lstrcmpiA(name, "electron.exe") == 0;
}

static void trimElectronWorkingSets() {
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return;

    PROCESSENTRY32 pe;
    pe.dwSize = sizeof(pe);
    if (Process32First(snap, &pe)) {
        do {
            if (isElectronExe(pe.szExeFile)) {
                HANDLE hProc = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA, FALSE, pe.th32ProcessID);
                if (hProc) {
                    SetProcessWorkingSetSize(hProc, (SIZE_T)-1, (SIZE_T)-1);
                    CloseHandle(hProc);
                }
            }
        } while (Process32Next(snap, &pe));
    }
    CloseHandle(snap);
}

int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR lpCmdLine, int) {
    if (lpCmdLine && lstrcmpiA(lpCmdLine, "--trim") == 0) {
        trimElectronWorkingSets();
        return 0;
    }

    char appDir[MAX_PATH];
    DWORD len = GetModuleFileNameA(NULL, appDir, MAX_PATH);
    if (len == 0) return 1;

    for (int i = (int)len - 1; i >= 0; --i) {
        if (appDir[i] == '\\' || appDir[i] == '/') {
            appDir[i] = '\0';
            break;
        }
    }

    char electronExe[MAX_PATH * 2];
    wsprintfA(electronExe, "%s\\node_modules\\electron\\dist\\electron.exe", appDir);

    DWORD attrs = GetFileAttributesA(electronExe);
    if (attrs != INVALID_FILE_ATTRIBUTES && !(attrs & FILE_ATTRIBUTE_DIRECTORY)) {
        char cmdLine[MAX_PATH * 4];
        wsprintfA(cmdLine, "\"%s\" \"%s\\electron\\main.cjs\"", electronExe, appDir);

        STARTUPINFOA si;
        PROCESS_INFORMATION pi;
        ZeroMemory(&si, sizeof(si));
        ZeroMemory(&pi, sizeof(pi));
        si.cb = sizeof(si);

        if (CreateProcessA(
                NULL,
                cmdLine,
                NULL,
                NULL,
                FALSE,
                CREATE_NO_WINDOW,
                NULL,
                appDir,
                &si,
                &pi)) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            return 0;
        }
    }

    MessageBoxA(
        NULL,
        "Could not find Electron runtime in node_modules/electron/dist/electron.exe",
        "HiDeM Launch Error",
        MB_ICONERROR | MB_OK
    );
    return 1;
}
