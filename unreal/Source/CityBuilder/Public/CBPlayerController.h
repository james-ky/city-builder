#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "CBPlayerController.generated.h"

UCLASS()
class CITYBUILDER_API ACBPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	ACBPlayerController();

protected:
	virtual void BeginPlay() override;
};
