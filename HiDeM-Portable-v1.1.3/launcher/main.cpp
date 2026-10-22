#include <windows.h>
#include <string>
#include <filesystem>

namespace fs = std::filesystem;

std::string getExecutableDir() {
    char buffer[MAX_PATH];
    DWORD len = GetModuleFileNameA(nullptr, buffer, MAX_PATH);
    if (len == 0) return ".";
    return fs::path(std::string(buffer, len)).parent_path().string();
}

int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
    std::string appDir = getExecutableDir();
    fs::path electronExe = fs::path(appDir) / "node_modules" / "electron" / "dist" / "electron.exe";
    fs::path mainScript = fs::path(appDir) / "electron" / "main.cjs";

    if (fs::exists(electronExe)) {
        std::string cmdLine = "\"" + electronExe.string() + "\" \"" + mainScript.string() + "\"";
        STARTUPINFOA si{};
        PROCESS_INFORMATION pi{};
        si.cb = sizeof(si);

        char* cmdBuf = _strdup(cmdLine.c_str());
        BOOL ok = CreateProcessA(
            nullptr,
            cmdBuf,
            nullptr,
            nullptr,
            FALSE,
            CREATE_NO_WINDOW,
            nullptr,
            appDir.c_str(),
            &si,
            &pi
        );
        free(cmdBuf);

        if (ok) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            return 0;
        }
    }

    MessageBoxA(
        nullptr,
        "Could not find Electron runtime in node_modules/electron/dist/electron.exe",
        "HiDeM Launch Error",
        MB_ICONERROR | MB_OK
    );
    return 1;
}
