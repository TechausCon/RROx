#include <unordered_map>
#include <vector>
#include <string>
#include "./UE/v425/fname.h"
#include "./UE/v425/uobjectarray.h"
#include "./UE/v503/fname.h"
#include "./UE/v503/uobjectarray.h"
#include "./wrappers/uobject.h"
#include "injector.h"
#include "generator.h"
#include "./net/messages/log.h"
#include "./net/messages/getdata.h"
#include "./net/messages/getinstances.h"
#include "./net/messages/getstatic.h"
#include "./net/messages/getstruct.h"
#include "./net/messages/getstructlist.h"
#include "./net/messages/getstructtype.h"
#include "./net/messages/getinstancesmulti.h"
#include "./net/messages/ready.h"

namespace {
	constexpr int32_t kMinObjectCount = 256;
	constexpr int32_t kMaxObjectCount = 8'000'000;

	bool isReadable(const void* ptr, size_t size) {
		return ptr != nullptr && IsBadReadPtr(ptr, size) == FALSE;
	}
}

size_t UE425::FNameEntryAllocator::NumEntries = 0;
std::unordered_map<uint32_t, std::string> UE425::FNameEntryAllocator::Cache = {};
size_t UE503::FNameEntryAllocator::NumEntries = 0;
std::unordered_map<uint32_t, std::string> UE503::FNameEntryAllocator::Cache = {};

bool Injector::validateUE503ObjectArray(UE503::FUObjectArray* arr) {
	if (!isReadable(arr, sizeof(UE503::FUObjectArray)))
		return false;

	auto& objects = arr->ObjObjects;
	if (objects.NumElements < kMinObjectCount || objects.NumElements > kMaxObjectCount)
		return false;

	if (objects.MaxElements < objects.NumElements)
		return false;

	if (objects.NumChunks <= 0 || objects.NumChunks > 256)
		return false;

	if (objects.NumElements > 0 && !isReadable(objects.Objects, sizeof(UE503::FUObjectItem*)))
		return false;

	return true;
}

bool Injector::validateUE503NamePool(UE503::FNamePool* pool) {
	if (!isReadable(pool, sizeof(UE503::FNamePool)))
		return false;

	auto& entries = pool->Entries;
	if (entries.CurrentBlock > 8191)
		return false;

	return true;
}

bool Injector::validateUE425ObjectArray(UE425::FUObjectArray* arr) {
	if (!isReadable(arr, sizeof(UE425::FUObjectArray)))
		return false;

	auto& objects = arr->ObjObjects;
	if (objects.NumElements < kMinObjectCount || objects.NumElements > kMaxObjectCount)
		return false;

	if (objects.MaxElements < objects.NumElements)
		return false;

	return true;
}

bool Injector::validateUE425NamePool(UE425::FNamePool* pool) {
	return isReadable(pool, sizeof(UE425::FNamePool));
}

bool Injector::tryLoadUE503() {
	const auto objectSig = "48 8B 05 * * * * 48 8B 0C C8 48 8D 04 D1 EB";
	const auto namePoolSig = "48 8D 15 * * * * EB 16 48 8D 0D";

	log("Trying UE 5.03 layout (Railroads Online UE5)...");

	if (!memory.retrieveSymbol<UE503::FUObjectArray>(objectSig, -0x10, validateUE503ObjectArray)) {
		log("UE503: FUObjectArray pattern not found or failed validation.");
		return false;
	}

	log("UE503: FUObjectArray resolved.");

	if (!memory.retrieveSymbol<UE503::FNamePool>(namePoolSig, 0, validateUE503NamePool)) {
		log("UE503: FNamePool pattern not found or failed validation.");
		memory.unregisterSymbol<UE503::FUObjectArray>();
		return false;
	}

	log("UE503: FNamePool resolved.");
	log("Determined engine is UE503");

	version = EVersion::UE503;
	objectArray.load(memory.getSymbol<UE503::FUObjectArray>());
	UE503::NamePoolData = memory.getSymbol<UE503::FNamePool>();
	return true;
}

