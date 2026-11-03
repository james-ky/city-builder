#include "CBGameMode.h"
#include "CBCameraPawn.h"
#include "CBPlayerController.h"
#include "CBTownBuilder.h"
#include "CBDayNight.h"
#include "Engine/World.h"

ACBGameMode::ACBGameMode()
{
	DefaultPawnClass = ACBCameraPawn::StaticClass();
	PlayerControllerClass = ACBPlayerController::StaticClass();
}

void ACBGameMode::StartPlay()
{
	UWorld* World = GetWorld();
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	Town = World->SpawnActor<ACBTownBuilder>(ACBTownBuilder::StaticClass(), FTransform::Identity, Params);
	DayNight = World->SpawnActor<ACBDayNight>(ACBDayNight::StaticClass(), FTransform::Identity, Params);
	if (DayNight)
	{
		DayNight->Town = Town;
	}

	Super::StartPlay();
}
