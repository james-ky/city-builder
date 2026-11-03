#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "CBGameMode.generated.h"

class ACBTownBuilder;
class ACBDayNight;

/** Sets up the whole test town at runtime: no level assets needed. */
UCLASS()
class CITYBUILDER_API ACBGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ACBGameMode();
	virtual void StartPlay() override;

	UPROPERTY(Transient, BlueprintReadOnly, Category = "City")
	TObjectPtr<ACBTownBuilder> Town;

	UPROPERTY(Transient, BlueprintReadOnly, Category = "City")
	TObjectPtr<ACBDayNight> DayNight;
};
