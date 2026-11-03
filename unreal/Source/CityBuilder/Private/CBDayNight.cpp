#include "CBDayNight.h"
#include "CBTownBuilder.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/PostProcessComponent.h"
#include "Engine/Engine.h"

ACBDayNight::ACBDayNight()
{
	PrimaryActorTick.bCanEverTick = true;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	Sun = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Sun"));
	Sun->SetupAttachment(Root);
	Sun->SetMobility(EComponentMobility::Movable);
	Sun->SetAtmosphereSunLight(true);
	Sun->SetAtmosphereSunLightIndex(0);
	Sun->SetIntensity(10.f); // lux
	Sun->SetUseTemperature(true);
	Sun->SetTemperature(5800.f);
	Sun->SetCastShadows(true);

	Moon = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Moon"));
	Moon->SetupAttachment(Root);
	Moon->SetMobility(EComponentMobility::Movable);
	Moon->SetAtmosphereSunLight(true);
	Moon->SetAtmosphereSunLightIndex(1);
	Moon->SetIntensity(0.f);
	Moon->SetLightColor(FLinearColor(0.55f, 0.65f, 1.f));
	Moon->SetCastShadows(true);

	Atmosphere = CreateDefaultSubobject<USkyAtmosphereComponent>(TEXT("Atmosphere"));
	Atmosphere->SetupAttachment(Root);

	SkyLight = CreateDefaultSubobject<USkyLightComponent>(TEXT("SkyLight"));
	SkyLight->SetupAttachment(Root);
	SkyLight->SetMobility(EComponentMobility::Movable);
	SkyLight->bRealTimeCapture = true;
	SkyLight->SetIntensity(1.f);
	SkyLight->SetLowerHemisphereColor(FLinearColor(0.02f, 0.02f, 0.02f));

	Fog = CreateDefaultSubobject<UExponentialHeightFogComponent>(TEXT("Fog"));
	Fog->SetupAttachment(Root);
	Fog->SetFogDensity(0.01f);
	Fog->SetFogHeightFalloff(0.2f);

	// Keep auto-exposure in a range so nights read as night but stay playable.
	PostProcess = CreateDefaultSubobject<UPostProcessComponent>(TEXT("PostProcess"));
	PostProcess->SetupAttachment(Root);
	PostProcess->bUnbound = true;
	FPostProcessSettings& S = PostProcess->Settings;
	S.bOverride_AutoExposureMinBrightness = true;
	S.AutoExposureMinBrightness = -3.f; // EV100
	S.bOverride_AutoExposureMaxBrightness = true;
	S.AutoExposureMaxBrightness = 12.f;
	S.bOverride_AutoExposureSpeedUp = true;
	S.AutoExposureSpeedUp = 1.5f;
	S.bOverride_AutoExposureSpeedDown = true;
	S.AutoExposureSpeedDown = 1.5f;
}

void ACBDayNight::BeginPlay()
{
	Super::BeginPlay();
	Apply();
}

void ACBDayNight::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!bPaused)
	{
		Hour = FMath::Fmod(Hour + DeltaSeconds * SpeedMultiplier * 24.f / SecondsPerDay, 24.f);
	}
	Apply();

	if (GEngine)
	{
		const int32 H = FMath::FloorToInt(Hour);
		const int32 M = FMath::FloorToInt((Hour - H) * 60.f);
		const FString Speed = bPaused ? TEXT("paused") : FString::Printf(TEXT("%.0fx"), SpeedMultiplier);
		GEngine->AddOnScreenDebugMessage(1, 0.f, FColor::White,
			FString::Printf(TEXT("%02d:%02d  %s   |  WASD/edge pan  wheel zoom  Q/E rotate  1-3 speed  Space pause"), H, M, *Speed));
	}
}

void ACBDayNight::Apply()
{
	// Sun pitch: 0 at 06:00 (horizon), -90 at noon, -180 at 18:00, below horizon overnight.
	const float SunPitch = -(Hour - 6.f) * 15.f;
	Sun->SetWorldRotation(FRotator(SunPitch, SunYaw, 0.f));
	Moon->SetWorldRotation(FRotator(SunPitch + 180.f, SunYaw + 180.f, 0.f));

	// Elevation of the sun above the horizon, -1..1
	const float Elev = FMath::Sin(FMath::DegreesToRadians((Hour - 6.f) * 15.f));
	const float Day = FMath::SmoothStep(-0.08f, 0.15f, Elev);
	const float Night = 1.f - Day;

	Sun->SetIntensity(10.f * Day);
	Sun->SetTemperature(FMath::Lerp(2600.f, 5800.f, FMath::Clamp(Elev * 2.f, 0.f, 1.f))); // warm at dawn/dusk
	Moon->SetIntensity(0.25f * Night);
	SkyLight->SetIntensity(FMath::Lerp(0.6f, 1.f, Day));

	if (Town)
	{
		Town->SetNightAmount(Night);
	}
}
