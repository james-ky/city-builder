#include "CBPlayerController.h"

ACBPlayerController::ACBPlayerController()
{
	bShowMouseCursor = true;
	bEnableClickEvents = true;
}

void ACBPlayerController::BeginPlay()
{
	Super::BeginPlay();

	FInputModeGameAndUI Mode;
	Mode.SetLockMouseToViewportBehavior(EMouseLockMode::LockInFullscreen);
	Mode.SetHideCursorDuringCapture(false);
	SetInputMode(Mode);
}
