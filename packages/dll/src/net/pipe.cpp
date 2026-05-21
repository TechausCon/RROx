#include "pipe.h"
#include "../injector.h"

NamedPipe::NamedPipe(const std::string pipeName) : pipe(INVALID_HANDLE_VALUE) {
    name = pipeName;
}

void NamedPipe::Connect() {
    if (connected && pipe != INVALID_HANDLE_VALUE)
        return;

    Close();

    // Client side: wait for the Electron/Node pipe server, then open the pipe.
    // Do NOT call ConnectNamedPipe here — that is server-only and breaks the client.
    if (!WaitNamedPipe(TEXT("\\\\.\\pipe\\RRO"), 15000))
        return;

    pipe = CreateFile(
        TEXT("\\\\.\\pipe\\RRO"),
        GENERIC_READ | GENERIC_WRITE,
        0,
        NULL,
        OPEN_EXISTING,
        0,
        NULL
    );

    if (pipe == INVALID_HANDLE_VALUE) {
        connected = false;
        return;
    }

    connected = true;
}

Buffer NamedPipe::Read(std::size_t size) {
    std::vector<std::byte> buffer(size);
    bool fSuccess;
    do
    {
        fSuccess = ReadFile(pipe, buffer.data(), size, &numRead, NULL);
        if (!fSuccess && GetLastError() == ERROR_BROKEN_PIPE)
            connected = false;
    } while (!injector.stopRequested() && !fSuccess && connected);

    return std::move(buffer);
}

void NamedPipe::Write(Buffer& buffer) {
    if (!connected)
        Connect();

    if (!connected)
        return;

    auto size = buffer.Size();
    bool fSuccess = WriteFile(pipe, &size, sizeof(size), &numWritten, NULL);
    if (!fSuccess) {
        Connect();
        if (!connected)
            return;
        fSuccess = WriteFile(pipe, &size, sizeof(size), &numWritten, NULL);
    }

    if (!fSuccess)
        return;

    fSuccess = WriteFile(pipe, buffer.Data(), buffer.Size(), &numWritten, NULL);
    if (!fSuccess) {
        Connect();
        if (connected)
            WriteFile(pipe, buffer.Data(), buffer.Size(), &numWritten, NULL);
    }
}

void NamedPipe::Flush() {
    if (pipe != INVALID_HANDLE_VALUE)
        FlushFileBuffers(pipe);
}

void NamedPipe::Close() {
    if (pipe == nullptr || pipe == INVALID_HANDLE_VALUE)
        return;

    Flush();
    CloseHandle(pipe);
    pipe = INVALID_HANDLE_VALUE;
    connected = false;
}

bool NamedPipe::IsConnected() {
    return connected;
}
