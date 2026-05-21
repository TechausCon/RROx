#pragma once
#include "utils/memory.h"
#include "net/pipe.h"
#include <thread>
#include "wrappers/uobjectarray.h"
#include "./UE/v425/uobjectarray.h"
#include "./UE/v425/fname.h"
#include "./UE/v503/uobjectarray.h"
#include "./UE/v503/fname.h"

class Injector {
private:
	MemoryManager memory;
	uint32_t determineVersionOffset();
	bool tryLoadUE503();
	bool tryLoadUE425();
	static bool validateUE503ObjectArray(UE503::FUObjectArray* arr);
	static bool validateUE503NamePool(UE503::FNamePool* pool);
	static bool validateUE425ObjectArray(UE425::FUObjectArray* arr);
	static bool validateUE425NamePool(UE425::FNamePool* pool);

public:
	EVersion version;
	WFUObjectArray objectArray;

	std::stop_token stopToken;

	NamedPipe communicator{ "DID" };

	bool load();

	void stop();

	bool stopRequested();

	void log(std::string message);

	void processMessages();
};

/** Global reference to injector class */
extern Injector injector;