bool Injector::tryLoadUE425() {
	const auto objectSig = "48 8B 05 * * * * 48 8B 0C C8 48 8D 04 D1 EB";
	const auto namePoolSig = "48 8D 35 * * * * EB 16";

	log("Trying UE 4.25 / 5.0 layout...");

	if (!memory.retrieveSymbol<UE425::FUObjectArray>(objectSig, -0x10, validateUE425ObjectArray)) {
		log("UE425: FUObjectArray pattern not found or failed validation.");
		return false;
	}

	if (!memory.retrieveSymbol<UE425::FNamePool>(namePoolSig, 0, validateUE425NamePool)) {
		log("UE425: FNamePool pattern not found or failed validation.");
		memory.unregisterSymbol<UE425::FUObjectArray>();
		return false;
	}

	log("Found FUObjectArray and FNamePool for UE425 or UE500.");

	objectArray.load(memory.getSymbol<UE425::FUObjectArray>());
	UE425::NamePoolData = memory.getSymbol<UE425::FNamePool>();

	uint32_t version_offset = determineVersionOffset();

	if (version_offset == 0xA4) {
		log("Determined engine is UE425");
		version = EVersion::UE425;
		UE425::UObjectProcessEventOffset = 0x42;
	}
	else {
		log("Determined engine is UE500");
		version = EVersion::UE500;
		UE425::UObjectProcessEventOffset = 0x4B;
	}

	return true;
}

bool Injector::load() {
	if (tryLoadUE503()) {
		ReadyMessage readyMsg;
		readyMsg.Send();
		log("RROx ready (UE503).");
		processMessages();
		return true;
	}

	if (tryLoadUE425()) {
		ReadyMessage readyMsg;
		readyMsg.Send();
		log("RROx ready (UE425/UE500).");
		processMessages();
		return true;
	}

	log("Could not find validated FUObjectArray and FNamePool. Detaching without touching game objects.");
	return false;
}

void Injector::stop() {
	log("Stopping Injector");
	communicator.Close();
}

uint32_t Injector::determineVersionOffset() {
	auto item = objectArray.FindObject("Class Engine.GameUserSettings");
	if (!item)
		return -1;

	int32_t version_offset = 0;

	WUObject wrapped = item.GetObject();
	if (wrapped.IsA<WUStruct>()) {
		WUStruct wrapped_struct = wrapped.Cast<WUStruct>();
		for (auto prop = wrapped_struct.GetChildProperties().Cast<WFProperty>(); prop; prop = prop.GetNext().Cast<WFProperty>()) {
			if (prop.GetName() == "Version") {
				version_offset = prop.GetOffset();
				break;
			}
		}
	}

	return version_offset;
}

void Injector::log(std::string message) {
	if (!communicator.IsConnected())
		communicator.Connect();

	LogMessage msg = LogMessage(message);
	msg.Send();
}

bool Injector::stopRequested() {
	return stopToken.stop_requested();
}

void Injector::processMessages() {
	log("Listening for messages...");
	while (!stopRequested()) {
		if (!communicator.IsConnected()) {
			std::this_thread::sleep_for(std::chrono::milliseconds(10));
			communicator.Connect();

			ReadyMessage readyMsg;
			readyMsg.Send();
		}

		auto sizeBuffer = communicator.Read(sizeof(std::size_t));
		if (sizeBuffer.Size() == 0) {
			std::this_thread::sleep_for(std::chrono::milliseconds(10));
			continue;
		}
		auto size = sizeBuffer.Read<std::size_t>();
		if (size == 0) {
			std::this_thread::sleep_for(std::chrono::milliseconds(10));
			continue;
		}

		auto message = communicator.Read(size);
		MessageType type = message.Read<MessageType>();
		message.SetOffset(0);

		switch (type) {
		case MessageType::GET_STRUCT: {
			GetStructRequest req = GetStructRequest(message);
			req.pipe = &communicator;
			req.Process();
			break;
		}
		case MessageType::GET_STRUCT_LIST: {
			GetStructListRequest req = GetStructListRequest(message);
			req.pipe = &communicator;
			req.Process();
			break;
		}
		case MessageType::GET_DATA: {
			GetDataRequest req = GetDataRequest(message);
			req.pipe = &communicator;
			req.Process();
			break;
		}
		case MessageType::GET_INSTANCES: {
			GetInstancesRequest req = GetInstancesRequest(message);
			req.pipe = &communicator;
			req.Process();
			break;
		}
		case MessageType::GET_STATIC: {
			GetStaticRequest req = GetStaticRequest(message);
			req.pipe = &communicator;
			req.Process();
			break;
		}
		case MessageType::GET_STRUCT_TYPE: {
			GetStructTypeRequest req = GetStructTypeRequest(message);
			req.pipe = &communicator;
			req.Process();
			break;
		}
		case MessageType::GET_INSTANCES_MULTI: {
			GetInstancesMultiRequest req = GetInstancesMultiRequest(message);
			req.pipe = &communicator;
			req.Process();
			break;
		}
		}
	}
}

Injector injector;
