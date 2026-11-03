#include "CBCameraPawn.h"
#include "CBGameMode.h"
#include "CBDayNight.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/PlayerController.h"
#include "Components/InputComponent.h"
#include "InputCoreTypes.h"
#include "Engine/Engine.h"
#include "Engine/World.h"

ACBCameraPawn::ACBCameraPawn()
{
	PrimaryActorTick.bCanEverTick = true;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	Arm = CreateDefaultSubobject<USpringArmComponent>(TEXT("Arm"));
	Arm->SetupAttachment(Root);
	Arm->bDoCollisionTest = false;
	Arm->bEnableCameraLag = true;
	Arm->CameraLagSpeed = 10.f;
	Arm->TargetArmLength = TargetZoom;
	Arm->SetRelativeRotation(FRotator(TargetPitch, 0.f, 0.f));

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(Arm, USpringArmComponent::SocketName);
	Camera->SetFieldOfView(45.f);

}

void ACBCameraPawn::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	// Raw key bindings keep this free of input assets.
	PlayerInputComponent->BindKey(EKeys::MouseScrollUp, IE_Pressed, this, &ACBCameraPawn::ZoomIn);
	PlayerInputComponent->BindKey(EKeys::MouseScrollDown, IE_Pressed, this, &ACBCameraPawn::ZoomOut);
	PlayerInputComponent->BindKey(EKeys::One, IE_Pressed, this, &ACBCameraPawn::SetSpeed1);
	PlayerInputComponent->BindKey(EKeys::Two, IE_Pressed, this, &ACBCameraPawn::SetSpeed2);
	PlayerInputComponent->BindKey(EKeys::Three, IE_Pressed, this, &ACBCameraPawn::SetSpeed3);
	PlayerInputComponent->BindKey(EKeys::SpaceBar, IE_Pressed, this, &ACBCameraPawn::TogglePause);
}

void ACBCameraPawn::ZoomIn()  { TargetZoom = FMath::Clamp(TargetZoom * (1.f - ZoomStep), MinZoom, MaxZoom); }
void ACBCameraPawn::ZoomOut() { TargetZoom = FMath::Clamp(TargetZoom * (1.f + ZoomStep), MinZoom, MaxZoom); }

void ACBCameraPawn::SetGameSpeed(float Mult)
{
	if (ACBGameMode* GM = GetWorld()->GetAuthGameMode<ACBGameMode>())
	{
		if (GM->DayNight) { GM->DayNight->SpeedMultiplier = Mult; }
	}
}
void ACBCameraPawn::SetSpeed1() { SetGameSpeed(1.f); }
void ACBCameraPawn::SetSpeed2() { SetGameSpeed(2.f); }
void ACBCameraPawn::SetSpeed3() { SetGameSpeed(3.f); }
void ACBCameraPawn::TogglePause()
{
	if (ACBGameMode* GM = GetWorld()->GetAuthGameMode<ACBGameMode>())
	{
		if (GM->DayNight) { GM->DayNight->bPaused = !GM->DayNight->bPaused; }
	}
}

void ACBCameraPawn::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	APlayerController* PC = Cast<APlayerController>(GetController());
	if (!PC) { return; }

	// --- Pan: keys + screen edge ---
	float Fwd = 0.f, Right = 0.f;
	if (PC->IsInputKeyDown(EKeys::W) || PC->IsInputKeyDown(EKeys::Up))    { Fwd += 1.f; }
	if (PC->IsInputKeyDown(EKeys::S) || PC->IsInputKeyDown(EKeys::Down))  { Fwd -= 1.f; }
	if (PC->IsInputKeyDown(EKeys::D) || PC->IsInputKeyDown(EKeys::Right)) { Right += 1.f; }
	if (PC->IsInputKeyDown(EKeys::A) || PC->IsInputKeyDown(EKeys::Left))  { Right -= 1.f; }

	float MX = 0.f, MY = 0.f;
	int32 VX = 0, VY = 0;
	PC->GetViewportSize(VX, VY);
	if (VX > 0 && VY > 0 && PC->GetMousePosition(MX, MY))
	{
		if (MX <= EdgeMargin)            { Right -= 1.f; }
		else if (MX >= VX - EdgeMargin)  { Right += 1.f; }
		if (MY <= EdgeMargin)            { Fwd += 1.f; }
		else if (MY >= VY - EdgeMargin)  { Fwd -= 1.f; }
	}

	const FRotator YawOnly(0.f, GetActorRotation().Yaw, 0.f);
	const FVector FwdDir = FRotationMatrix(YawOnly).GetUnitAxis(EAxis::X);
	const FVector RightDir = FRotationMatrix(YawOnly).GetUnitAxis(EAxis::Y);
	FVector Move = FwdDir * FMath::Clamp(Fwd, -1.f, 1.f) + RightDir * FMath::Clamp(Right, -1.f, 1.f);
	if (!Move.IsNearlyZero())
	{
		const float ZoomScale = Arm->TargetArmLength / 5000.f; // pan faster when zoomed out
		FVector NewLoc = GetActorLocation() + Move.GetSafeNormal() * PanSpeed * ZoomScale * DeltaSeconds;
		NewLoc.X = FMath::Clamp(NewLoc.X, -MapHalfExtent, MapHalfExtent);
		NewLoc.Y = FMath::Clamp(NewLoc.Y, -MapHalfExtent, MapHalfExtent);
		NewLoc.Z = 0.f;
		SetActorLocation(NewLoc);
	}

	// --- Rotate: Q / E ---
	float Rot = 0.f;
	if (PC->IsInputKeyDown(EKeys::Q)) { Rot -= 1.f; }
	if (PC->IsInputKeyDown(EKeys::E)) { Rot += 1.f; }
	if (Rot != 0.f)
	{
		AddActorWorldRotation(FRotator(0.f, Rot * RotateSpeed * DeltaSeconds, 0.f));
	}

	// --- Zoom (smoothed); tilt flattens a little as you zoom in ---
	Arm->TargetArmLength = FMath::FInterpTo(Arm->TargetArmLength, TargetZoom, DeltaSeconds, 8.f);
	const float Alpha = (Arm->TargetArmLength - MinZoom) / (MaxZoom - MinZoom);
	const float Pitch = FMath::Lerp(-35.f, -65.f, FMath::Clamp(Alpha, 0.f, 1.f));
	Arm->SetRelativeRotation(FRotator(Pitch, 0.f, 0.f));
}
